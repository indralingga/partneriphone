let currentPartner = '';
let partnersList = [];

// Format angka ke format Rupiah (cth: 10.998.000)
function formatRupiah(val) {
  const clean = String(val).replace(/\D/g, '');
  if (!clean) return '';
  return new Intl.NumberFormat('id-ID').format(clean);
}

// Convert angka rupiah ke teks terbilang ringkas
function terbilangRingkas(num) {
  num = parseInt(num, 10);
  if (!num || isNaN(num)) return '';
  if (num >= 1000000000) {
    return (num / 1000000000).toFixed(2).replace('.00', '') + ' Miliar Rupiah';
  }
  if (num >= 1000000) {
    return (num / 1000000).toFixed(2).replace('.00', '') + ' Juta Rupiah';
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1).replace('.0', '') + ' Ribu Rupiah';
  }
  return num + ' Rupiah';
}

document.addEventListener('DOMContentLoaded', async () => {
  if (window.lucide) lucide.createIcons();

  const buyPriceDisplay = document.getElementById('buy_price_display');
  const buyPriceHidden = document.getElementById('buy_price');
  const terbilangBeli = document.getElementById('terbilangBeli');

  // Input harga dengan format ribuan otomatis
  buyPriceDisplay.addEventListener('input', (e) => {
    const rawVal = e.target.value.replace(/\D/g, '');
    buyPriceHidden.value = rawVal;
    e.target.value = formatRupiah(rawVal);
    terbilangBeli.textContent = rawVal ? `≈ ${terbilangRingkas(rawVal)}` : '';
  });

  // Partner management via link khusus saja
  await fetchPartners();
  initPartnerIdentityFromLink();

  // Button actions
  document.getElementById('btnRefreshHistory').addEventListener('click', loadRecentHistory);

  // Form submit
  document.getElementById('transactionForm').addEventListener('submit', handleSubmitTransaction);
});

async function fetchPartners() {
  try {
    const res = await fetch('/api/partners');
    partnersList = await res.json();
  } catch (err) {
    console.error('Gagal mengambil daftar partner:', err);
  }
}

function initPartnerIdentityFromLink() {
  // Cek parameter URL: ?p=... atau ?partner=...
  const urlParams = new URLSearchParams(window.location.search);
  const paramCode = urlParams.get('p') || urlParams.get('partner');

  let chosen = '';

  if (paramCode) {
    // Cari kecocokan di partnersList berdasarkan code atau name
    const found = partnersList.find(p => p.code === paramCode.toLowerCase() || p.name.toLowerCase() === paramCode.toLowerCase());
    if (found) {
      chosen = found.name;
    } else {
      chosen = paramCode;
    }
  } else {
    // Cek apakah sebelumnya pernah buka link di perangkat ini
    const saved = localStorage.getItem('iphone_partner_name');
    if (saved) {
      chosen = saved;
    }
  }

  if (chosen) {
    setPartner(chosen);
    document.getElementById('missingPartnerAlert').classList.add('hidden');
    document.getElementById('btnSubmit').disabled = false;
  } else {
    // Tidak ada link khusus
    document.getElementById('currentPartnerDisplay').textContent = 'Belum Ada Link Khusus';
    document.getElementById('missingPartnerAlert').classList.remove('hidden');
    const btnSubmit = document.getElementById('btnSubmit');
    btnSubmit.disabled = true;
    btnSubmit.classList.add('opacity-50', 'cursor-not-allowed');
    document.getElementById('historyList').innerHTML = '<div class="text-center py-4 text-slate-400 text-xs">Gunakan link khusus partner untuk melihat riwayat.</div>';
  }
}

function setPartner(name) {
  currentPartner = name.trim();
  localStorage.setItem('iphone_partner_name', currentPartner);
  document.getElementById('currentPartnerDisplay').textContent = currentPartner;
  loadRecentHistory();
}

