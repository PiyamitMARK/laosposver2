/**
 * Tea & Coffee Shop POS
 * ใช้ Firebase Realtime Database — sync ทุกเครื่องแบบ real-time
 */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getDatabase, ref, push, update, get } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyArtz0xjTNBNXbzeZjk-gmafuwszw9ErVk",
  authDomain: "tea-coffee-pos-23195.firebaseapp.com",
  databaseURL: "https://tea-coffee-pos-23195-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "tea-coffee-pos-23195",
  storageBucket: "tea-coffee-pos-23195.firebasestorage.app",
  messagingSenderId: "58906181234",
  appId: "1:58906181234:web:6b633330168a619fce8ceb"
};

const firebaseApp = initializeApp(firebaseConfig);
const db = getDatabase(firebaseApp);

// ==================== รูปสินค้า ====================
const IMG = (n) => 'images/img' + n + '.png';

const products = {
  coffee: [
    { id: 'espresso', name: 'เอสเปรสโซ่', price: 55, image: IMG(12) },
    { id: 'cappuccino', name: 'คาปูชิโน่', price: 55, image: IMG(7) },
    { id: 'latte', name: 'ลาเต้', price: 55, image: IMG(4) },
    { id: 'americano', name: 'อเมริกาโน่', price: 45, image: IMG(5) },
    { id: 'coconut-americano', name: 'อเมริกาโน่มะพร้าว', price: 60, image: IMG(6) },
    { id: 'honey-americano', name: 'อเมริกาโน่น้ำผึ้ง', price: 55, image: IMG(5) },
    { id: 'mocha', name: 'มอคค่า', price: 55, image: IMG(12) },
    { id: 'orange-americano', name: 'อเมริกาโน่ส้ม', price: 60, image: IMG(8) },
    { id: 'pure-matcha', name: 'เพียวมัทฉะ', price: 55, image: IMG(2) },
    { id: 'matcha-latte', name: 'มัทฉะลาเต้', price: 60, image: IMG(3) },
    { id: 'coconut-matcha', name: 'มัทฉะมะพร้าว', price: 60, image: IMG(15) },
  ],
  namwhan: [
    { id: 'water', name: 'น้ำเปล่า', price: 10, image: IMG(60) },
    { id: 'pepsi', name: 'เป็ปซี่', price: 15, image: IMG(80) },
    { id: 'fanta', name: 'น้ำแดงแฟนต้า', price: 15, image: IMG(543) },
    { id: 'sprite', name: 'สไปร์ท', price: 15, image: IMG(345) },
    { id: 'coconut', name: 'มะพร้าวปั่น', price: 45, image: IMG(333) },
    { id: 'thai-tea', name: 'ชาไทย', price: 40, image: IMG(1) },
    { id: 'green-tea', name: 'ชาเขียว', price: 40, image: IMG(10) },
    { id: 'black-tea', name: 'ชาดำเย็น', price: 40, image: IMG(5) },
    { id: 'lemon-tea', name: 'ชามะนาว', price: 40, image: IMG(13) },
    { id: 'pink-milk', name: 'นมชมพู', price: 40, image: IMG(14) },
    { id: 'cocoa', name: 'โกโก้', price: 40, image: IMG(9) },
  ],
  kaosoi: [
    { id: 'soi1', name: 'ข้าวซอยไก่', price: 65, image: IMG(111) },
    { id: 'soi3', name: 'น้ำเงี้ยว', price: 60, image: IMG(555) },
    { id: 'soi4', name: 'แคบหมู', price: 13, image: IMG(98789) },
    { id: 'soi10', name: 'ไข่', price: 10, image: IMG(1090) },
  ],
  kaomutod: [
    { id: 'kao1', name: 'ข้าวหมูทอด', price: 50, image: IMG(7667) },
    { id: 'soi10', name: 'ไข่', price: 10, image: IMG(1090) },
  ],
  soda: [
    { id: 'red-lime-soda', name: 'แดงมะนาวโซดา', price: 35, image: IMG(23) },
    { id: 'blue-hawaii-soda', name: 'บลูฮาวายมะนาวโซดา', price: 35, image: IMG(26) },
    { id: 'honey-lime-soda', name: 'น้ำผึ้งมะนาวโซดา', price: 35, image: IMG(27) },
    { id: 'apple-soda', name: 'แอปเปิ้ลโซดา', price: 35, image: IMG(24) },
    { id: 'orange-soda', name: 'ส้มโซดา', price: 35, image: IMG(25) },
    { id: 'strawberry-soda', name: 'สตรอเบอร์รี่โซดา', price: 35, image: IMG(30) },
    { id: 'blueberry-soda', name: 'บลูเบอร์รี่โซดา', price: 35, image: IMG(21) },
    { id: 'strawberry-yogurt', name: 'สตรอเบอร์รี่โยเกิร์ต', price: 55, image: IMG(16) },
    { id: 'orange-yogurt', name: 'ส้มโยเกิร์ต', price: 55, image: IMG(17) },
    { id: 'mango-yogurt', name: 'มะม่วงโยเกิร์ต', price: 55, image: IMG(18) },
    { id: 'pineapple-yogurt', name: 'สับปะรดโยเกิร์ต', price: 55, image: IMG(19) },
    { id: 'mix-berry-yogurt', name: 'มิกซ์เบอร์รี่โยเกิร์ต', price: 55, image: IMG(20) },
  ],
};

