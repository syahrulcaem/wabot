// ai.js — Gemini AI dengan Function Calling untuk Asisten Kantor
import 'dotenv/config';
import { GoogleGenerativeAI } from '@google/generative-ai';
import * as db from './database.js';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// ─── Session Config ────────────────────────────────────────────────────────────
const SESSION_TTL_MS   = 30 * 60 * 1000; // 30 menit tidak aktif → hapus
const MAX_HISTORY      = 20;             // Maksimum pesan dalam satu sesi
const MAX_AGENT_ITER   = 10;             // Maksimum iterasi agentic loop

// ─── Retry Config (untuk 429 Rate Limit) ─────────────────────────────────────
const MAX_RETRY_429  = 3;    // Maksimum retry saat kena 429
const RETRY_BASE_MS  = 5000; // Backoff awal 5 detik, lalu 10s, 20s

// Helper: sleep
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// Helper: jalankan fungsi dengan retry ketika 429
async function withRetry(fn, retries = MAX_RETRY_429) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      const is429 = err.message?.includes('429') || err.status === 429;
      // Coba baca retry-after dari pesan error Gemini
      const retryAfterMatch = err.message?.match(/Please retry in ([\d.]+)s/);
      const retryAfterMs = retryAfterMatch
        ? Math.ceil(parseFloat(retryAfterMatch[1])) * 1000 + 1000
        : RETRY_BASE_MS * Math.pow(2, attempt);

      if (is429 && attempt < retries) {
        console.warn(`⏳ 429 Rate Limit — retry ${attempt + 1}/${retries} dalam ${Math.round(retryAfterMs / 1000)}s...`);
        await sleep(retryAfterMs);
        continue;
      }

      // Jika sudah habis retry atau bukan 429, lempar error asli
      if (is429) {
        throw new Error(
          '⚠️ Quota Gemini API habis untuk hari ini.\n' +
          'Solusi:\n' +
          '1. Tunggu reset quota (biasanya jam 07.00 WIB esok hari)\n' +
          '2. Ganti ke model lain di .env → GEMINI_MODEL=gemini-1.5-flash\n' +
          '3. Upgrade ke Gemini API berbayar di https://ai.google.dev'
        );
      }
      throw err;
    }
  }
}

// ─── System Prompt ────────────────────────────────────────────────────────────
const systemInstruction = `
Anda adalah "Asisten Kantor" — asisten direktori internal resmi perusahaan.
Tugas utama Anda adalah membantu staf menemukan informasi rekan kerja,
struktur organisasi, kontak internal, dan status kehadiran.

## Panduan Komunikasi
- Gunakan sapaan hangat: "Halo!", "Kak [Nama]", "Pak/Bu [Nama]"
- Jawab dalam Bahasa Indonesia yang ramah dan profesional
- Format jawaban rapi dengan bullet atau penomoran bila ada banyak data
- Gunakan emoji secukupnya agar terasa ramah 😊
- Jangan pernah bagikan alamat rumah atau nomor telepon pribadi karyawan

## Logika Operasional
- User menyebut nama seseorang             → panggil searchKaryawan
- User bertanya tentang divisi / tim       → panggil getKaryawanByDivisi
- User bertanya lokasi / kehadiran         → panggil getKehadiranHariIni
- User ingin melihat semua karyawan        → panggil getAllKaryawan
- Pertanyaan di luar direktori kantor      → tolak dengan sopan

## Interpretasi Data Kehadiran
- lokasi_kerja WFO           = sedang di kantor
- lokasi_kerja WFH           = bekerja dari rumah
- status Izin / Sakit        = tidak hadir hari ini
- status Perjalanan Dinas    = sedang tugas luar
- kehadiran_hari_ini: null   = belum ada data absensi hari ini

Selalu tampilkan jabatan dan divisi saat menyebut nama karyawan.
`.trim();

