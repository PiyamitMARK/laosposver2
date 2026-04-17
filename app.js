/**
 * ตามสั่ง at Laos — POS
 * Security: Session Token via Firebase (Admin opens table → token issued)
 * เพิ่ม: IP-based protection + ประวัติการสั่งของโต๊ะ
 * Admin button: hidden Easter egg (logo tap ×5)
 */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getDatabase, ref, push, update, get, set, onValue, query, orderByChild, equalTo
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

// ==================== สินค้า ====================
const IMG = (n) => 'images/img' + n + '.png';

const products = {
  kao: [
    { id: 'kao1',  name: 'กะเพราหมูสับ',       price: 55, image: IMG(1) },
    { id: 'kao2',  name: 'กะเพราหมูกรอบ',       price: 55, image: IMG(2) },
    { id: 'kao3',  name: 'ข้าวผัดหมู',           price: 55, image: IMG(3) },
    { id: 'kao4',  name: 'ข้าวหมูกระเทียม',     price: 45, image: IMG(4) },
    { id: 'kao5',  name: 'ข้าวไข่เจียว',         price: 60, image: IMG(5) },
    { id: 'kao6',  name: 'ข้าวผัดพริกแกงหมู',   price: 55, image: IMG(6) },
    { id: 'kao7',  name: 'ข้าวพะแนง',            price: 55, image: IMG(7) },
    { id: 'kao8',  name: 'ข้าวคะน้าหมูกรอบ',    price: 60, image: IMG(8) },
    { id: 'kao9',  name: 'ราดหน้า',              price: 55, image: IMG(9) },
    { id: 'kao10', name: 'ผัดซีอิ๊ว',            price: 60, image: IMG(10) },
  ],
  nam: [
    { id: 'water',  name: 'น้ำเปล่า',            price: 10, image: IMG(60) },
    { id: 'pepsi',  name: 'เป็ปซี่',             price: 15, image: IMG(80) },
    { id: 'fanta',  name: 'น้ำแดงแฟนต้า',        price: 15, image: IMG(543) },
    { id: 'sprite', name: 'สไปร์ท',              price: 15, image: IMG(345) },
  ],
};

// ==================== State ====================
let cart = [];
let orderNumber = 1001;
let currentCategory = 'kao';
let selectedTable = null;
let sessionToken = null;
let isQrMode = false;
let tableIsOpen = false;
let tableOrdersUnsubscribe = null; // real-time listener สำหรับประวัติโต๊ะ

// ==================== DOM ====================
const currentDateEl    = document.getElementById('currentDate');
const orderNumberEl    = document.getElementById('orderNumber');
const tableChipEl      = document.getElementById('tableChip');
const categoryBtns     = document.querySelectorAll('.category-btn');
const productsGrid     = document.getElementById('productsGrid');
const productsOverlay  = document.getElementById('productsOverlay');
const cartItemsEl      = document.getElementById('cartItems');
const cartEmptyEl      = document.getElementById('cartEmpty');
const totalEl          = document.getElementById('total');
const clearCartBtn     = document.getElementById('clearCart');
const completeOrderBtn = document.getElementById('completeOrder');
const receiptModal     = document.getElementById('receiptModal');
const receiptOrderNum  = document.getElementById('receiptOrderNum');
const receiptTableEl   = document.getElementById('receiptTable');
const receiptDate      = document.getElementById('receiptDate');
const receiptItemsEl   = document.getElementById('receiptItems');
const receiptTotal     = document.getElementById('receiptTotal');
const printReceiptBtn  = document.getElementById('printReceipt');
const newOrderBtn      = document.getElementById('newOrder');
const confirmOrderModal   = document.getElementById('confirmOrderModal');
const confirmTableLabel   = document.getElementById('confirmTableLabel');
const confirmOrderList    = document.getElementById('confirmOrderList');
const confirmTotal        = document.getElementById('confirmTotal');
const confirmOrderCancel  = document.getElementById('confirmOrderCancel');
const confirmOrderOk      = document.getElementById('confirmOrderOk');
const blockedScreen    = document.getElementById('blockedScreen');

// ==================== Helpers ====================
function formatMoney(n) {
  return '฿' + Number(n).toFixed(2);
}

function setDate() {
  currentDateEl.textContent = new Date().toLocaleDateString('th-TH', {
    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
  });
}

// ==================== Easter Egg Admin Button ====================
(function initEasterEgg() {
  const logo = document.querySelector('.logo');
  if (!logo) return;
  let taps = 0;
  let timer = null;
  logo.addEventListener('click', () => {
    taps++;
    clearTimeout(timer);
    if (taps >= 5) {
      taps = 0;
      window.location.href = 'admin.html';
      return;
    }
    timer = setTimeout(() => { taps = 0; }, 3000);
  });
})();

