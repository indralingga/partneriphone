require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { dbHelper } = require('./database');

const app = express();
const PORT = process.env.PORT || 3390;
const ADMIN_PIN = process.env.ADMIN_PIN || '1234';

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static assets
app.use(express.static(path.join(__dirname, 'public')));

// Middleware to verify admin PIN for protected mutations (optional header x-admin-pin)
const checkAdminPin = (req, res, next) => {
  const pin = req.headers['x-admin-pin'] || req.query.pin;
  if (!pin || pin !== ADMIN_PIN) {
    return res.status(401).json({ error: 'PIN Admin tidak valid atau belum diisi.' });
  }
  next();
};

// --- AUTH ROUTE ---
app.post('/api/verify-pin', (req, res) => {
  const { pin } = req.body;
  if (pin === ADMIN_PIN) {
    return res.json({ success: true, message: 'PIN terverifikasi' });
  }
  return res.status(401).json({ success: false, error: 'PIN Admin salah' });
});

// --- PARTNERS API ---
app.get('/api/partners', (req, res) => {
  try {
    const partners = dbHelper.getAllPartners();
    res.json(partners);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/partners', (req, res) => {
  try {
    const { name, phone } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Nama partner wajib diisi.' });
    }
    const partner = dbHelper.createPartner(name, phone);
    res.status(201).json(partner);
  } catch (err) {
    if (err.message.includes('UNIQUE')) {
      return res.status(400).json({ error: 'Partner dengan nama tersebut sudah ada.' });
    }
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/partners/:id', (req, res) => {
  try {
    dbHelper.deletePartner(req.params.id);
    res.json({ success: true, message: 'Partner berhasil dihapus' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- TRANSACTIONS API ---
app.get('/api/transactions', (req, res) => {
  try {
    const { status, partner, search, startDate, endDate } = req.query;
    const transactions = dbHelper.getTransactions({ status, partner, search, startDate, endDate });
    res.json(transactions);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/transactions/:id', (req, res) => {
  try {
    const tx = dbHelper.getTransactionById(req.params.id);
    if (!tx) return res.status(404).json({ error: 'Transaksi tidak ditemukan' });
    res.json(tx);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Submit Transaksi (Bisa dari Form Partner ataupun Admin)
app.post('/api/transactions', (req, res) => {
  try {
    const { partner_name, store_name, order_id, item_description, buy_price, payment_method, notes } = req.body;

    if (!partner_name || !store_name || !order_id || !item_description || buy_price === undefined) {
      return res.status(400).json({ 
        error: 'Semua kolom wajib diisi (Nama Partner, Nama Toko, ID Pemesanan, Barang & Warna, Harga Beli).' 
      });
    }

    // Auto-create partner if not exists yet
    let existingPartner = dbHelper.getPartnerByCodeOrName(partner_name);
    let partner_id = existingPartner ? existingPartner.id : null;
    if (!existingPartner) {
      try {
        const created = dbHelper.createPartner(partner_name);
        partner_id = created.id;
      } catch (e) {
        // ignore unique error if concurrent
      }
    }

    const tx = dbHelper.createTransaction({
      partner_id,
      partner_name: partner_name.trim(),
      store_name: store_name.trim(),
      order_id: order_id.trim(),
      item_description: item_description.trim(),
      buy_price,
      payment_method: payment_method ? payment_method.trim() : '',
      notes: notes || ''
    });

    res.status(201).json({ success: true, message: 'Data berhasil disimpan!', data: tx });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update Transaksi (Harga Jual, Status Pembayaran, dsb.)
app.patch('/api/transactions/:id', (req, res) => {
  try {
    const updated = dbHelper.updateTransaction(req.params.id, req.body);
    if (!updated) return res.status(404).json({ error: 'Transaksi tidak ditemukan' });
    res.json({ success: true, message: 'Transaksi berhasil diupdate', data: updated });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Hapus Transaksi
app.delete('/api/transactions/:id', (req, res) => {
  try {
    dbHelper.deleteTransaction(req.params.id);
    res.json({ success: true, message: 'Transaksi berhasil dihapus' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Batch Pay - Bayar semua unit pending milik 1 partner
app.post('/api/transactions/batch-pay', (req, res) => {
  try {
    const { partner_name } = req.body;
    if (!partner_name) {
      return res.status(400).json({ error: 'Nama partner wajib disertakan.' });
    }
    const result = dbHelper.batchPayPartner(partner_name);
    res.json({ 
      success: true, 
      message: `Berhasil menandai ${result.changes} transaksi untuk ${partner_name} sebagai Sudah Dibayar.` 
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Statistik Ringkasan Profit & Payout
app.get('/api/stats', (req, res) => {
  try {
    const stats = dbHelper.getStats();
    res.json(stats);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Export Data ke format CSV
app.get('/api/export-csv', (req, res) => {
  try {
    const transactions = dbHelper.getTransactions();
    
    // Header CSV lengkap memuat seluruh input partner & admin
    const headers = [
       'Timestamp Input', 'Nama Partner', 'Nama Toko', 'ID Pemesanan', 
       'Barang dan Warna', 'Metode Pembayaran', 'Harga Beli (Rp)', 'Harga Jual (Rp)', 
       'Profit (Rp)', 'Status Pembayaran', 'Tanggal Dibayar', 'Catatan'
    ];

    const escapeCsv = (str) => {
      if (str === null || str === undefined) return '""';
      const s = String(str).replace(/"/g, '""');
      return `"${s}"`;
    };

    const rows = transactions.map(t => [
      escapeCsv(t.created_at),
      escapeCsv(t.partner_name),
      escapeCsv(t.store_name),
      escapeCsv(t.order_id),
      escapeCsv(t.item_description),
      escapeCsv(t.payment_method || '-'),
      t.buy_price,
      t.sell_price,
      t.profit,
      escapeCsv(t.payment_status),
      escapeCsv(t.paid_at || '-'),
      escapeCsv(t.notes || '')
    ].join(','));

    // UTF-8 BOM so Microsoft Excel renders accented/Indonesian characters properly
    const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\r\n');

    const filename = `data-iphone-partner-${new Date().toISOString().slice(0, 10)}.csv`;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csvContent);
  } catch (err) {
    res.status(500).send('Gagal mengekspor data: ' + err.message);
  }
});

// Direct link partner: /p/:code
app.get('/p/:code', (req, res) => {
  res.redirect(`/?p=${encodeURIComponent(req.params.code)}`);
});

// Page routes
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

app.get('/partner', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`=========================================`);
  console.log(`🍎 iPhone Partner System Aktif!`);
  console.log(`- Portal Partner:  http://localhost:${PORT}`);
  console.log(`- Dashboard Admin: http://localhost:${PORT}/admin`);
  console.log(`- Default PIN:     ${ADMIN_PIN}`);
  console.log(`=========================================`);
});