// ==================== State ====================
let cart = [];
let orderNumber = 1001;
let currentCategory = 'coffee';
let selectedTemp = "เย็น";
let selectedSweet = "หวานปกติ";

// ==================== DOM ====================
const currentDateEl = document.getElementById('currentDate');
const orderNumberEl = document.getElementById('orderNumber');
const categoryBtns = document.querySelectorAll('.category-btn');
const productsGrid = document.getElementById('productsGrid');
const cartItemsEl = document.getElementById('cartItems');
const cartEmptyEl = document.getElementById('cartEmpty');
const totalEl = document.getElementById('total');
const clearCartBtn = document.getElementById('clearCart');
const completeOrderBtn = document.getElementById('completeOrder');
const receiptModal = document.getElementById('receiptModal');
const receiptOrderNum = document.getElementById('receiptOrderNum');
const receiptDate = document.getElementById('receiptDate');
const receiptItemsEl = document.getElementById('receiptItems');
const receiptTotal = document.getElementById('receiptTotal');
const printReceiptBtn = document.getElementById('printReceipt');
const newOrderBtn = document.getElementById('newOrder');
const confirmOrderModal = document.getElementById('confirmOrderModal');
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
    btn.addEventListener('click', () => addToCart(btn.dataset));
  });
}

// ==================== Cart ====================
function addToCart({ id, name, price, image }) {
  cart.push({ id, name, price: parseFloat(price), qty: 1, image, temp: selectedTemp, sweet: selectedSweet });
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
        <div class="cart-item-meta">${item.temp} · ${item.sweet}</div>
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

  // Update main cart badge (desktop sidebar)
  const badge = document.getElementById('cartBadge');
  if (badge) {
    if (totalQty > 0) {
      badge.textContent = totalQty;
      badge.style.display = 'inline-flex';
    } else {
      badge.style.display = 'none';
    }
  }

  // Update FAB badge (mobile top-right)
  if (cartFabBadge) {
    if (totalQty > 0) {
      cartFabBadge.textContent = totalQty;
      cartFabBadge.style.display = 'inline-flex';
    } else {
      cartFabBadge.style.display = 'none';
    }
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
    // วันใหม่ — reset เลขออเดอร์
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
    date: new Date().toISOString(),
    items: cart.map((i) => ({ name: i.name, price: i.price, qty: i.qty, temp: i.temp, sweet: i.sweet })),
    total,
    status: 'pending',
  };
  await push(ref(db, 'orders'), order);
}

// ==================== Receipt ====================
function showReceipt() {
  const total = cart.reduce((sum, i) => sum + i.price * i.qty, 0);
  receiptOrderNum.textContent = orderNumber;
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
  confirmOrderList.innerHTML = cart.map((i) =>
    `<div class="confirm-order-item"><span>${i.name} × ${i.qty}</span><span>${formatMoney(i.price * i.qty)}</span></div>`
  ).join('');
  confirmTotal.innerHTML = `<span>รวมทั้งหมด</span><span>${formatMoney(total)}</span>`;
  confirmOrderModal.setAttribute('aria-hidden', 'false');
}

function closeConfirmOrderModal() {
  confirmOrderModal.setAttribute('aria-hidden', 'true');
}

// ==================== New Order (ปิดโต๊ะ → เปิดโต๊ะใหม่) ====================
async function newOrder() {
  orderNumber += 1;
  orderNumberEl.textContent = orderNumber;
  await update(ref(db, 'meta'), {
    orderNumber,
    lastOrderDate: new Date().toISOString().slice(0, 10)
  });

  // Reset cart สำหรับลูกค้าคนใหม่ — admin ยังเห็นออเดอร์เดิมตามปกติ
  cart = [];
  renderCart();
  closeReceipt();

  // ปิด cart panel บน mobile (กลับสู่สถานะ "ปิดโต๊ะ")
  if (isMobile()) {
    closeCart(true);
  }
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

// ==================== Cart FAB (top-right toggle button) ====================
const cartFab = document.getElementById('cartFab');
const cartFabBadge = document.getElementById('cartFabBadge');

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

// FAB → toggle cart (mobile only)
if (cartFab) {
  cartFab.addEventListener('click', () => {
    if (!isMobile()) return;
    if (isOpen) closeCart(); else { getCartMetrics(); openCart(); }
  });
}

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