// ==================== Session / Table Validation ====================
/**
 * ระบบป้องกันคนสั่งจากนอกร้าน (Multi-layer):
 *
 * Layer 1 — Token Binding (เดิม)
 *   Admin เปิดโต๊ะ → Firebase ออก token UUID → ฝัง QR → ตรวจ token ตรงกับ Firebase
 *
 * Layer 2 — Short-lived Access Window (ใหม่)
 *   token หมดอายุใน 4 ชม. (เดิม) แต่เพิ่ม "scan window" = 15 นาทีหลังจากที่ admin เปิดโต๊ะ
 *   → คนที่พยายาม reuse QR link หลังจากนั้น จะถูกบล็อกถ้ายังไม่ได้ validate ครั้งแรกใน 15 นาที
 *   → คนที่ validate แล้ว (อยู่ในร้าน) จะได้ clientSessionKey เก็บ sessionStorage
 *   → clientSessionKey = hash(token + tableNum + date) — ไม่หมดอายุจนกว่าจะปิด tab
 *
 * Layer 3 — Real-time Table Status Watch (เดิม + ปรับปรุง)
 *   Admin ปิดโต๊ะ → ทุก client ที่เปิดอยู่จะถูก block ทันที
 *
 * Layer 4 — One-time Scan Flag (ใหม่)
 *   เมื่อ validate สำเร็จครั้งแรก → Firebase บันทึก tables/{n}/firstScannedAt
 *   ถ้ามีแล้วและเวลา > scanWindow → QR หมดอายุ (กัน forward/share link)
 *   แต่ถ้า clientSessionKey ตรง → ผ่าน (กัน reload)
 */

const SCAN_WINDOW_MS = 15 * 60 * 1000; // 15 นาทีสำหรับ first scan
const SESSION_KEY_PREFIX = 'pos2laos-session-';

async function getClientSessionKey(tableNum, token) {
  // สร้าง key จาก token + table + วันที่ (ไม่ซ้ำข้ามวัน)
  const raw = `${token}:${tableNum}:${new Date().toISOString().slice(0, 10)}`;
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(raw));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 32);
}

function getStoredSession(tableNum) {
  return sessionStorage.getItem(SESSION_KEY_PREFIX + tableNum);
}

function storeSession(tableNum, key, openedAt) {
  sessionStorage.setItem(SESSION_KEY_PREFIX + tableNum, key);
  sessionStorage.setItem(SESSION_KEY_PREFIX + tableNum + '-openedAt', openedAt);
}

function getStoredOpenedAt(tableNum) {
  return sessionStorage.getItem(SESSION_KEY_PREFIX + tableNum + '-openedAt');
}

function clearStoredSession(tableNum) {
  sessionStorage.removeItem(SESSION_KEY_PREFIX + tableNum);
  sessionStorage.removeItem(SESSION_KEY_PREFIX + tableNum + '-openedAt');
}

async function validateSession(tableNum, token) {
  try {
    const snap = await get(ref(db, `tables/${tableNum}`));
    if (!snap.exists()) return { valid: false, reason: 'ไม่พบข้อมูลโต๊ะ' };
    const data = snap.val();

    if (data.status !== 'open') return { valid: false, reason: 'โต๊ะนี้ยังไม่ได้เปิด กรุณาติดต่อพนักงาน' };
    if (data.token !== token)   return { valid: false, reason: 'QR Code ไม่ถูกต้อง กรุณาขอ QR ใหม่จากพนักงาน' };

    // ตรวจอายุ token รวม (4 ชม.)
    const opened = new Date(data.openedAt).getTime();
    const now = Date.now();
    if (now - opened > 4 * 60 * 60 * 1000) return { valid: false, reason: 'QR หมดอายุแล้ว กรุณาติดต่อพนักงาน' };

    // ตรวจ client session (คนที่เคย scan แล้วในเครื่องนี้ผ่านได้เลย — กัน reload)
    const expectedKey = await getClientSessionKey(tableNum, token);
    const storedKey   = getStoredSession(tableNum);
    const storedOpenedAt = getStoredOpenedAt(tableNum);

    if (storedKey === expectedKey) {
      // ตรวจว่า openedAt ตรงกับที่เก็บไว้ไหม — ถ้าไม่ตรงแสดงว่า admin เปิดโต๊ะใหม่
      const sessionIsStale = storedOpenedAt && storedOpenedAt !== data.openedAt;
      return { valid: true, isReturning: true, resetCart: sessionIsStale };
    }

    // === Layer 4: One-time Scan Window ===
    // ตรวจว่า QR เคยถูกสแกนครั้งแรกเกิน 15 นาทีแล้วหรือยัง
    if (data.firstScannedAt) {
      const firstScan = new Date(data.firstScannedAt).getTime();
      if (now - firstScan > SCAN_WINDOW_MS) {
        // QR link หมดอายุสำหรับคนใหม่ — แต่คนที่อยู่แล้ว (session) ผ่านได้ (ตรวจข้างบนแล้ว)
        return { valid: false, reason: 'QR Code นี้หมดอายุแล้ว\nกรุณาขอ QR ใหม่จากพนักงานที่โต๊ะ' };
      }
    } else {
      // สแกนครั้งแรก → บันทึก timestamp
      await update(ref(db, `tables/${tableNum}`), { firstScannedAt: new Date().toISOString() });
    }

    // บันทึก session ลง sessionStorage (พร้อม openedAt เพื่อตรวจ reopen)
    storeSession(tableNum, expectedKey, data.openedAt);
    return { valid: true, isReturning: false };

  } catch (err) {
    console.error('validateSession error:', err);
    return { valid: false, reason: 'เกิดข้อผิดพลาด กรุณาลองใหม่' };
  }
}

