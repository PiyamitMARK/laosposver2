/**
 * Tea & Coffee Shop POS
 * ใช้ Firebase Realtime Database — sync ทุกเครื่องแบบ real-time
 */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getDatabase, ref, push, update, get } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";

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

// ==================== รูปสินค้า ====================
const IMG = (n) => 'images/img' + n + '.png';

const products = {
  kao: [
    { id: 'kao1', name: 'กะเพราหมูสับ', price: 55, image: IMG(1) },
    { id: 'kao2', name: 'กะเพราหมูกรอบ', price: 55, image: IMG(2) },
    { id: 'kao3', name: 'ข้าวผัดหมู', price: 55, image: IMG(3) },
    { id: 'kao4', name: 'ข้าวหมูกระเทียม', price: 45, image: IMG(4) },
    { id: 'kao5', name: 'ข้าวไข่เจียว', price: 60, image: IMG(5) },
    { id: 'kao6', name: 'ข้าวผัดพริกแกงหมู', price: 55, image: IMG(6) },
    { id: 'kao7', name: 'ข้าวพะแนง', price: 55, image: IMG(7) },
    { id: 'kao8', name: 'ข้าวคะน้าหมูกรอบ', price: 60, image: IMG(8) },
    { id: 'kao9', name: 'ราดหน้า', price: 55, image: IMG(9) },
    { id: 'kao10', name: 'ผัดซีอิ๊ว', price: 60, image: IMG(10) },
  ],
  nam: [
    { id: 'water', name: 'น้ำเปล่า', price: 10, image: IMG(60) },
    { id: 'pepsi', name: 'เป็ปซี่', price: 15, image: IMG(80) },
    { id: 'fanta', name: 'น้ำแดงแฟนต้า', price: 15, image: IMG(543) },
    { id: 'sprite', name: 'สไปร์ท', price: 15, image: IMG(345) },
  ],
};

// ==================== State ====================
let cart = [];
let orderNumber = 1001;
let currentCategory = 'kao';
let selectedTable = null; // โต๊ะที่เลือก

// ==================== DOM ====================
const currentDateEl = document.getElementById('currentDate');
const orderNumberEl = document.getElementById('orderNumber');
const tableChipEl = document.getElementById('tableChip');
const categoryBtns = document.querySelectorAll('.category-btn');
const productsGrid = document.getElementById('productsGrid');
const productsOverlay = document.getElementById('productsOverlay');
const cartItemsEl = document.getElementById('cartItems');
const cartEmptyEl = document.getElementById('cartEmpty');
const totalEl = document.getElementById('total');
const clearCartBtn = document.getElementById('clearCart');
const completeOrderBtn = document.getElementById('completeOrder');
const receiptModal = document.getElementById('receiptModal');
const receiptOrderNum = document.getElementById('receiptOrderNum');
const receiptTableEl = document.getElementById('receiptTable');
const receiptDate = document.getElementById('receiptDate');
const receiptItemsEl = document.getElementById('receiptItems');
const receiptTotal = document.getElementById('receiptTotal');
const printReceiptBtn = document.getElementById('printReceipt');
const newOrderBtn = document.getElementById('newOrder');
const confirmOrderModal = document.getElementById('confirmOrderModal');
const confirmTableLabel = document.getElementById('confirmTableLabel');
const confirmOrderList = document.getElementById('confirmOrderList');
const confirmTotal = document.getElementById('confirmTotal');
const confirmOrderCancel = document.getElementById('confirmOrderCancel');
const confirmOrderOk = document.getElementById('confirmOrderOk');

// ==================== Helpers ====================
function formatMoney(n) {
  return '฿' + Number(n).toFixed(2);
}

function setDate() {
  currentDateEl.textContent = new Date().toLocaleDateString('th-TH', {
    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
  });
}

// ==================== Table Selection ====================
function selectTable(tableNum) {
  selectedTable = tableNum;

  // อัปเดตปุ่ม
  document.querySelectorAll('.table-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.table === String(tableNum));
  });

  // ซ่อน overlay
  productsOverlay.classList.add('hidden');

  // แสดงเลขโต๊ะใน header
  tableChipEl.textContent = ` · โต๊ะ ${tableNum}`;

  // render สินค้าทันทีที่เลือกโต๊ะ (แก้บัคเมนูไม่ขึ้น)
  renderProducts();
}

// ==================== Overlay positioning ====================
function updateOverlayTop() {
  const tableBar = document.querySelector('.table-bar');
  const section = document.querySelector('.products-section');
  if (tableBar && section && productsOverlay) {
    const barBottom = tableBar.getBoundingClientRect().bottom;
    const sectionTop = section.getBoundingClientRect().top;
    const offset = barBottom - sectionTop + 8;
    productsOverlay.style.top = offset + 'px';
  }
}

