let currentStatusFilter = 'all';
let currentPartnerFilter = 'all';
let currentSearch = '';
let partners = [];
let allTransactions = [];

function formatRupiah(val) {
  const num = parseInt(val, 10);
  if (isNaN(num)) return '0';
  return new Intl.NumberFormat('id-ID').format(num);
}

document.addEventListener('DOMContentLoaded', () => {
  if (window.lucide) lucide.createIcons();

  initAuth();
  setupEventListeners();
});

// --- AUTHENTICATION ---
function initAuth() {
  const savedPin = sessionStorage.getItem('iphone_admin_pin');
  if (savedPin) {
    document.getElementById('pinModal').classList.add('hidden');
    loadData();
  } else {
    document.getElementById('pinModal').classList.remove('hidden');
    document.getElementById('inputPin').focus();
  }

  document.getElementById('pinForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const pin = document.getElementById('inputPin').value;
    try {
      const res = await fetch('/api/verify-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        sessionStorage.setItem('iphone_admin_pin', pin);
        document.getElementById('pinModal').classList.add('hidden');
        document.getElementById('pinError').classList.add('hidden');
        loadData();
      } else {
        document.getElementById('pinError').classList.remove('hidden');
      }
    } catch (err) {
      alert('Gagal menghubungi server.');
    }
  });

  document.getElementById('btnLockAdmin').addEventListener('click', () => {
    sessionStorage.removeItem('iphone_admin_pin');
    location.reload();
  });
}

function loadData() {
  fetchPartners();
  fetchTransactions();
}

function setupEventListeners() {
  // Status filter buttons
  document.querySelectorAll('.filter-status-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('.filter-status-btn').forEach(b => {
        b.classList.remove('bg-white', 'text-indigo-600', 'shadow-2xs');
        b.classList.add('text-slate-600');
      });
      btn.classList.add('bg-white', 'text-indigo-600', 'shadow-2xs');
      btn.classList.remove('text-slate-600');

      currentStatusFilter = btn.getAttribute('data-status');
      fetchTransactions();
    });
  });

  // Partner filter
  document.getElementById('filterPartner').addEventListener('change', (e) => {
    currentPartnerFilter = e.target.value;
    fetchTransactions();
  });

  // Search input debounce
  let searchTimeout;
  document.getElementById('filterSearch').addEventListener('input', (e) => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      currentSearch = e.target.value.trim();
      fetchTransactions();
    }, 300);
  });

  // Refresh
  document.getElementById('btnRefresh').addEventListener('click', () => {
    loadData();
  });

  // Partner Modal
  document.getElementById('btnOpenPartnersModal').addEventListener('click', () => {
    openPartnersModal();
  });
  document.getElementById('btnClosePartnersModal').addEventListener('click', () => {
    document.getElementById('partnersModal').classList.add('hidden');
  });

  // Add Partner Form
  document.getElementById('formAddPartner').addEventListener('submit', handleAddPartner);

  // Detail Modal Actions
  document.getElementById('btnCloseDetailModal').addEventListener('click', () => {
    document.getElementById('detailTxModal').classList.add('hidden');
  });
  document.getElementById('btnCancelDetailModal').addEventListener('click', () => {
    document.getElementById('detailTxModal').classList.add('hidden');
  });
  document.getElementById('formDetailTx').addEventListener('submit', handleSaveDetailTx);
  document.getElementById('btnDeleteTxFromModal').addEventListener('click', () => {
    const id = document.getElementById('modalTxId').value;
    if (id) deleteTransaction(id);
  });
}

