/**
 * Admin — ตามสั่ง at Laos
 * เพิ่ม: จัดการโต๊ะ (เปิด/ปิด + ออก token สำหรับ QR)
 * Login: Admin / 123456789
 */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getDatabase, ref, update, remove, onValue, get, set
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyAOkyKQA3GapMvPRwy4CsiKIb0kz6PvsUg",
  authDomain: "pos2laos.firebaseapp.com",
  databaseURL: "https://pos2laos-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "pos2laos",
  storageBucket: "pos2laos.firebasestorage.app",
  messagingSenderId: "610723590112",
  appId: "1:610723590112:web:1593c800edca5d8a9c4585"
};

const firebaseApp = initializeApp(firebaseConfig);
const db = getDatabase(firebaseApp);

// ==================== Config ====================
const ADMIN_USER = 'Admin';
const ADMIN_PASS = '123456789';
const AUTH_KEY   = 'pos2laos-admin-auth';
const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzCu36zqMJ-qsD0ZiKcxdfnnFOBrHFIprTrR3uaW4_EFzaSw3-hH8mQ0rhlIMkjNsXzSg/exec';
const TOTAL_TABLES = 20;

// ==================== DOM ====================
const loginScreen      = document.getElementById('loginScreen');
const dashboardScreen  = document.getElementById('dashboardScreen');
const loginForm        = document.getElementById('loginForm');
const usernameInput    = document.getElementById('username');
const passwordInput    = document.getElementById('password');
const loginError       = document.getElementById('loginError');
const ordersList       = document.getElementById('ordersList');
const ordersEmpty      = document.getElementById('ordersEmpty');
const logoutBtn        = document.getElementById('logoutBtn');
const todayOrderCount  = document.getElementById('todayOrderCount');
const todayTotal       = document.getElementById('todayTotal');
const tabRecent        = document.getElementById('tabRecent');
const tabHistory       = document.getElementById('tabHistory');
const tabTables        = document.getElementById('tabTables');
const historyContent   = document.getElementById('historyContent');
const historyEmpty     = document.getElementById('historyEmpty');
const tabQr            = document.getElementById('tabQr');
const clearDataBtn     = document.getElementById('clearDataBtn');
const clearDataModal   = document.getElementById('clearDataModal');
const clearDataCode    = document.getElementById('clearDataCode');
const clearDataError   = document.getElementById('clearDataError');
const clearDataCancel  = document.getElementById('clearDataCancel');
const clearDataConfirm = document.getElementById('clearDataConfirm');
const exportSheetBtn   = document.getElementById('exportSheetBtn');
const exportModal      = document.getElementById('exportModal');
const exportCancel     = document.getElementById('exportCancel');
const exportConfirm    = document.getElementById('exportConfirm');
const exportStatus     = document.getElementById('exportStatus');
const customDateRange  = document.getElementById('customDateRange');
const dateFrom         = document.getElementById('dateFrom');
const dateTo           = document.getElementById('dateTo');

// ==================== State ====================
let allOrders = [];
let tableStates = {}; // { 1: { status, token, openedAt }, ... }

// ==================== Auth ====================
function isLoggedIn() { return sessionStorage.getItem(AUTH_KEY) === 'true'; }
function setLoggedIn(v) { v ? sessionStorage.setItem(AUTH_KEY, 'true') : sessionStorage.removeItem(AUTH_KEY); }

function showScreen(screen) {
  loginScreen.classList.add('hidden');
  dashboardScreen.classList.add('hidden');
  screen.classList.remove('hidden');
}

// ==================== Helpers ====================
function formatMoney(n) { return '฿' + Number(n).toFixed(2); }
function formatDate(s) {
  return new Date(s).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' });
}
function formatDateOnly(s) {
  return new Date(s).toLocaleDateString('th-TH', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}
function getDateKey(s) { return new Date(s).toISOString().slice(0, 10); }
function isToday(s)    { return getDateKey(s) === new Date().toISOString().slice(0, 10); }
function isWithinLast30Days(s) {
  const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 30);
  return new Date(s) >= cutoff;
}