// ─── Tool Declarations ────────────────────────────────────────────────────────
const tools = [
  {
    functionDeclarations: [
      {
        name: 'searchKaryawan',
        description:
          'Cari informasi karyawan berdasarkan nama. Gunakan bila user menyebut nama seseorang.',
        parameters: {
          type: 'OBJECT',
          properties: {
            nama: {
              type: 'STRING',
              description: 'Nama lengkap atau sebagian nama karyawan yang dicari',
            },
          },
          required: ['nama'],
        },
      },
      {
        name: 'getKaryawanByDivisi',
        description:
          'Dapatkan daftar semua karyawan di suatu divisi atau tim. Gunakan bila user bertanya tentang tim/divisi.',
        parameters: {
          type: 'OBJECT',
          properties: {
            divisi: {
              type: 'STRING',
              description: 'Nama divisi, misalnya: IT, HR, Finance, Marketing, Operations',
            },
          },
          required: ['divisi'],
        },
      },
      {
        name: 'getKehadiranHariIni',
        description:
          'Cek status kehadiran karyawan hari ini (WFO, WFH, Izin, Sakit, dst.).',
        parameters: {
          type: 'OBJECT',
          properties: {
            nama: {
              type: 'STRING',
              description: 'Nama karyawan yang ingin dicek status kehadirannya',
            },
          },
          required: ['nama'],
        },
      },
      {
        name: 'getAllKaryawan',
        description: 'Dapatkan seluruh daftar karyawan perusahaan.',
        parameters: {
          type: 'OBJECT',
          properties: {},
        },
      },
    ],
  },
];

// ─── Function Router ──────────────────────────────────────────────────────────
async function callFunction(name, args) {
  switch (name) {
    case 'searchKaryawan':
      return db.searchKaryawan(args.nama);
    case 'getKaryawanByDivisi':
      return db.getKaryawanByDivisi(args.divisi);
    case 'getKehadiranHariIni':
      return db.getKehadiranHariIni(args.nama);
    case 'getAllKaryawan':
      return db.getAllKaryawan();
    default:
      return { error: `Fungsi '${name}' tidak dikenal.` };
  }
}

// ─── Session Store ────────────────────────────────────────────────────────────
// { sessionId → { history: [], lastActive: timestamp } }
const sessions = new Map();

// Bersihkan session yang sudah tidak aktif (TTL expired)
function pruneExpiredSessions() {
  const now = Date.now();
  for (const [id, session] of sessions) {
    if (now - session.lastActive > SESSION_TTL_MS) {
      sessions.delete(id);
    }
  }
}

// Jalankan pruning setiap 10 menit
setInterval(pruneExpiredSessions, 10 * 60 * 1000);

// Ambil history, batasi ke MAX_HISTORY pesan terakhir
function getHistory(sessionId) {
  const session = sessions.get(sessionId);
  if (!session) return [];
  const h = session.history;
  // Pastikan jumlah genap (pasangan user/model) dan tidak melebihi batas
  const maxPairs = Math.floor(MAX_HISTORY / 2);
  return h.length > maxPairs * 2 ? h.slice(-maxPairs * 2) : h;
}

function setHistory(sessionId, history) {
  const maxPairs = Math.floor(MAX_HISTORY / 2);
  const trimmed  = history.length > maxPairs * 2
    ? history.slice(-maxPairs * 2)
    : history;
  sessions.set(sessionId, { history: trimmed, lastActive: Date.now() });
}

// ─── Main Handler ─────────────────────────────────────────────────────────────
async function handleMessage(sessionId, userMessage) {
  const history = getHistory(sessionId);

  const modelName = process.env.GEMINI_MODEL || 'gemini-2.0-flash';
  const model = genAI.getGenerativeModel({
    model: modelName,
    systemInstruction,
    tools,
  });

  const chat = model.startChat({ history });

  // Kirim pesan dengan retry otomatis saat kena 429
  let result = await withRetry(() => chat.sendMessage(userMessage));

  // Agentic loop dengan batas iterasi (FIX: infinite loop)
  let iteration = 0;
  while (iteration < MAX_AGENT_ITER) {
    const calls = result.response.functionCalls();
    if (!calls || calls.length === 0) break;
    iteration++;

    // Jalankan semua function call secara paralel
    const functionResponses = await Promise.all(
      calls.map(async (call) => {
        let output;
        try {
          output = await callFunction(call.name, call.args);
        } catch (err) {
          output = { error: `Gagal mengambil data: ${err.message}` };
        }
        return {
          functionResponse: {
            name: call.name,
            response: { result: output },
          },
        };
      })
    );

    // Retry juga untuk iterasi agentic loop
    result = await withRetry(() => chat.sendMessage(functionResponses));
  }

  if (iteration >= MAX_AGENT_ITER) {
    console.warn(`⚠️  Agentic loop mencapai batas (${MAX_AGENT_ITER} iterasi) untuk sesi ${sessionId}`);
  }

  // Simpan riwayat yang diperbarui dengan batasan MAX_HISTORY
  setHistory(sessionId, await chat.getHistory());

  return result.response.text();
}

function clearSession(sessionId) {
  sessions.delete(sessionId);
}

export { handleMessage, clearSession };
