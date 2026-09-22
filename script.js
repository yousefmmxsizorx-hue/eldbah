// ==================== إعدادات Supabase ====================
const SUPABASE_URL = 'https://oncagftjasfxyliybbrx.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9uY2FnZnRqYXNmeGx5aXJiYnhyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk5ODU2NDMsImV4cCI6MjEwNTU2MTY0M30.-p_W4_1Eo7-76RHpRXkfgQ2lhYstp45YKXpxiZXahLo';

const { createClient } = supabase;
const db = createClient(SUPABASE_URL, SUPABASE_KEY);

// ==================== بيانات المستخدم ====================
let currentUser = JSON.parse(localStorage.getItem('eldbah_user') || 'null');
let pendingBidProductId = null;

// ==================== عناصر الصفحة ====================
const productsGrid = document.getElementById('products-grid');
const userModal = document.getElementById('user-modal');
const userNameInput = document.getElementById('user-name');
const userPhoneInput = document.getElementById('user-phone');
const saveUserBtn = document.getElementById('save-user-btn');
const toast = document.getElementById('toast');

// ==================== أدوات مساعدة ====================
function showToast(message, type = 'success') {
  toast.textContent = message;
  toast.className = 'toast ' + type;
  setTimeout(() => toast.classList.add('hidden'), 3000);
}

function formatPrice(price) {
  return Number(price).toLocaleString('ar-EG') + ' ج.م';
}

// ==================== تحميل المنتجات ====================
async function loadProducts() {
  const { data, error } = await db
    .from('products')
    .select('*')
    .eq('status', 'active')
    .order('id', { ascending: true });

  if (error) {
    productsGrid.innerHTML = '<p class="loading">حدث خطأ في التحميل</p>';
    console.error(error);
    return;
  }

  if (!data || data.length === 0) {
    productsGrid.innerHTML = '<p class="loading">لا توجد منتجات حالياً</p>';
    return;
  }

  productsGrid.innerHTML = '';
  data.forEach(product => {
    productsGrid.appendChild(createProductCard(product));
  });
}

// ==================== إنشاء كارت المنتج ====================
function createProductCard(product) {
  const card = document.createElement('div');
  card.className = 'product-card';
  card.dataset.productId = product.id;

  card.innerHTML = `
    <div class="product-image">⚖️</div>
    <div class="product-body">
      <h3 class="product-title">${product.title}</h3>
      <p class="product-desc">${product.description || ''}</p>
      <div class="product-price">
        <span class="price-label">السعر الحالي</span>
        <span class="price-value" id="price-${product.id}">${formatPrice(product.current_price)}</span>
      </div>
      <button class="btn-bid" onclick="handleBid(${product.id})">
        زايد +50 ج.م 🔥
      </button>
    </div>
  `;

  return card;
}

// ==================== المزايدة ====================
async function handleBid(productId) {
  // لو المستخدم مش مسجل، نفتح المودال
  if (!currentUser) {
    pendingBidProductId = productId;
    userModal.classList.remove('hidden');
    return;
  }

  await placeBid(productId);
}

async function placeBid(productId) {
  // نجيب السعر الحالي
  const { data: product, error: fetchError } = await db
    .from('products')
    .select('current_price, highest_bidder_name')
    .eq('id', productId)
    .single();

  if (fetchError) {
    showToast('حدث خطأ، جرب تاني', 'error');
    return;
  }

  // لو المستخدم هو آخر مزايد
  if (product.highest_bidder_name === currentUser.name) {
    showToast('إنت أصلاً أعلى مزايد!', 'error');
    return;
  }

  const newPrice = Number(product.current_price) + 50;

  // نحدّث المنتج
  const { error: updateError } = await db
    .from('products')
    .update({
      current_price: newPrice,
      highest_bidder_name: currentUser.name
    })
    .eq('id', productId);

  if (updateError) {
    showToast('فشلت المزايدة، جرب تاني', 'error');
    console.error(updateError);
    return;
  }

  // نسجّل المزايدة
  await db.from('bids').insert({
    product_id: productId,
    user_name: currentUser.name,
    amount: newPrice
  });

  showToast('تمت المزايدة بنجاح! 🎉', 'success');
}

// ==================== تسجيل المستخدم ====================
saveUserBtn.addEventListener('click', () => {
  const name = userNameInput.value.trim();
  const phone = userPhoneInput.value.trim();

  if (!name || !phone) {
    alert('اكتب الاسم ورقم التليفون');
    return;
  }

  currentUser = { name, phone };
  localStorage.setItem('eldbah_user', JSON.stringify(currentUser));

  userModal.classList.add('hidden');
  showToast(`أهلاً ${name}! 🎉`);

  // لو كان في مزايدة معلقة
  if (pendingBidProductId) {
    placeBid(pendingBidProductId);
    pendingBidProductId = null;
  }
});

// ==================== الاستماع للتحديثات اللحظية ====================
function subscribeToChanges() {
  db.channel('products-changes')
    .on('postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'products' },
      (payload) => {
        const product = payload.new;
        const priceEl = document.getElementById(`price-${product.id}`);
        if (priceEl) {
          priceEl.textContent = formatPrice(product.current_price);
          priceEl.style.animation = 'none';
          setTimeout(() => {
            priceEl.style.animation = 'pulse 0.5s';
          }, 10);
        }
      }
    )
    .subscribe();
}

// ==================== تشغيل ====================
loadProducts();
subscribeToChanges();