document.querySelectorAll('.table-btn').forEach(btn => {
  btn.addEventListener('click', () => selectTable(parseInt(btn.dataset.table)));
});

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
      if (!selectedTable) return; // ป้องกันกดสินค้าถ้าไม่เลือกโต๊ะ
      addToCart(btn.dataset);
    });
  });
}

// ==================== Cart ====================
function addToCart({ id, name, price, image }) {
  cart.push({ id, name, price: parseFloat(price), qty: 1, image, table: selectedTable });
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
      ${item.image ? `<img class="cart-item-img" src="${item.image}" alt="">` : '<span class="cart-item-img-placeholder"></span>'}
      <div class="cart-item-info">
        <div class="cart-item-name">${item.name}</div>
        <div class="cart-item-price">${formatMoney(item.price)} × ${item.qty}</div>
      </div>
      <div class="cart-item-qty">
        <button type="button" class="qty-btn" aria-label="Decrease">−</button>
        <span class="qty-num">${item.qty}</span>
        <button type="button" class="qty-btn" aria-label="Increase">+</button>
      </div>
    `;
    li.querySelector('.qty-btn:first-child').addEventListener('click', () => updateQty(index, -1));
    li.querySelector('.qty-btn:last-child').addEventListener('click', () => updateQty(index, 1));
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
  const metaSnap = await get(ref(db, 'meta'));
  const meta = metaSnap.exists() ? metaSnap.val() : {};

  if (meta.lastOrderDate !== today) {
    orderNumber = 1001;
    await update(ref(db, 'meta'), { orderNumber: 1001, lastOrderDate: today });
  } else {
    orderNumber = meta.orderNumber || 1001;
  }
  orderNumberEl.textContent = orderNumber;
}

// ==================== Firebase: Save Order ====================
async function saveOrder() {
  const total = cart.reduce((sum, i) => sum + i.price * i.qty, 0);
  const order = {
    orderNumber,
    table: selectedTable,
    date: new Date().toISOString(),
    items: cart.map((i) => ({ name: i.name, price: i.price, qty: i.qty })),
    total,
    status: 'pending',
  };
  await push(ref(db, 'orders'), order);
}

// ==================== Receipt ====================
function showReceipt() {
  const total = cart.reduce((sum, i) => sum + i.price * i.qty, 0);
  receiptOrderNum.textContent = orderNumber;
  receiptTableEl.textContent = `โต๊ะ ${selectedTable}`;
  receiptDate.textContent = new Date().toLocaleString('th-TH');
  receiptItemsEl.innerHTML = cart.map((i) =>
    `<div class="receipt-item"><span>${i.name} × ${i.qty}</span><span>${formatMoney(i.price * i.qty)}</span></div>`
  ).join('');
  receiptTotal.textContent = formatMoney(total);
  receiptModal.setAttribute('aria-hidden', 'false');
}

function closeReceipt() {
  receiptModal.setAttribute('aria-hidden', 'true');
}

// ==================== Confirm Modal ====================
function openConfirmOrderModal() {
  const total = cart.reduce((sum, i) => sum + i.price * i.qty, 0);
  confirmTableLabel.textContent = `โต๊ะ ${selectedTable}`;
  confirmOrderList.innerHTML = cart.map((i) =>
    `<div class="confirm-order-item"><span>${i.name} × ${i.qty}</span><span>${formatMoney(i.price * i.qty)}</span></div>`
  ).join('');
  confirmTotal.innerHTML = `<span>รวมทั้งหมด</span><span>${formatMoney(total)}</span>`;
  confirmOrderModal.setAttribute('aria-hidden', 'false');
}

function closeConfirmOrderModal() {
  confirmOrderModal.setAttribute('aria-hidden', 'true');
}

// ==================== New Order ====================
async function newOrder() {
  orderNumber += 1;
  orderNumberEl.textContent = orderNumber;
  await update(ref(db, 'meta'), {
    orderNumber,
    lastOrderDate: new Date().toISOString().slice(0, 10)
  });
  // รีเซ็ตโต๊ะและตะกร้า
  cart = [];
  selectedTable = null;
  tableChipEl.textContent = '';
  document.querySelectorAll('.table-btn').forEach(b => b.classList.remove('active'));
  productsOverlay.classList.remove('hidden');
  renderCart();
  closeReceipt();
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
completeOrderBtn.addEventListener('click', () => { if (cart.length > 0) { closeCartOnMobile(); openConfirmOrderModal(); } });
printReceiptBtn.addEventListener('click', () => window.print());
newOrderBtn.addEventListener('click', newOrder);

confirmOrderCancel.addEventListener('click', closeConfirmOrderModal);
confirmOrderModal.addEventListener('click', (e) => { if (e.target === confirmOrderModal) closeConfirmOrderModal(); });
receiptModal.addEventListener('click', (e) => { if (e.target === receiptModal) closeReceipt(); });

confirmOrderOk.addEventListener('click', async () => {
  closeConfirmOrderModal();
  await saveOrder();
  showReceipt();
});

document.querySelectorAll(".temp-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".temp-btn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    selectedTemp = btn.dataset.temp;
    if (cart.length > 0) { cart[cart.length - 1].temp = selectedTemp; renderCart(); }
  });
});

document.querySelectorAll(".sweet-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".sweet-btn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    selectedSweet = btn.dataset.sweet;
    if (cart.length > 0) { cart[cart.length - 1].sweet = selectedSweet; renderCart(); }
  });
});

// ==================== Mobile Cart Toggle + Smooth Drag ====================
const cartSection = document.querySelector('.cart-section');
const cartHeader = document.querySelector('.cart-header');

const cartBackdrop = document.createElement('div');
cartBackdrop.className = 'cart-backdrop';
document.body.appendChild(cartBackdrop);

function isMobile() { return window.innerWidth <= 900; }

// cart เปิดอยู่ที่ translateY(0), ปิดอยู่ที่ translateY(calc(100% - 58px))
// ใช้ px จริงเพื่อ drag ได้ลื่น
let cartH = 0;          // ความสูง cart (px)
let closedOffset = 0;   // offset ตอนปิด (px)
let currentOffset = 0;  // offset ปัจจุบัน
let isOpen = false;

function getCartMetrics() {
  cartH = cartSection.offsetHeight;
  closedOffset = cartH - 58;
}

function setOffset(offset, animate = false) {
  currentOffset = Math.max(0, Math.min(offset, closedOffset));
  cartSection.style.transition = animate ? 'transform 0.32s cubic-bezier(0.34,1.1,0.64,1)' : 'none';
  cartSection.style.transform = `translateY(${currentOffset}px)`;

  const progress = 1 - currentOffset / closedOffset;
  cartBackdrop.style.opacity = Math.max(0, Math.min(progress * 0.5, 0.5));
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

function openCartOnMobile() {
  if (isMobile()) { getCartMetrics(); openCart(); }
}

function closeCartOnMobile() {
  if (isMobile()) closeCart();
}

cartBackdrop.addEventListener('click', () => closeCart());

// ==================== Drag ====================
let dragStartY = 0;
let dragStartOffset = 0;
let isDragging = false;
let rafId = null;
let latestY = 0;

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
      cartBackdrop.style.opacity = Math.max(0, Math.min(progress * 0.5, 0.5));
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
  const velocity = delta; // positive = ลงล่าง

  // snap: ถ้าลากลง > 80px หรือ swipe ลงเร็ว → ปิด
  if (velocity > 80 || currentOffset > closedOffset * 0.5) {
    closeCart(true);
  } else {
    openCart(true);
  }
  cartSection.style.pointerEvents = '';
}

// Touch events
cartHeader.addEventListener('touchstart', (e) => {
  onPointerStart(e.touches[0].clientY);
}, { passive: true });

document.addEventListener('touchmove', (e) => {
  if (isDragging) onPointerMove(e.touches[0].clientY);
}, { passive: true });

document.addEventListener('touchend', (e) => {
  onPointerEnd(e.changedTouches[0].clientY);
});

// Mouse events (สำหรับ desktop preview)
cartHeader.addEventListener('mousedown', (e) => {
  onPointerStart(e.clientY);
  e.preventDefault();
});
document.addEventListener('mousemove', (e) => {
  if (isDragging) onPointerMove(e.clientY);
});
document.addEventListener('mouseup', (e) => {
  if (isDragging) onPointerEnd(e.clientY);
});

// Tap toggle (ถ้าไม่ได้ drag)
cartHeader.addEventListener('click', () => {
  if (!isMobile() || isDragging) return;
  const didDrag = Math.abs(currentOffset - dragStartOffset) > 5;
  if (didDrag) return;
  if (isOpen) closeCart(); else { getCartMetrics(); openCart(); }
});

// Init offset
window.addEventListener('load', () => { getCartMetrics(); setOffset(closedOffset); });
window.addEventListener('resize', () => {
  getCartMetrics();
  setOffset(isOpen ? 0 : closedOffset);
});

// ==================== Init ====================
setDate();
renderProducts();
renderCart();
loadOrderNumber();
updateOverlayTop();
window.addEventListener('resize', updateOverlayTop);