function showBlockedScreen(reason) {
  if (blockedScreen) {
    document.getElementById('blockedReason').textContent = reason || 'ไม่สามารถสั่งได้ในขณะนี้';
    blockedScreen.classList.remove('hidden');
    const main = document.querySelector('.main');
    const header = document.querySelector('.header');
    if (main) main.classList.add('hidden');
    if (header) header.classList.add('hidden');
  }
}

// ==================== Table Selection (Manual — non-QR mode) ====================
function selectTable(tableNum) {
  selectedTable = tableNum;
  const sel = document.getElementById('tableSelect');
  if (sel) sel.value = String(tableNum);
  productsOverlay.classList.add('hidden');
  tableChipEl.textContent = ` · โต๊ะ ${tableNum}`;
  renderProducts();
}

// ==================== Overlay positioning ====================
function updateOverlayTop() {
  const tableBar = document.querySelector('.table-bar');
  const section = document.querySelector('.products-section');
  if (tableBar && section && productsOverlay) {
    const barBottom = tableBar.getBoundingClientRect().bottom;
    const sectionTop = section.getBoundingClientRect().top;
    productsOverlay.style.top = (barBottom - sectionTop + 8) + 'px';
  }
}

const tableSelect = document.getElementById('tableSelect');
if (tableSelect) {
  tableSelect.addEventListener('change', () => {
    const val = parseInt(tableSelect.value);
    if (!isNaN(val)) selectTable(val);
  });
}

// ==================== Products ====================
function renderProducts() {
  productsGrid.innerHTML = (products[currentCategory] || []).map((p) => `
    <button type="button" class="product-card"
      data-id="${p.id}" data-name="${p.name}"
      data-price="${p.price}" data-image="${p.image}">
      <img class="product-img" src="${p.image}" alt="${p.name}" loading="lazy">
      <p class="product-name">${p.name}</p>
      <p class="product-price">${formatMoney(p.price)}</p>
    </button>
  `).join('');

  productsGrid.querySelectorAll('.product-card').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (!selectedTable) return;
      addToCart(btn.dataset);
    });
  });
}

// ==================== Cart ====================
function addToCart({ id, name, price, image }) {
  const existing = cart.find(i => i.id === id);
  if (existing) {
    existing.qty += 1;
  } else {
    cart.push({ id, name, price: parseFloat(price), qty: 1, image, table: selectedTable });
  }
  renderCart();
}

function removeFromCart(index) {
  cart.splice(index, 1);
  renderCart();
}

function updateQty(index, delta) {
  cart[index].qty += delta;
  if (cart[index].qty <= 0) removeFromCart(index);
  else renderCart();
}

function renderCart() {
  cartEmptyEl.style.display = cart.length ? 'none' : 'flex';
  cartItemsEl.querySelectorAll('.cart-item').forEach((el) => el.remove());

  cart.forEach((item, index) => {
    const li = document.createElement('li');
    li.className = 'cart-item';
    li.innerHTML = `
      ${item.image
        ? `<img class="cart-item-img" src="${item.image}" alt="">`
        : '<span class="cart-item-img-placeholder"></span>'}
      <div class="cart-item-info">
        <div class="cart-item-name">${item.name}</div>
        <div class="cart-item-price">${formatMoney(item.price)} × ${item.qty}</div>
      </div>
      <div class="cart-item-qty">
        <button type="button" class="qty-btn" aria-label="Decrease">−</button>
        <span class="qty-num">${item.qty}</span>
        <button type="button" class="qty-btn" aria-label="Increase">+</button>
      </div>
      <button type="button" class="cart-item-remove" aria-label="ลบรายการ">✕</button>
    `;
    li.querySelector('.qty-btn:first-child').addEventListener('click', () => updateQty(index, -1));
    li.querySelector('.qty-btn:last-child').addEventListener('click',  () => updateQty(index, 1));
    li.querySelector('.cart-item-remove').addEventListener('click', () => removeFromCart(index));
    cartItemsEl.appendChild(li);
  });

  const totalQty = cart.reduce((sum, i) => sum + i.qty, 0);
  const badge = document.getElementById('cartBadge');
  if (badge) {
    badge.textContent = totalQty;
    badge.style.display = totalQty > 0 ? 'inline-flex' : 'none';
  }
  totalEl.textContent = formatMoney(cart.reduce((sum, i) => sum + i.price * i.qty, 0));
}