// --- TRANSAKSI & TABEL SEDERHANA ---
async function fetchTransactions() {
  const tbody = document.getElementById('transactionTableBody');
  tbody.innerHTML = '<tr><td colspan="8" class="py-8 text-center text-slate-400">Memuat data...</td></tr>';

  try {
    const params = new URLSearchParams();
    if (currentStatusFilter !== 'all') params.append('status', currentStatusFilter);
    if (currentPartnerFilter !== 'all') params.append('partner', currentPartnerFilter);
    if (currentSearch) params.append('search', currentSearch);

    const res = await fetch(`/api/transactions?${params.toString()}`);
    allTransactions = await res.json();

    renderTransactionsTable(allTransactions);
  } catch (err) {
    tbody.innerHTML = '<tr><td colspan="8" class="py-8 text-center text-rose-500">Gagal memuat transaksi.</td></tr>';
  }
}

function renderTransactionsTable(data) {
  const tbody = document.getElementById('transactionTableBody');
  document.getElementById('tableCountInfo').textContent = `Menampilkan ${data.length} transaksi`;

  if (!data || data.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8" class="py-12 text-center text-slate-400">
          <i data-lucide="inbox" class="w-7 h-7 mx-auto mb-2 text-slate-300"></i>
          Tidak ada data transaksi yang sesuai filter.
        </td>
      </tr>
    `;
    if (window.lucide) lucide.createIcons();
    return;
  }

  tbody.innerHTML = data.map((tx) => {
    const isPaid = tx.payment_status === 'Sudah';
    const profitColor = tx.profit > 0 ? 'text-emerald-600 font-bold' : (tx.profit < 0 ? 'text-rose-600 font-bold' : 'text-slate-400');
    
    // Status button
    const statusBtn = isPaid 
      ? `<button onclick="togglePaymentStatus(${tx.id}, 'Belum')" class="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 hover:bg-emerald-200 transition" title="Klik untuk ubah ke Belum Dibayar">
           <i data-lucide="check-check" class="w-3.5 h-3.5"></i> Sudah Dibayar
         </button>`
      : `<button onclick="togglePaymentStatus(${tx.id}, 'Sudah')" class="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 hover:bg-amber-200 transition" title="Klik untuk tandai Sudah Dibayar">
           <i data-lucide="clock" class="w-3.5 h-3.5"></i> Belum Dibayar
         </button>`;

    return `
      <tr class="hover:bg-slate-50 transition" id="tx-row-${tx.id}">
        <!-- 1. Tanggal Input -->
        <td class="py-3.5 px-4 text-slate-600 font-mono text-xs">
          ${tx.created_at ? tx.created_at.substring(0, 16) : '-'}
        </td>

        <!-- 2. Nama Partner -->
        <td class="py-3.5 px-4 font-bold text-slate-900">
          <span class="inline-block px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-700 text-xs font-semibold">
            ${tx.partner_name}
          </span>
        </td>

        <!-- 3. Barang dan Warna -->
        <td class="py-3.5 px-4 font-bold text-slate-800">
          ${tx.item_description}
        </td>

        <!-- 4. Harga Beli -->
        <td class="py-3.5 px-4 text-right font-mono font-medium text-slate-700">
          Rp ${formatRupiah(tx.buy_price)}
        </td>
        
        <!-- 4. Harga Jual (Inline Edit) -->
        <td class="py-2.5 px-4 text-right bg-indigo-50/30 border-l border-indigo-100">
          <div class="relative inline-flex items-center">
            <span class="text-xs text-slate-400 mr-1 font-mono">Rp</span>
            <input 
              type="text" 
              value="${formatRupiah(tx.sell_price)}" 
              data-id="${tx.id}"
              data-buy="${tx.buy_price}"
              class="inline-sell-price text-right font-mono font-bold text-indigo-950 w-28 px-2.5 py-1 rounded border border-indigo-200 bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500 text-xs"
              placeholder="0"
              onfocus="this.select()"
              oninput="handleInlineSellPriceInput(this)"
              onchange="saveInlineSellPrice(this)"
            >
            <span id="saved-badge-${tx.id}" class="hidden ml-1 text-emerald-600 font-bold text-xs">✓</span>
          </div>
        </td>

        <!-- 5. Profit -->
        <td class="py-3.5 px-4 text-right font-mono bg-indigo-50/30 ${profitColor}" id="profit-cell-${tx.id}">
          Rp ${formatRupiah(tx.profit)}
        </td>

        <!-- 6. Validasi / Status Bayar -->
        <td class="py-3.5 px-4 text-center bg-indigo-50/30 border-r border-indigo-100">
          ${statusBtn}
        </td>

        <!-- 7. Aksi -->
        <td class="py-3.5 px-4 text-center">
          <div class="flex items-center justify-center gap-2">
            <button onclick="openDetailModal(${tx.id})" title="Lihat Rincian / Edit" class="p-1.5 rounded-lg text-indigo-600 hover:bg-indigo-50 transition flex items-center gap-1 font-semibold text-xs">
              <i data-lucide="eye" class="w-3.5 h-3.5"></i>
              <span>Rincian</span>
            </button>
            <button onclick="deleteTransaction(${tx.id})" title="Hapus" class="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition">
              <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');

  if (window.lucide) lucide.createIcons();
}

// Inline input formatting
function handleInlineSellPriceInput(input) {
  const clean = input.value.replace(/\D/g, '');
  input.value = clean ? formatRupiah(clean) : '';
  
  const txId = input.getAttribute('data-id');
  const buyPrice = parseInt(input.getAttribute('data-buy'), 10) || 0;
  const sellPrice = parseInt(clean, 10) || 0;
  const profit = sellPrice > 0 ? (sellPrice - buyPrice) : 0;

  const cell = document.getElementById(`profit-cell-${txId}`);
  if (cell) {
    cell.textContent = `Rp ${formatRupiah(profit)}`;
    cell.className = `py-3.5 px-4 text-right font-mono bg-indigo-50/30 ${profit > 0 ? 'text-emerald-600 font-bold' : (profit < 0 ? 'text-rose-600 font-bold' : 'text-slate-400')}`;
  }
}

// Simpan Harga Jual saat blur/enter
async function saveInlineSellPrice(input) {
  const txId = input.getAttribute('data-id');
  const clean = input.value.replace(/\D/g, '');
  const sellPrice = parseInt(clean, 10) || 0;

  try {
    const res = await fetch(`/api/transactions/${txId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sell_price: sellPrice })
    });

    if (!res.ok) throw new Error('Gagal menyimpan harga jual');

    const badge = document.getElementById(`saved-badge-${txId}`);
    if (badge) {
      badge.classList.remove('hidden');
      setTimeout(() => badge.classList.add('hidden'), 2000);
    }
  } catch (err) {
    alert(err.message);
  }
}

// Toggle status pembayaran langsung dari tabel
async function togglePaymentStatus(id, newStatus) {
  try {
    const res = await fetch(`/api/transactions/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ payment_status: newStatus })
    });

    if (!res.ok) throw new Error('Gagal memperbarui status pembayaran');
    fetchTransactions();
  } catch (err) {
    alert(err.message);
  }
}

