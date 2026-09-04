# 🍎 iPhone Partner & Profit Management System

Sistem manajemen transaksi iPhone dan bagi hasil partner lokal berbasis Node.js, Express, dan SQLite.

## Fitur Utama

1. **Portal Input Partner (`http://localhost:3003`)**:
   - Form cepat & mobile-friendly untuk partner mengisi data transaksi:
     - **Nama Toko**
     - **ID Pemesanan**
     - **Barang dan Warna** (cth: `IP15 Blue`, `IP17 Black`)
     - **Harga Beli** (format Rupiah otomatis)
     - **Catatan Tambahan** (opsional)
   - Dukungan link khusus per partner (contoh: `http://localhost:3003/p/budi`) sehingga identitas partner langsung terkunci.
   - Partner dapat melihat riwayat kiriman mereka dan status pembayarannya tanpa melihat data partner lain.

2. **Dashboard Owner / Admin (`http://localhost:3003/admin`)**:
   - **PIN Keamanan**: Hanya Anda yang bisa melihat harga jual & profit (PIN default: `1234`).
   - **Kartu Ringkasan (KPIs)**:
     - Total Transaksi (Unit)
     - Total Estimasi Profit
     - **Pengingat Belum Dibayar ke Partner** (dengan jumlah rupiah dan jumlah unit pending)
     - Total Sudah Dibayar
   - **Kotak Rekapitulasi per Partner**:
     - Rekap total profit per partner yang belum dibayar.
     - Tombol **Bayar Semua** (1-klik tandai semua unit pending partner tersebut sebagai sudah dibayar).
     - Tombol **Slip WhatsApp** (otomatis membuat pesan rincian profit siap kirim via WA).
   - **Tabel Transaksi Interaktif**:
     - **Inline Edit Harga Jual**: Ketik langsung harga jual di tabel, profit seketika terhitung dan tersimpan ke database otomatis.
     - **Status Pembayaran Interaktif**: Tombol 1-klik untuk ubah `⏳ Belum Dibayar` $\leftrightarrow$ `✅ Sudah Dibayar`.
     - Filter status pembayaran, filter nama partner, dan kolom pencarian instan.
   - **Kelola Partner**: Tambah partner baru dan salin link form khusus partner.
   - **Export Data**: Download seluruh data ke format Excel / CSV dengan 1 klik.

## Cara Menjalankan

Buka terminal PowerShell di direktori `D:\Program\Utilities\iphone` dan jalankan:

```bash
npm start
```

Akses sistem di browser:
- **Form Partner**: `http://localhost:3003`
- **Dashboard Admin**: `http://localhost:3003/admin` (PIN default: `1234`)

## Konfigurasi (`.env`)

```env
PORT=3003
ADMIN_PIN=1234
```