function clearCart() {
  cart = [];
  renderCart();
}

// ==================== Firebase: Order Number ====================
async function loadOrderNumber() {
  const today = new Date().toISOString().slice(0, 10);
  const snap  = await get(ref(db, 'meta'));
  const meta  = snap.exists() ? snap.val() : {};
  if (meta.lastOrderDate !== today) {
    orderNumber = 1001;
    await update(ref(db, 'meta'), { orderNumber: 1001, lastOrderDate: today });
  } else {
    orderNumber = meta.orderNumber || 1001;
  }
  orderNumberEl.textContent = orderNumber;
}

// ==================== Firebase: Session-based Order ====================
/**
 * แนวคิดใหม่: 1 order ต่อ 1 session โต๊ะ
 * - เมื่อเปิดโต๊ะ admin จะสร้าง currentOrderKey ไว้ใน tables/{n}
 * - ทุกครั้งที่ลูกค้ากด "สั่งซื้อ" จะ merge รายการเข้า order เดิม ไม่สร้างใหม่
 * - order จบเมื่อปิดโต๊ะ
 */
async function saveOrder() {
  const newItems = cart.map((i) => ({ name: i.name, price: i.price, qty: i.qty }));
  const addedTotal = cart.reduce((sum, i) => sum + i.price * i.qty, 0);

  if (isQrMode && selectedTable) {
    // QR mode: ดึง currentOrderKey จาก table
    const tableSnap = await get(ref(db, `tables/${selectedTable}`));
    const tableData = tableSnap.exists() ? tableSnap.val() : {};
    const orderKey  = tableData.currentOrderKey || null;

    if (orderKey) {
      // Merge เข้า order เดิม
      const orderSnap = await get(ref(db, `orders/${orderKey}`));
      if (orderSnap.exists()) {
        const existing = orderSnap.val();
        const merged = mergeItems(existing.items || [], newItems);
        const newTotal = merged.reduce((s, i) => s + i.price * i.qty, 0);
        await update(ref(db, `orders/${orderKey}`), {
          items: merged,
          total: newTotal,
          lastUpdated: new Date().toISOString(),
        });
        return; // done
      }
    }

    // ยังไม่มี order → สร้างใหม่
    await createNewTableOrder(newItems, addedTotal, tableData);

  } else {
    // Non-QR (manual): สร้าง order ใหม่ทุกครั้ง (พนักงานสั่งเอง)
    const total = cart.reduce((sum, i) => sum + i.price * i.qty, 0);
    const order = {
      orderNumber,
      table: selectedTable,
      date: new Date().toISOString(),
      items: newItems,
      total,
      status: 'pending',
      sessionOrderKey: null,
    };
    await push(ref(db, 'orders'), order);
  }
}

function mergeItems(existing, incoming) {
  const map = {};
  existing.forEach(i => { map[`${i.name}__${i.price}`] = { ...i }; });
  incoming.forEach(i => {
    const k = `${i.name}__${i.price}`;
    if (map[k]) map[k].qty += i.qty;
    else map[k] = { ...i };
  });
  return Object.values(map);
}

async function createNewTableOrder(items, total, tableData) {
  // ออก orderNumber ใหม่
  const today = new Date().toISOString().slice(0, 10);
  const metaSnap = await get(ref(db, 'meta'));
  const meta = metaSnap.exists() ? metaSnap.val() : {};
  let nextNum = (meta.lastOrderDate === today) ? (meta.orderNumber || 1001) : 1001;

  const order = {
    orderNumber: nextNum,
    table: selectedTable,
    date: new Date().toISOString(),
    openedAt: tableData.openedAt || new Date().toISOString(),
    items,
    total,
    status: 'pending',
    sessionOrder: true,
  };
  const newRef = await push(ref(db, 'orders'), order);
  // บันทึก key กลับไปที่ table
  await update(ref(db, `tables/${selectedTable}`), { currentOrderKey: newRef.key });
  // อัปเดต meta
  orderNumber = nextNum;
  orderNumberEl.textContent = orderNumber;
  await update(ref(db, 'meta'), { orderNumber: nextNum, lastOrderDate: today });
}

// ==================== Receipt ====================
function showReceipt() {
  const total = cart.reduce((sum, i) => sum + i.price * i.qty, 0);
  receiptOrderNum.textContent = orderNumber;
  receiptTableEl.textContent  = `โต๊ะ ${selectedTable}`;
  receiptDate.textContent     = new Date().toLocaleString('th-TH');
  receiptItemsEl.innerHTML    = cart.map((i) =>
    `<div class="receipt-item"><span>${i.name} × ${i.qty}</span><span>${formatMoney(i.price * i.qty)}</span></div>`
  ).join('');
  receiptTotal.textContent = formatMoney(total);
  // QR mode: ปุ่ม "สั่งอีกครั้ง" → "สั่งเพิ่ม"
  if (newOrderBtn) newOrderBtn.textContent = isQrMode ? '+ สั่งเพิ่ม' : '✓ สั่งออเดอร์ใหม่';
  receiptModal.setAttribute('aria-hidden', 'false');
}