function generateToken() {
  return ([1e7]+-1e3+-4e3+-8e3+-1e11).replace(/[018]/g, c =>
    (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)
  );
}

// ==================== Firebase: Real-time ====================
function startRealtimeListener() {
  onValue(ref(db, 'orders'), (snapshot) => {
    allOrders = [];
    if (snapshot.exists()) {
      snapshot.forEach((child) => {
        allOrders.push({ firebaseKey: child.key, ...child.val() });
      });
      allOrders.sort((a, b) => new Date(b.date) - new Date(a.date));
    }
    renderDailySummary();
    renderOrders();
    renderHistory();
  });

  onValue(ref(db, 'tables'), (snapshot) => {
    tableStates = {};
    if (snapshot.exists()) {
      snapshot.forEach((child) => {
        tableStates[parseInt(child.key)] = child.val();
      });
    }
    renderTablesGrid();
  });
}

// ==================== Firebase: Order Actions ====================
async function markOrderAsPaid(firebaseKey) {
  await update(ref(db, `orders/${firebaseKey}`), { status: 'paid' });
}
async function deleteOrder(firebaseKey, orderNumber) {
  if (!confirm(`ลบออเดอร์ #${orderNumber} ?`)) return;
  await remove(ref(db, `orders/${firebaseKey}`));
}
async function clearAllOrders() {
  await remove(ref(db, 'orders'));
  await update(ref(db, 'meta'), { orderNumber: 1001, lastOrderDate: new Date().toISOString().slice(0, 10) });
  closeClearDataModal();
}

// ==================== Firebase: Table Actions ====================
async function openTable(tableNum) {
  // ดึง token เดิมถ้ามี — ถ้าไม่มีค่อยออกใหม่
  const snap = await get(ref(db, `tables/${tableNum}`));
  const existing = snap.exists() ? snap.val() : {};
  const token = existing.token || generateToken(); // ใช้ token เดิมถ้ามี
  await set(ref(db, `tables/${tableNum}`), {
    status: 'open',
    token,
    openedAt: new Date().toISOString(),
  });
}

async function closeTable(tableNum) {
  await update(ref(db, `tables/${tableNum}`), {
    status: 'closed',
    closedAt: new Date().toISOString(),
  });
}

// ==================== Render: Summary ====================
function renderDailySummary() {
  const paidToday = allOrders.filter((o) => o.status === 'paid' && isToday(o.date));
  todayOrderCount.textContent = paidToday.length;
  todayTotal.textContent = formatMoney(paidToday.reduce((s, o) => s + o.total, 0));
}

// ==================== Render: Orders ====================
function renderOrders() {
  if (allOrders.length === 0) {
    ordersList.innerHTML = '';
    ordersList.classList.add('hidden');
    ordersEmpty.classList.remove('hidden');
    return;
  }
  ordersEmpty.classList.add('hidden');
  ordersList.classList.remove('hidden');
  ordersList.innerHTML = allOrders.map((order) => {
    const isPending = order.status === 'pending';
    return `
      <article class="order-card" data-key="${order.firebaseKey}">
        <div class="order-card-header">
          <div class="order-card-header-row">
            <h3 class="order-card-title">ออเดอร์ #${order.orderNumber}${order.table ? ` <span class="order-table-chip">โต๊ะ ${order.table}</span>` : ''}</h3>
            <span class="status-badge ${isPending ? 'pending' : 'paid'}">${isPending ? '⏳ รอจ่าย' : '✅ จ่ายแล้ว'}</span>
          </div>
          <div class="order-card-header-row">
            <span class="order-card-date">${formatDate(order.date)}</span>
            <div class="order-actions">
              ${isPending ? `<button type="button" class="btn-paid" data-key="${order.firebaseKey}">จ่ายแล้ว</button>` : ''}
              <button type="button" class="btn-delete" data-key="${order.firebaseKey}" data-num="${order.orderNumber}">ลบ</button>
            </div>
          </div>
        </div>
        <div class="order-card-body">
          <ul class="order-items">
            ${(order.items || []).map((i) =>
              `<li class="order-item"><span>${i.name} × ${i.qty}</span><span>${formatMoney(i.price * i.qty)}</span></li>`
            ).join('')}
          </ul>
          <div class="order-total-row">
            <span>รวมทั้งหมด</span>
            <span>${formatMoney(order.total)}</span>
          </div>
        </div>
      </article>`;
  }).join('');

  ordersList.querySelectorAll('.btn-paid').forEach((btn) => {
    btn.addEventListener('click', () => markOrderAsPaid(btn.dataset.key));
  });
  ordersList.querySelectorAll('.btn-delete').forEach((btn) => {
    btn.addEventListener('click', () => deleteOrder(btn.dataset.key, btn.dataset.num));
  });
}

