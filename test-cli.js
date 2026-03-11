// test-cli.js — Mode CLI untuk menguji Asisten Kantor tanpa WhatsApp
// Jalankan dengan: node test-cli.js
import 'dotenv/config';
import { createInterface } from 'readline';
import { handleMessage, clearSession } from './ai.js';

const SESSION_ID = 'cli-test-session';

console.log('╔═══════════════════════════════════════════════════╗');
console.log('║        🏢 Asisten Kantor — Mode Tes CLI           ║');
console.log('╚═══════════════════════════════════════════════════╝');
console.log('');
console.log('💡 Perintah khusus:');
console.log('  !reset   — Reset riwayat percakapan');
console.log('  !help    — Panduan penggunaan');
console.log('  !quit    — Keluar dari tes');
console.log('  !exit    — Keluar dari tes');
console.log('─────────────────────────────────────────────────────');
console.log('');

const rl = createInterface({
  input: process.stdin,
  output: process.stdout,
  prompt: '👤 Kamu: ',
});

rl.prompt();

rl.on('line', async (line) => {
  const input = line.trim();
  if (!input) { rl.prompt(); return; }

  // Keluar
  if (['!quit', '!exit'].includes(input.toLowerCase())) {
    console.log('\n👋 Sampai jumpa! Tes selesai.\n');
    process.exit(0);
  }

  // Reset sesi
  if (input.toLowerCase() === '!reset') {
    clearSession(SESSION_ID);
    console.log('🤖 Bot: 🔄 Riwayat percakapan telah direset.\n');
    rl.prompt();
    return;
  }

  // Help
  if (['!help', '!bantuan'].includes(input.toLowerCase())) {
    console.log('🤖 Bot:');
    console.log('  🏢 *Asisten Kantor* — Panduan Penggunaan');
    console.log('  Saya dapat membantu Anda:');
    console.log('  • 👤 Cari info karyawan  → "Siapa Budi di IT?"');
    console.log('  • 🏬 Tampilkan tim/divisi → "Siapa saja di HR?"');
    console.log('  • 📍 Cek kehadiran        → "Andi di kantor hari ini?"');
    console.log('  • 📋 Semua karyawan       → "Tampilkan semua karyawan"');
    console.log('');
    rl.prompt();
    return;
  }

  // Kirim ke AI
  process.stdout.write('🤖 Bot: ⏳ Memproses...');
  try {
    const reply = await handleMessage(SESSION_ID, input);
    // Hapus teks loading
    process.stdout.clearLine(0);
    process.stdout.cursorTo(0);
    console.log(`🤖 Bot: ${reply}`);
    console.log('─────────────────────────────────────────────────────');
  } catch (err) {
    process.stdout.clearLine(0);
    process.stdout.cursorTo(0);
    // Tampilkan pesan error baris per baris agar mudah dibaca
    console.error(`❌ ${err.message}`);
    if (err.message.includes('API key') || err.message.includes('GEMINI_API_KEY')) {
      console.error('💡 Pastikan GEMINI_API_KEY di file .env sudah diisi dengan benar.');
    }
    if (err.message.includes('connect') || err.message.includes('ECONNREFUSED')) {
      console.error('💡 Pastikan PostgreSQL sudah berjalan dan konfigurasi DB di .env sudah benar.');
    }
  }

  rl.prompt();
});

rl.on('close', () => {
  console.log('\n👋 Sampai jumpa!\n');
  process.exit(0);
});