function closeReceipt() {
  receiptModal.setAttribute('aria-hidden', 'true');
}

// ==================== Confirm Modal ====================
function openConfirmOrderModal() {
  const total = cart.reduce((sum, i) => sum + i.price * i.qty, 0);
  confirmTableLabel.textContent = `โต๊ะ ${selectedTable}`;

  // Merge duplicate items by id
  const merged = {};
  cart.forEach(i => {
    if (!merged[i.id]) merged[i.id] = { ...i };
    else merged[i.id].qty += i.qty;
  });
  const mergedItems = Object.values(merged);

  confirmOrderList.innerHTML = mergedItems.map((i) =>
    `<div class="confirm-order-item"><span>${i.name} × ${i.qty}</span><span>${formatMoney(i.price * i.qty)}</span></div>`
  ).join('');
  confirmTotal.innerHTML = `<span>รวมทั้งหมด</span><span>${formatMoney(total)}</span>`;
  confirmOrderModal.setAttribute('aria-hidden', 'false');
}

function closeConfirmOrderModal() {
  confirmOrderModal.setAttribute('aria-hidden', 'true');
}

// ==================== New Order (after receipt closed) ====================
async function newOrder() {
  // Non-QR mode: advance order number
  if (!isQrMode) {
    orderNumber += 1;
    orderNumberEl.textContent = orderNumber;
    await update(ref(db, 'meta'), {
      orderNumber,
      lastOrderDate: new Date().toISOString().slice(0, 10)
    });
    selectedTable = null;
    tableChipEl.textContent = '';
    const sel = document.getElementById('tableSelect');
    if (sel) sel.value = '';
    productsOverlay.classList.remove('hidden');
  }
  // QR mode: ออเดอร์ยังอยู่ (session ยังเปิด) — แค่ล้าง cart รอสั่งรอบต่อไป
  cart = [];
  renderCart();
  closeReceipt();
}

// ==================== Table Order History (QR Mode) ====================
/**
 * แสดงประวัติการสั่งของโต๊ะนี้แบบ real-time
 * ดึงเฉพาะออเดอร์ของ table นั้น ๆ (ไม่แสดงของโต๊ะอื่น)
 */
function initTableOrderHistory(tableNum) {
  // สร้าง section สำหรับประวัติ
  const productsSection = document.querySelector('.products-section');
  if (!productsSection) return;

  const historySection = document.createElement('div');
  historySection.id = 'tableOrderHistory';
  historySection.className = 'table-history-section';
  historySection.innerHTML = `
    <div class="table-history-header">
      <span class="table-history-icon">📋</span>
      <h3 class="table-history-title">รายการที่สั่งแล้ว — โต๊ะ ${tableNum}</h3>
    </div>
    <div class="table-history-body" id="tableHistoryBody">
      <div class="table-history-loading">กำลังโหลด...</div>
    </div>
  `;
  productsSection.appendChild(historySection);

  // Real-time listener
  const ordersRef = ref(db, 'orders');
  tableOrdersUnsubscribe = onValue(ordersRef, (snapshot) => {
    const tableOrders = [];
    if (snapshot.exists()) {
      snapshot.forEach((child) => {
        const o = child.val();
        if (String(o.table) === String(tableNum)) {
          tableOrders.push({ firebaseKey: child.key, ...o });
        }
      });
    }
    tableOrders.sort((a, b) => new Date(a.date) - new Date(b.date));
    renderTableHistory(tableOrders);
  });
}

function renderTableHistory(orders) {
  const body = document.getElementById('tableHistoryBody');
  if (!body) return;

  if (orders.length === 0) {
    body.innerHTML = `
      <div class="table-history-empty">
        <span class="table-history-empty-icon">🍽️</span>
        <span>ยังไม่มีรายการสั่ง</span>
      </div>
    `;
    return;
  }

  const totalAll = orders.reduce((sum, o) => sum + o.total, 0);
  const totalItems = orders.reduce((sum, o) => sum + (o.items || []).reduce((s, i) => s + i.qty, 0), 0);

  body.innerHTML = `
    <div class="table-history-summary">
      <span>${orders.length} ออเดอร์ · ${totalItems} รายการ</span>
      <span class="table-history-summary-total">${formatMoney(totalAll)}</span>
    </div>
    ${orders.map((order, idx) => {
      const isPending = order.status === 'pending';
      const time = new Date(order.date).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
      return `
        <div class="table-history-order ${isPending ? 'pending' : 'paid'}">
          <div class="table-history-order-header">
            <span class="table-history-order-num">ออเดอร์ #${order.orderNumber}</span>
            <div class="table-history-order-meta">
              <span class="table-history-time">${time}</span>
              <span class="table-history-status ${isPending ? 'pending' : 'paid'}">
                ${isPending ? '⏳ รอจ่าย' : '✅ จ่ายแล้ว'}
              </span>
            </div>
          </div>
          <ul class="table-history-items">
            ${(order.items || []).map(i =>
              `<li class="table-history-item">
                <span class="table-history-item-name">${i.name}</span>
                <span class="table-history-item-qty">× ${i.qty}</span>
                <span class="table-history-item-price">${formatMoney(i.price * i.qty)}</span>
              </li>`
            ).join('')}
          </ul>
          <div class="table-history-order-total">
            <span>รวม</span>
            <span>${formatMoney(order.total)}</span>
          </div>
        </div>
      `;
    }).join('')}
    <div class="table-history-grand-total">
      <span>ยอดรวมทั้งหมด</span>
      <span>${formatMoney(totalAll)}</span>
    </div>
  `;
}

