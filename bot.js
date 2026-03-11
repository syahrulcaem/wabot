// bot.js — WhatsApp bot (Baileys) — Pairing Code Auth
import 'dotenv/config';
import makeWASocket, { useMultiFileAuthState, DisconnectReason, Browsers } from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import pino from 'pino';
import { rmSync, existsSync } from 'fs';
import { createInterface } from 'readline';
import { handleMessage, clearSession } from './ai.js';

const AUTH_DIR = 'auth';

// Exponential backoff state
let retryCount = 0;
const MAX_RETRY = 8;

// Flag persisten di luar startBot() — tidak reset saat reconnect
let pairingRequested = false;

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

// Exponential backoff: 10s, 20s, 40s, 80s, ... max 10 menit, + jitter acak
function backoffDelay() {
  const base = Math.min(10000 * Math.pow(2, retryCount), 600000);
  const jitter = Math.floor(Math.random() * 5000);
  return base + jitter;
}

function clearAuth() {
  if (existsSync(AUTH_DIR)) {
    rmSync(AUTH_DIR, { recursive: true, force: true });
    console.log('🗑️  Session auth dihapus.');
  }
}

function prompt(question) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => rl.question(question, ans => { rl.close(); resolve(ans.trim()); }));
}

async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);

  const sock = makeWASocket({
    auth: state,
    logger: pino({ level: 'silent' }),
    // Gunakan fingerprint browser standar agar tidak terdeteksi sebagai bot
    browser: Browsers.macOS('Chrome'),
    syncFullHistory: false,
    markOnlineOnConnect: false,
    usePairingCode: true,
    connectTimeoutMs: 60000,
    keepAliveIntervalMs: 25000,
    retryRequestDelayMs: 2000,
    getMessage: async () => ({ conversation: '' }),
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', async ({ connection, lastDisconnect }) => {
    // Minta pairing code saat koneksi WS terbuka (open), belum registrasi, belum pernah diminta
    if (connection === 'open' && !state.creds?.registered && !pairingRequested) {
      pairingRequested = true;
      try {
        let phone = process.env.WA_PHONE || '';
        if (!phone || phone.includes('xxxxxxxxxx')) {
          phone = await prompt('📱 Masukkan nomor WA bot (contoh: 6281234567890): ');
        }
        phone = phone.replace(/\D/g, '');
        const code = await sock.requestPairingCode(phone);
        const formatted = code.match(/.{1,4}/g).join('-');
        console.log(`\n🔑 Pairing Code Anda: *${formatted}*`);
        console.log('Langkah di HP WhatsApp:');
        console.log('  1. Buka WhatsApp → titik tiga / Settings');
        console.log('  2. Linked Devices → Link a device');
        console.log('  3. Pilih "Link with phone number"');
        console.log(`  4. Masukkan kode: ${formatted}`);
        console.log('  5. Tekan Verify — bot akan terhubung otomatis.\n');
      } catch (e) {
        console.warn('⚠️  Gagal request pairing code:', e.message);
        pairingRequested = false; // boleh coba lagi
      }
    }

    if (connection === 'open') {
      // Koneksi berhasil — reset retry counter
      retryCount = 0;
      if (state.creds?.registered) {
        console.log('\ud83c\udfe2 Asisten Kantor siap melayani! Menunggu pesan...\n');
      }
    }

    if (connection === 'close') {
      const err    = lastDisconnect?.error;
      const reason = new Boom(err)?.output?.statusCode;
      console.warn(`\u26a0\ufe0f  Koneksi terputus (code: ${reason})`);

      if (reason === DisconnectReason.loggedOut || reason === 401) {
        clearAuth();
        pairingRequested = false;
        console.log('\ud83d\udd04 Session dihapus. Jalankan ulang bot untuk pairing.');
        process.exit(0);

      } else if (reason === 405 || reason === DisconnectReason.restartRequired) {
        // Rate-limited / restartRequired — retry otomatis dengan backoff
        if (retryCount >= MAX_RETRY) {
          console.log('\n\ud83d\udeab Terlalu banyak retry gagal. Hapus folder auth/ lalu jalankan ulang.');
          process.exit(1);
        }
        const delay = backoffDelay();
        retryCount++;
        console.log(`\n\u23f3 Rate-limited (405). Retry ke-${retryCount} dalam ${Math.round(delay/1000)}s...`);
        await sleep(delay);
        startBot();

      } else if (pairingRequested && !state.creds?.registered) {
        console.log('\ud83d\udd01 Reconnecting... Segera masukkan kode di HP Anda.');
        await sleep(3000);
        startBot();

      } else {
        const delay = backoffDelay();
        retryCount++;
        console.log(`\u21ba Reconnect dalam ${Math.round(delay/1000)}s... (retry ${retryCount}/${MAX_RETRY})`);
        await sleep(delay);
        startBot();
      }
    }
  });

  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return;

    const msg = messages[0];
    if (!msg?.message || msg.key.fromMe) return;

    const body = (
      msg.message.conversation ||
      msg.message.extendedTextMessage?.text ||
      msg.message.imageMessage?.caption ||
      ''
    ).trim();

    if (!body) return;

    const sender    = msg.key.remoteJid;
    const timestamp = new Date().toLocaleTimeString('id-ID');
    console.log(`[${timestamp}] ${sender}: ${body}`);

    try {
      await sock.readMessages([msg.key]);
      await sock.sendPresenceUpdate('composing', sender);

      let reply;

      if (body.toLowerCase() === '!reset') {
        clearSession(sender);
        reply =
          '🔄 Riwayat percakapan telah direset.\n\n' +
          'Halo! Saya *Asisten Kantor* 🏢\n' +
          'Ada yang bisa saya bantu?';

      } else if (['!help', '!bantuan'].includes(body.toLowerCase())) {
        reply =
          '🏢 *Asisten Kantor* — Panduan Penggunaan\n\n' +
          'Saya dapat membantu Anda:\n' +
          '• 👤 Cari info karyawan  → _"Siapa Budi di IT?"_\n' +
          '• 🏬 Tampilkan tim/divisi → _"Siapa saja di HR?"_\n' +
          '• 📍 Cek kehadiran        → _"Andi di kantor hari ini?"_\n' +
          '• 📋 Semua karyawan       → _"Tampilkan semua karyawan"_\n\n' +
          '*Perintah:*\n' +
          '• `!reset`  — Reset riwayat percakapan\n' +
          '• `!help`   — Tampilkan panduan ini';

      } else {
        reply = await handleMessage(sender, body);
      }

      await sock.sendPresenceUpdate('paused', sender);
      await sock.sendMessage(sender, { text: reply });

    } catch (err) {
      console.error('❌ Error:', err.message);
      await sock.sendMessage(sender, {
        text: '⚠️ Maaf, terjadi kesalahan. Silakan coba lagi.',
      });
    }
  });
}

startBot();