// Hapus Transaksi
async function deleteTransaction(id) {
  if (!confirm('Apakah Anda yakin ingin menghapus transaksi ini?')) return;

  try {
    const res = await fetch(`/api/transactions/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Gagal menghapus');
    
    document.getElementById('detailTxModal').classList.add('hidden');
    fetchTransactions();
  } catch (err) {
    alert(err.message);
  }
}

// --- MODAL RINCIAN & EDIT ---
function openDetailModal(id) {
  const tx = allTransactions.find(t => t.id === id);
  if (!tx) return;

  document.getElementById('modalTxId').value = tx.id;
  document.getElementById('modalPartnerName').textContent = tx.partner_name;
  document.getElementById('modalStoreName').textContent = tx.store_name;
  document.getElementById('modalOrderId').textContent = tx.order_id;
  document.getElementById('modalPaymentMethod').textContent = tx.payment_method || '-';
  document.getElementById('modalItemDesc').textContent = tx.item_description;
  document.getElementById('modalCreatedAt').textContent = tx.created_at || '-';

  document.getElementById('modalBuyPrice').value = tx.buy_price;
  document.getElementById('modalSellPrice').value = tx.sell_price;
  document.getElementById('modalPaymentStatus').value = tx.payment_status;

  document.getElementById('detailTxModal').classList.remove('hidden');
}

async function handleSaveDetailTx(e) {
  e.preventDefault();

  const id = document.getElementById('modalTxId').value;
  const payload = {
    buy_price: parseInt(document.getElementById('modalBuyPrice').value, 10) || 0,
    sell_price: parseInt(document.getElementById('modalSellPrice').value, 10) || 0,
    payment_status: document.getElementById('modalPaymentStatus').value
  };

  try {
    const res = await fetch(`/api/transactions/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!res.ok) throw new Error('Gagal menyimpan perubahan');

    document.getElementById('detailTxModal').classList.add('hidden');
    fetchTransactions();
  } catch (err) {
    alert(err.message);
  }
}