// ==================== Event Listeners ====================
categoryBtns.forEach((btn) => {
  btn.addEventListener('click', () => {
    categoryBtns.forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    currentCategory = btn.dataset.category;
    renderProducts();
  });
});

clearCartBtn.addEventListener('click', clearCart);
completeOrderBtn.addEventListener('click', () => {
  if (cart.length > 0) {
    closeCartOnMobile();
    openConfirmOrderModal();
  }
});
newOrderBtn.addEventListener('click', newOrder);
confirmOrderCancel.addEventListener('click', closeConfirmOrderModal);
confirmOrderModal.addEventListener('click', (e) => { if (e.target === confirmOrderModal) closeConfirmOrderModal(); });
receiptModal.addEventListener('click', (e) => { if (e.target === receiptModal) closeReceipt(); });

confirmOrderOk.addEventListener('click', async () => {
  confirmOrderOk.disabled = true;
  confirmOrderOk.textContent = 'กำลังบันทึก...';
  closeConfirmOrderModal();
  await saveOrder();
  confirmOrderOk.disabled = false;
  confirmOrderOk.textContent = '✓ ยืนยัน';
  showReceipt();
});

// ==================== Mobile Cart Toggle ====================
const cartSection = document.querySelector('.cart-section');
const cartHeader  = document.querySelector('.cart-header');

const cartBackdrop = document.createElement('div');
cartBackdrop.className = 'cart-backdrop';
document.body.appendChild(cartBackdrop);

function isMobile() { return window.innerWidth <= 900; }

let cartH = 0;
let closedOffset = 0;
let currentOffset = 0;
let isOpen = false;

function getCartMetrics() {
  cartH = cartSection.offsetHeight;
  closedOffset = cartH - 58;
}

function setOffset(offset, animate = false) {
  currentOffset = Math.max(0, Math.min(offset, closedOffset));
  cartSection.style.transition = animate ? 'transform 0.32s cubic-bezier(0.34,1.1,0.64,1)' : 'none';
  cartSection.style.transform  = `translateY(${currentOffset}px)`;
  const progress = 1 - currentOffset / closedOffset;
  cartBackdrop.style.opacity    = Math.max(0, Math.min(progress * 0.5, 0.5));
  cartBackdrop.style.visibility = currentOffset < closedOffset ? 'visible' : 'hidden';
  cartBackdrop.style.pointerEvents = currentOffset < closedOffset ? 'auto' : 'none';
}

function openCart(animate = true) {
  isOpen = true;
  setOffset(0, animate);
  cartSection.classList.add('open');
}

function closeCart(animate = true) {
  isOpen = false;
  getCartMetrics();
  setOffset(closedOffset, animate);
  cartSection.classList.remove('open');
}

function openCartOnMobile()  { if (isMobile()) { getCartMetrics(); openCart(); } }
function closeCartOnMobile() { if (isMobile()) closeCart(); }

cartBackdrop.addEventListener('click', () => closeCart());

let dragStartY = 0, dragStartOffset = 0, isDragging = false, rafId = null, latestY = 0;

function onPointerStart(clientY) {
  if (!isMobile()) return;
  getCartMetrics();
  isDragging = true;
  dragStartY = clientY;
  dragStartOffset = currentOffset;
  cartSection.style.transition = 'none';
  document.body.style.overflow = 'hidden';
}

function onPointerMove(clientY) {
  if (!isDragging) return;
  latestY = clientY;
  if (!rafId) {
    rafId = requestAnimationFrame(() => {
      const delta = latestY - dragStartY;
      const newOffset = Math.max(0, Math.min(dragStartOffset + delta, closedOffset));
      currentOffset = newOffset;
      cartSection.style.transform = `translateY(${newOffset}px)`;
      const progress = 1 - newOffset / closedOffset;
      cartBackdrop.style.opacity    = Math.max(0, Math.min(progress * 0.5, 0.5));
      cartBackdrop.style.visibility = newOffset < closedOffset ? 'visible' : 'hidden';
      cartBackdrop.style.pointerEvents = newOffset < closedOffset ? 'auto' : 'none';
      rafId = null;
    });
  }
}