async function handleSubmitTransaction(e) {
  e.preventDefault();

  if (!currentPartner) {
    alert('Link khusus partner diperlukan untuk mengisi formulir.');
    return;
  }

  const storeName = document.getElementById('store_name').value.trim();
  const orderId = document.getElementById('order_id').value.trim();
  const itemDesc = document.getElementById('item_description').value.trim();
  const buyPrice = parseInt(document.getElementById('buy_price').value, 10);
  const paymentMethod = document.getElementById('payment_method').value.trim();

  if (!storeName || !orderId || !itemDesc || isNaN(buyPrice) || buyPrice <= 0) {
    alert('Mohon lengkapi semua data wajib bertanda bintang (*).');
    return;
  }

  const btnSubmit = document.getElementById('btnSubmit');
  const alertSuccess = document.getElementById('alertSuccess');
  const alertError = document.getElementById('alertError');

  btnSubmit.disabled = true;
  btnSubmit.innerHTML = `<span class="animate-spin mr-2">⏳</span> Mengirim Data...`;
  alertSuccess.classList.add('hidden');
  alertError.classList.add('hidden');

  try {
    const res = await fetch('/api/transactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        partner_name: currentPartner,
        store_name: storeName,
        order_id: orderId,
        item_description: itemDesc,
        buy_price: buyPrice,
        payment_method: paymentMethod
      })
    });

    const result = await res.json();

    if (!res.ok) {
      throw new Error(result.error || 'Gagal menyimpan transaksi');
    }

    // Reset Form (kecuali partner name)
    document.getElementById('transactionForm').reset();
    document.getElementById('buy_price').value = '0';
    document.getElementById('terbilangBeli').textContent = '';

    // Success banner
    alertSuccess.classList.remove('hidden');
    setTimeout(() => {
      alertSuccess.classList.add('hidden');
    }, 6000);

    // Refresh Riwayat
    await loadRecentHistory();
  } catch (err) {
    document.getElementById('errorMessage').textContent = err.message;
    alertError.classList.remove('hidden');
  } finally {
    btnSubmit.disabled = false;
    btnSubmit.innerHTML = `
      <i data-lucide="send" class="w-4 h-4"></i>
      <span>Kirim Transaksi</span>
    `;
    if (window.lucide) lucide.createIcons();
  }
}

async function loadRecentHistory() {
  const container = document.getElementById('historyList');
  if (!currentPartner) return;

  container.innerHTML = '<div class="text-center py-4 text-slate-400 text-xs">Memuat riwayat...</div>';

  try {
    const res = await fetch(`/api/transactions?partner=${encodeURIComponent(currentPartner)}`);
    const data = await res.json();

    if (!data || data.length === 0) {
      container.innerHTML = `
        <div class="text-center py-6 text-slate-400 text-xs">
          Belum ada transaksi yang diinput untuk partner <b>${currentPartner}</b>.
        </div>
      `;
      return;
    }

    // Ambil max 8 transaksi terakhir
    const recent = data.slice(0, 8);
    container.innerHTML = recent.map(tx => {
      const isPaid = tx.payment_status === 'Sudah';
      const statusBadge = isPaid 
        ? `<span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
             <i data-lucide="check-circle" class="w-3.5 h-3.5"></i> Sudah Dibayar
           </span>`
        : `<span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
             <i data-lucide="clock" class="w-3.5 h-3.5"></i> Belum Dibayar
           </span>`;

      return `
        <div class="p-3.5 rounded-xl border border-slate-100 bg-slate-50/50 hover:bg-slate-50 transition flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div class="space-y-1">
            <div class="flex items-center gap-2">
              <span class="font-bold text-slate-800 text-sm">${tx.item_description}</span>
              <span class="text-xs text-slate-400 font-mono">#${tx.order_id}</span>
            </div>
            <div class="text-xs text-slate-500 flex flex-wrap items-center gap-x-3 gap-y-1">
              <span>Toko: <b>${tx.store_name}</b></span>
              <span>Beli: <b>Rp ${formatRupiah(tx.buy_price)}</b></span>
              ${tx.payment_method ? `<span>Bayar: <b>${tx.payment_method}</b></span>` : ''}
              <span class="text-slate-400">${tx.created_at}</span>
            </div>
          </div>
          <div class="shrink-0 flex items-center justify-end">
            ${statusBadge}
          </div>
        </div>
      `;
    }).join('');

    if (window.lucide) lucide.createIcons();
  } catch (err) {
    container.innerHTML = '<div class="text-center py-4 text-rose-500 text-xs">Gagal memuat riwayat.</div>';
  }
}