// ==================== Render: History ====================
function renderHistory() {
  const paidLast30 = allOrders.filter((o) => o.status === 'paid' && isWithinLast30Days(o.date));
  if (paidLast30.length === 0) {
    historyContent.innerHTML = '';
    historyContent.classList.add('hidden');
    historyEmpty.classList.remove('hidden');
    return;
  }
  historyEmpty.classList.add('hidden');
  historyContent.classList.remove('hidden');

  const byDay = {};
  paidLast30.forEach((o) => {
    const key = getDateKey(o.date);
    if (!byDay[key]) byDay[key] = { date: o.date, orders: [], total: 0 };
    byDay[key].orders.push(o);
    byDay[key].total += o.total;
  });

  historyContent.innerHTML = Object.keys(byDay).sort((a, b) => b.localeCompare(a)).map((key) => {
    const day = byDay[key];
    return `
      <section class="history-day">
        <div class="history-day-header">
          <span class="history-day-date">${formatDateOnly(day.date)}</span>
          <div class="history-day-summary">
            <span class="history-day-count">${day.orders.length} ออเดอร์</span>
            <span class="history-day-total">${formatMoney(day.total)}</span>
          </div>
        </div>
        <div class="history-day-body">
          <ul class="history-orders">
            ${day.orders.map((o) =>
              `<li class="history-order-row"><span>ออเดอร์ #${o.orderNumber} · ${formatDate(o.date)}</span><span>${formatMoney(o.total)}</span></li>`
            ).join('')}
          </ul>
        </div>
      </section>`;
  }).join('');
}

// ==================== Render: Tables Grid ====================
function renderTablesGrid() {
  const grid = document.getElementById('tablesGrid');
  if (!grid) return;

  const baseUrl = (window.location.href.replace('admin.html', 'index.html').split('?')[0]);

  grid.innerHTML = Array.from({ length: TOTAL_TABLES }, (_, i) => {
    const n = i + 1;
    const t = tableStates[n] || { status: 'closed' };
    const isOpen = t.status === 'open';
    const qrUrl  = isOpen ? `${baseUrl}?table=${n}&token=${t.token}` : '';
    const openedAgo = isOpen && t.openedAt
      ? `เปิดเมื่อ ${new Date(t.openedAt).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}`
      : '';

    return `
      <div class="table-mgmt-card ${isOpen ? 'open' : 'closed'}">
        <div class="table-mgmt-header">
          <span class="table-mgmt-num">โต๊ะ ${n}</span>
          <span class="table-mgmt-status ${isOpen ? 'open' : 'closed'}">${isOpen ? '🟢 เปิด' : '⭕ ปิด'}</span>
        </div>
        ${openedAgo ? `<p class="table-mgmt-time">${openedAgo}</p>` : ''}
        <div class="table-mgmt-actions">
          ${isOpen
            ? `<button class="btn btn-sm btn-outline-danger" data-close="${n}">ปิดโต๊ะ</button>
               <button class="btn btn-sm btn-outline" data-qr="${n}" data-url="${qrUrl}">📋 คัดลอก URL</button>`
            : `<button class="btn btn-sm btn-green" data-open="${n}">เปิดโต๊ะ</button>`
          }
        </div>
      </div>`;
  }).join('');

  grid.querySelectorAll('[data-open]').forEach(btn => {
    btn.addEventListener('click', async () => {
      btn.disabled = true;
      await openTable(parseInt(btn.dataset.open));
    });
  });
  grid.querySelectorAll('[data-close]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const n = parseInt(btn.dataset.close);
      if (!confirm(`ปิดโต๊ะ ${n}? ลูกค้าที่ยังสั่งอยู่จะไม่สามารถสั่งต่อได้`)) return;
      btn.disabled = true;
      await closeTable(n);
    });
  });
  grid.querySelectorAll('[data-qr]').forEach(btn => {
    btn.addEventListener('click', () => {
      const url = btn.dataset.url;
      if (!url) return;
      navigator.clipboard.writeText(url).then(() => {
        const orig = btn.textContent;
        btn.textContent = '✅ คัดลอกแล้ว!';
        setTimeout(() => { btn.textContent = orig; }, 2000);
      });
    });
  });
}

// ==================== Tabs ====================
function switchTab(tabId) {
  document.querySelectorAll('.tab-btn').forEach((t) =>
    t.classList.toggle('active', t.dataset.tab === tabId)
  );
  tabRecent.classList.toggle('hidden',   tabId !== 'recent');
  tabHistory.classList.toggle('hidden',  tabId !== 'history');
  tabTables.classList.toggle('hidden',   tabId !== 'tables');
  tabQr.classList.toggle('hidden',       tabId !== 'qr');
  if (tabId === 'qr') initQrTab();
}

// ==================== Auth Events ====================
function checkAuth() {
  if (isLoggedIn()) {
    showScreen(dashboardScreen);
    startRealtimeListener();
    switchTab('recent');
  } else {
    showScreen(loginScreen);
  }
}

loginForm.addEventListener('submit', (e) => {
  e.preventDefault();
  loginError.textContent = '';
  const user = usernameInput.value.trim();
  const pass = passwordInput.value;
  if (user === ADMIN_USER && pass === ADMIN_PASS) {
    setLoggedIn(true);
    showScreen(dashboardScreen);
    startRealtimeListener();
    switchTab('recent');
  } else {
    loginError.textContent = 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง';
    passwordInput.focus();
  }
});

logoutBtn.addEventListener('click', () => {
  setLoggedIn(false);
  showScreen(loginScreen);
  usernameInput.value = '';
  passwordInput.value = '';
  loginError.textContent = '';
});

document.querySelectorAll('.tab-btn').forEach((tab) => {
  tab.addEventListener('click', () => switchTab(tab.dataset.tab));
});

// ==================== Clear Data Modal ====================
function openClearDataModal() {
  clearDataError.textContent = '';
  clearDataCode.value = '';
  clearDataModal.setAttribute('aria-hidden', 'false');
  clearDataCode.focus();
}
function closeClearDataModal() {
  clearDataModal.setAttribute('aria-hidden', 'true');
  clearDataCode.value = '';
  clearDataError.textContent = '';
}

clearDataBtn.addEventListener('click', openClearDataModal);
clearDataCancel.addEventListener('click', closeClearDataModal);
clearDataModal.addEventListener('click', (e) => { if (e.target === clearDataModal) closeClearDataModal(); });

clearDataConfirm.addEventListener('click', async () => {
  clearDataError.textContent = '';
  const code = clearDataCode.value.trim();
  if (!code) { clearDataError.textContent = 'กรุณาใส่รหัส'; clearDataCode.focus(); return; }
  if (code !== ADMIN_PASS) { clearDataError.textContent = 'รหัสไม่ถูกต้อง'; clearDataCode.focus(); return; }
  if (confirm('ยืนยันล้างรายการสั่งซื้อทั้งหมดและรีเซ็ตหมายเลขออเดอร์เป็น 1001?')) {
    await clearAllOrders();
  }
});

// ==================== Export to Google Sheet ====================
function initDatePicker() {
  const today = new Date().toISOString().slice(0, 10);
  dateFrom.value = today;
  dateTo.value   = today;
}

document.querySelectorAll('input[name="exportRange"]').forEach(radio => {
  radio.addEventListener('change', () => {
    customDateRange.classList.toggle('hidden', radio.value !== 'custom');
  });
});

function openExportModal() {
  exportStatus.textContent = '';
  exportStatus.className   = 'export-status';
  exportConfirm.disabled   = false;
  exportConfirm.textContent = '📤 ส่งข้อมูล';
  document.querySelector('input[name="exportRange"][value="today"]').checked = true;
  customDateRange.classList.add('hidden');
  initDatePicker();
  exportModal.setAttribute('aria-hidden', 'false');
}
function closeExportModal() {
  exportModal.setAttribute('aria-hidden', 'true');
  exportStatus.textContent = '';
}

function isInDateRange(s, from, to) {
  const key = getDateKey(s); return key >= from && key <= to;
}
function getFilteredOrders(range) {
  if (range === 'today')  return allOrders.filter(o => isToday(o.date));
  if (range === 'month')  return allOrders.filter(o => isWithinLast30Days(o.date));
  if (range === 'custom') {
    if (!dateFrom.value || !dateTo.value) return [];
    return allOrders.filter(o => isInDateRange(o.date, dateFrom.value, dateTo.value));
  }
  return allOrders;
}
function buildSummary(orders) {
  const byDay = {};
  orders.filter(o => o.status === 'paid').forEach(o => {
    const key = getDateKey(o.date);
    if (!byDay[key]) byDay[key] = { date: key, orderCount: 0, total: 0 };
    byDay[key].orderCount++;
    byDay[key].total += o.total;
  });
  return Object.values(byDay).sort((a, b) => a.date.localeCompare(b.date));
}

exportSheetBtn.addEventListener('click', openExportModal);
exportCancel.addEventListener('click', closeExportModal);
exportModal.addEventListener('click', (e) => { if (e.target === exportModal) closeExportModal(); });

exportConfirm.addEventListener('click', async () => {
  const range = document.querySelector('input[name="exportRange"]:checked').value;
  if (range === 'custom') {
    if (!dateFrom.value || !dateTo.value) {
      exportStatus.textContent = '⚠️ กรุณาเลือกวันที่ให้ครบ';
      exportStatus.className   = 'export-status error'; return;
    }
    if (dateFrom.value > dateTo.value) {
      exportStatus.textContent = '⚠️ วันที่เริ่มต้องไม่เกินวันที่สิ้นสุด';
      exportStatus.className   = 'export-status error'; return;
    }
  }
  const orders = getFilteredOrders(range);
  if (orders.length === 0) {
    exportStatus.textContent = '⚠️ ไม่มีข้อมูลในช่วงที่เลือก';
    exportStatus.className   = 'export-status error'; return;
  }
  exportConfirm.disabled    = true;
  exportConfirm.textContent = 'กำลังส่ง...';
  exportStatus.textContent  = '';
  exportStatus.className    = 'export-status';

  try {
    const res    = await fetch(GOOGLE_SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({ orders, summary: buildSummary(orders) })
    });
    const result = await res.json();
    if (result.success) {
      exportStatus.textContent  = `✅ ส่งสำเร็จ! ${result.inserted} ออเดอร์ (ข้ามซ้ำ ${result.skipped} รายการ)`;
      exportStatus.className    = 'export-status success';
      exportConfirm.textContent = '✅ สำเร็จ';
    } else { throw new Error(result.error || 'Unknown error'); }
  } catch (err) {
    exportStatus.textContent  = '❌ เกิดข้อผิดพลาด: ' + err.message;
    exportStatus.className    = 'export-status error';
    exportConfirm.disabled    = false;
    exportConfirm.textContent = '📤 ส่งข้อมูล';
  }
});

// ==================== QR Code Tab ====================
let qrInstance    = null;
let qrInitialized = false;

function initQrTab() {
  if (qrInitialized) { generateQr(); return; }
  qrInitialized = true;

  const baseUrlInput = document.getElementById('qrBaseUrl');
  const tableSelect  = document.getElementById('qrTableSelect');

  const autoBase = window.location.href.replace('admin.html', 'index.html').split('?')[0];
  baseUrlInput.value = autoBase;

  for (let i = 1; i <= TOTAL_TABLES; i++) {
    const opt = document.createElement('option');
    opt.value = i; opt.textContent = `โต๊ะ ${i}`;
    tableSelect.appendChild(opt);
  }

  baseUrlInput.addEventListener('input', generateQr);
  tableSelect.addEventListener('change', generateQr);

  document.getElementById('qrDownloadBtn').addEventListener('click', downloadQr);
  document.getElementById('qrCopyLinkBtn').addEventListener('click', copyQrLink);

  generateQr();
}

async function getQrUrl() {
  const base  = (document.getElementById('qrBaseUrl').value || '').trim();
  const table = parseInt(document.getElementById('qrTableSelect').value);
  if (!base) return '';
  const t = tableStates[table];
  if (!t || t.status !== 'open') {
    // QR ไม่มี token — แสดง warning
    return null;
  }
  const url = new URL(base);
  url.searchParams.set('table', table);
  url.searchParams.set('token', t.token);
  return url.toString();
}

async function generateQr() {
  const canvasWrap = document.getElementById('qrCanvas');
  const table      = document.getElementById('qrTableSelect').value;
  const url        = await getQrUrl();

  document.getElementById('qrTableLabel').textContent = `โต๊ะ ${table}`;

  if (url === null) {
    document.getElementById('qrUrlText').textContent = '⚠️ โต๊ะนี้ยังไม่ได้เปิด — ไปที่แท็บ "โต๊ะ" เพื่อเปิดก่อน';
    canvasWrap.innerHTML = '<p class="qr-closed-msg">🔒 เปิดโต๊ะก่อนสร้าง QR</p>';
    return;
  }

  document.getElementById('qrUrlText').textContent = url || '— กรุณากรอก URL —';
  canvasWrap.innerHTML = '';
  if (!url) return;

  qrInstance = new QRCode(canvasWrap, {
    text: url, width: 200, height: 200,
    colorDark: '#3d2b1f', colorLight: '#ffffff',
    correctLevel: QRCode.CorrectLevel.H,
  });
}

async function downloadQr() {
  const table = document.getElementById('qrTableSelect').value;
  const img   = document.querySelector('#qrCanvas img');
  const canvas = document.querySelector('#qrCanvas canvas');
  const src   = img ? img.src : (canvas ? canvas.toDataURL() : null);
  if (!src) { alert('กรุณา generate QR ก่อน'); return; }
  const a = document.createElement('a');
  a.href = src; a.download = `qr-table-${table}.png`; a.click();
}

async function copyQrLink() {
  const url = await getQrUrl();
  if (!url) { alert('โต๊ะนี้ยังไม่ได้เปิด กรุณาเปิดโต๊ะก่อน'); return; }
  navigator.clipboard.writeText(url).then(() => {
    const btn = document.getElementById('qrCopyLinkBtn');
    const orig = btn.textContent;
    btn.textContent = '✅ คัดลอกแล้ว!';
    setTimeout(() => { btn.textContent = orig; }, 2000);
  });
}

// ==================== Init ====================
checkAuth();