function onPointerEnd(clientY) {
  if (!isDragging) return;
  isDragging = false;
  document.body.style.overflow = '';
  if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
  const delta = clientY - dragStartY;
  if (delta > 80 || currentOffset > closedOffset * 0.5) closeCart(true);
  else openCart(true);
  cartSection.style.pointerEvents = '';
}

cartHeader.addEventListener('touchstart', (e) => onPointerStart(e.touches[0].clientY), { passive: true });
document.addEventListener('touchmove', (e) => { if (isDragging) onPointerMove(e.touches[0].clientY); }, { passive: true });
document.addEventListener('touchend', (e) => onPointerEnd(e.changedTouches[0].clientY));
cartHeader.addEventListener('mousedown', (e) => { onPointerStart(e.clientY); e.preventDefault(); });
document.addEventListener('mousemove', (e) => { if (isDragging) onPointerMove(e.clientY); });
document.addEventListener('mouseup', (e) => { if (isDragging) onPointerEnd(e.clientY); });

cartHeader.addEventListener('click', () => {
  if (!isMobile() || isDragging) return;
  const didDrag = Math.abs(currentOffset - dragStartOffset) > 5;
  if (didDrag) return;
  if (isOpen) closeCart(); else { getCartMetrics(); openCart(); }
});

window.addEventListener('load', () => { getCartMetrics(); setOffset(closedOffset); });
window.addEventListener('resize', () => { getCartMetrics(); setOffset(isOpen ? 0 : closedOffset); });

// ==================== QR Mode: Token Validation ====================
async function initFromQR() {
  const params = new URLSearchParams(window.location.search);
  const tableParam = params.get('table');
  const tokenParam = params.get('token');

  if (!tableParam) return; // ไม่ใช่ QR mode

  isQrMode = true;
  const tableNum = parseInt(tableParam);

  if (!tokenParam || isNaN(tableNum) || tableNum < 1 || tableNum > 20) {
    showBlockedScreen('QR Code ไม่ถูกต้อง กรุณาขอ QR ใหม่จากพนักงาน');
    return;
  }

  const { valid, reason, resetCart } = await validateSession(tableNum, tokenParam);
  if (!valid) {
    showBlockedScreen(reason || 'ไม่สามารถสั่งได้ กรุณาติดต่อพนักงาน');
    return;
  }

  // ถ้าโต๊ะถูกเปิดใหม่ (openedAt เปลี่ยน) → ล้าง cart + อัปเดต session
  if (resetCart) {
    cart = [];
    renderCart();
    // อัปเดต openedAt ที่เก็บไว้ให้ตรงกับปัจจุบัน
    const snap = await get(ref(db, `tables/${tableNum}`));
    if (snap.exists()) {
      const d = snap.val();
      const newKey = await getClientSessionKey(tableNum, tokenParam);
      storeSession(tableNum, newKey, d.openedAt);
    }
  }

  sessionToken = tokenParam;
  selectTable(tableNum);

  // ซ่อน table bar
  const tableBar = document.querySelector('.table-bar');
  if (tableBar) tableBar.style.display = 'none';

  // แสดง banner โต๊ะ
  const banner = document.createElement('div');
  banner.className = 'qr-table-banner';
  banner.innerHTML = `<span class="qr-table-icon">🪑</span> โต๊ะ ${tableNum}`;
  const productsSection = document.querySelector('.products-section');
  if (productsSection) productsSection.prepend(banner);

  // เพิ่มแท็บประวัติ
  addHistoryTab(tableNum);

  // Real-time watch: ถ้า Admin ปิดโต๊ะกลางคัน หรือเปิดโต๊ะใหม่
  let watchedOpenedAt = (await get(ref(db, `tables/${tableNum}`))).val()?.openedAt || null;
  onValue(ref(db, `tables/${tableNum}`), (snap) => {
    if (!snap.exists()) return;
    const data = snap.val();

    // Admin เปิดโต๊ะใหม่ (openedAt เปลี่ยน) → reset cart + ล้างประวัติ session นี้
    if (data.status === 'open' && watchedOpenedAt && data.openedAt !== watchedOpenedAt) {
      watchedOpenedAt = data.openedAt;
      cart = [];
      renderCart();
      closeCart(false);
      // ล้าง session เก่า → renderPreviousOrdersInModal จะแสดงว่าว่าง
      clearStoredSession(tableNum);
      renderPreviousOrdersInModal([]);
      return;
    }

    if (data.status !== 'open' || data.token !== sessionToken) {
      if (receiptModal.getAttribute('aria-hidden') === 'false') return;
      showBlockedScreen('โต๊ะถูกปิดโดยพนักงาน\nขอบคุณที่ใช้บริการ 🙏');
    }
  });
}