// --- PARTNERS MANAGEMENT ---
async function fetchPartners() {
  try {
    const res = await fetch('/api/partners');
    partners = await res.json();

    const select = document.getElementById('filterPartner');
    select.innerHTML = '<option value="all">Semua Partner</option>';
    partners.forEach(p => {
      const opt = document.createElement('option');
      opt.value = p.name;
      opt.textContent = p.name;
      select.appendChild(opt);
    });

    renderPartnersModalList();
  } catch (err) {
    console.error('Gagal fetch partners:', err);
  }
}

function openPartnersModal() {
  renderPartnersModalList();
  document.getElementById('partnersModal').classList.remove('hidden');
}

function renderPartnersModalList() {
  const container = document.getElementById('partnerModalList');
  if (!partners || partners.length === 0) {
    container.innerHTML = '<div class="text-xs text-slate-400 py-2">Belum ada partner terdaftar.</div>';
    return;
  }

  const origin = window.location.origin;

  container.innerHTML = partners.map(p => {
    const partnerLink = `${origin}/p/${encodeURIComponent(p.code || p.name)}`;
    return `
      <div class="p-3 rounded-xl border border-slate-200 bg-white flex items-center justify-between gap-2 text-xs">
        <div>
          <div class="font-bold text-slate-800">${p.name}</div>
          <div class="text-[11px] text-slate-400 font-mono">${partnerLink}</div>
        </div>
        <div class="flex items-center gap-1.5 shrink-0">
          <button onclick="copyPartnerLink('${partnerLink}')" class="px-2.5 py-1.5 rounded-lg bg-indigo-50 text-indigo-700 hover:bg-indigo-100 font-semibold text-xs flex items-center gap-1">
            <i data-lucide="copy" class="w-3.5 h-3.5"></i> Salin Link
          </button>
          <button onclick="deletePartner(${p.id})" class="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg">
            <i data-lucide="trash" class="w-3.5 h-3.5"></i>
          </button>
        </div>
      </div>
    `;
  }).join('');

  if (window.lucide) lucide.createIcons();
}

function copyPartnerLink(url) {
  navigator.clipboard.writeText(url).then(() => {
    alert('Link form partner berhasil disalin!\n\nLink: ' + url + '\n\nBagikan link ini ke partner agar saat mereka membukanya, form langsung terkunci atas nama partner tersebut.');
  }).catch(() => {
    prompt('Salin link ini:', url);
  });
}

async function handleAddPartner(e) {
  e.preventDefault();
  const name = document.getElementById('addPartnerName').value.trim();

  try {
    const res = await fetch('/api/partners', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Gagal menambahkan partner');

    document.getElementById('addPartnerName').value = '';
    await fetchPartners();
  } catch (err) {
    alert(err.message);
  }
}

async function deletePartner(id) {
  if (!confirm('Hapus partner ini?')) return;
  try {
    await fetch(`/api/partners/${id}`, { method: 'DELETE' });
    await fetchPartners();
  } catch (err) {
    alert(err.message);
  }
}