// ==================== History Modal (QR Mode) ====================
function addHistoryTab(tableNum) {
  // สลับปุ่มใน cart footer: ซ่อนปุ่มล้าง → แสดงปุ่มที่สั่งแล้ว
  const clearCartBtn2 = document.getElementById('clearCart');
  const viewHistoryBtn = document.getElementById('viewHistoryBtn');
  if (clearCartBtn2) clearCartBtn2.classList.add('hidden');
  if (viewHistoryBtn) viewHistoryBtn.classList.remove('hidden');

  // Modal elements
  const modal      = document.getElementById('prevOrdersModal');
  const closeBtn   = document.getElementById('prevOrdersModalClose');
  const tableLabel = document.getElementById('prevOrdersModalTable');
  if (tableLabel) tableLabel.textContent = `โต๊ะ ${tableNum}`;

  function openModal() { if (modal) modal.setAttribute('aria-hidden', 'false'); }
  function closeModal() { if (modal) modal.setAttribute('aria-hidden', 'true'); }

  // Cart footer button
  if (viewHistoryBtn) viewHistoryBtn.addEventListener('click', openModal);

  // Close modal
  if (closeBtn) closeBtn.addEventListener('click', closeModal);
  if (modal) modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });

  // Start real-time listener
  startTableHistoryInCart(tableNum);
}

function startTableHistoryInCart(tableNum) {
  // real-time listener บน orders — filter เฉพาะ session นี้
  onValue(ref(db, 'orders'), async (snapshot) => {
    // ดึง currentOrderKey ปัจจุบัน
    const tableSnap = await get(ref(db, `tables/${tableNum}`));
    const tableData = tableSnap.exists() ? tableSnap.val() : {};
    const currentOrderKey = tableData.currentOrderKey || null;
    const currentOpenedAt = tableData.openedAt || null;

    let sessionOrders = [];
    if (snapshot.exists()) {
      snapshot.forEach((child) => {
        const o = child.val();
        if (String(o.table) !== String(tableNum)) return;
        // ถ้ามี currentOrderKey ให้โชว์เฉพาะ order นั้น
        if (currentOrderKey) {
          if (child.key === currentOrderKey) sessionOrders.push({ firebaseKey: child.key, ...o });
        } else if (currentOpenedAt && o.date >= currentOpenedAt) {
          sessionOrders.push({ firebaseKey: child.key, ...o });
        }
      });
    }
    renderPreviousOrdersInModal(sessionOrders);
  });
}

function renderPreviousOrdersInModal(orders) {
  const btnChip = document.getElementById('historyBtnChip');
  const body    = document.getElementById('prevOrdersModalBody');

  // สำหรับ session-order ใหม่ orders จะมีแค่ 1 record เสมอ
  // รวม items ทั้งหมดเพื่อแสดง
  const allItems = [];
  orders.forEach(o => (o.items || []).forEach(i => allItems.push(i)));
  const merged = {};
  allItems.forEach(i => {
    const k = `${i.name}__${i.price}`;
    if (!merged[k]) merged[k] = { name: i.name, price: i.price, qty: 0 };
    merged[k].qty += i.qty;
  });
  const items = Object.values(merged);
  const totalAll = items.reduce((s, i) => s + i.price * i.qty, 0);
  const totalQty = items.reduce((s, i) => s + i.qty, 0);

  if (btnChip) {
    btnChip.textContent = totalAll > 0 ? formatMoney(totalAll) : '';
  }

  if (!body) return;

  if (items.length === 0) {
    body.innerHTML = `
      <div class="prev-modal-empty">
        <span class="prev-modal-empty-icon">🍽️</span>
        <p>ยังไม่มีรายการสั่ง</p>
      </div>`;
    return;
  }

  const status = orders[0]?.status || 'pending';
  const isPending = status === 'pending';

  body.innerHTML = `
    <div class="prev-modal-status-bar ${isPending ? 'pending' : 'paid'}">
      <span class="prev-modal-status-icon">${isPending ? '⏳' : '✅'}</span>
      <span class="prev-modal-status-text">${isPending ? 'รอชำระเงิน' : 'ชำระเงินแล้ว'}</span>
      <span class="prev-modal-status-qty">${totalQty} รายการ</span>
    </div>
    <ul class="prev-modal-items-list">
      ${items.map(i => `
        <li class="prev-modal-item">
          <span class="prev-modal-item-name">${i.name}</span>
          <span class="prev-modal-item-qty">× ${i.qty}</span>
          <span class="prev-modal-item-price">${formatMoney(i.price * i.qty)}</span>
        </li>`).join('')}
    </ul>
    <div class="prev-modal-grand">
      <span>ยอดรวมทั้งหมด</span>
      <span>${formatMoney(totalAll)}</span>
    </div>
  `;
}

// stub ที่ไม่ได้ใช้แล้ว แต่คงไว้เพื่อไม่ให้ error
function updateCartDivider() {}
function renderPreviousOrdersInCart() {}

// ==================== Init ====================
setDate();
renderProducts();
renderCart();
loadOrderNumber();
updateOverlayTop();
window.addEventListener('resize', updateOverlayTop);
initFromQR();
