import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, setDoc, deleteDoc, onSnapshot, addDoc } from 'firebase/firestore';
import { getAuth, signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged } from 'firebase/auth';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import firebaseConfig from './firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
const auth = getAuth(app);
const storage = getStorage(app);
const provider = new GoogleAuthProvider();

// Initial Products Data (Fallback if DB is empty)
const initialProducts = [
  { id: '1', name: 'الكرسي المريح', price: 850, category: 'غرفة المعيشة', rating: 4.8, reviews: 124, images: ['https://images.unsplash.com/photo-1598300042247-d088f8ab3a91?auto=format&fit=crop&w=800&q=80', 'https://images.unsplash.com/photo-1567538096630-e0c55bd6374c?auto=format&fit=crop&w=800&q=80'], desc: 'كرسي مريح مصنوع يدوياً من خشب البلوط الصلب والكتان الفاخر.', isNew: true, salePrice: null },
  { id: '2', name: 'طاولة طعام خشب الجوز', price: 1450, category: 'غرفة الطعام', rating: 4.9, reviews: 86, images: ['https://images.unsplash.com/photo-1617806118233-18e1c0945594?auto=format&fit=crop&w=800&q=80'], desc: 'طاولة طعام قابلة للتوسيع مصنوعة من خشب الجوز الداكن المستدام.', isNew: false, salePrice: 1250 },
  { id: '3', name: 'إطار سرير بسيط', price: 1200, category: 'غرفة النوم', rating: 4.7, reviews: 210, images: ['https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=800&q=80'], desc: 'إطار سرير بتصميم أنيق ومنخفض من خشب الدردار الفاتح.', isNew: false, salePrice: null },
  { id: '4', name: 'مكتب عمل خشبي', price: 650, category: 'المكتب', rating: 4.6, reviews: 45, images: ['https://images.unsplash.com/photo-1518455027359-f3f8164ba6bd?auto=format&fit=crop&w=800&q=80'], desc: 'مكتب عمل مدمج مع مساحات تخزين مخفية.', isNew: true, salePrice: null },
  { id: '5', name: 'أريكة استرخاء', price: 2100, category: 'غرفة المعيشة', rating: 4.9, reviews: 312, images: ['https://images.unsplash.com/photo-1555041469-a586c61ea9bc?auto=format&fit=crop&w=800&q=80'], desc: 'أريكة واسعة بثلاثة مقاعد مع وسائد عميقة وقاعدة خشبية صلبة.', isNew: false, salePrice: 1890 },
  { id: '6', name: 'طاولة جانبية للسرير', price: 280, category: 'غرفة النوم', rating: 4.5, reviews: 67, images: ['https://images.unsplash.com/photo-1532372320572-cda25653a26d?auto=format&fit=crop&w=800&q=80'], desc: 'طاولة جانبية بسيطة وأنيقة مع درج واحد ورف مفتوح.', isNew: false, salePrice: null },
  { id: '7', name: 'طقم كراسي طعام (2)', price: 450, category: 'غرفة الطعام', rating: 4.8, reviews: 112, images: ['https://images.unsplash.com/photo-1592078615290-033ee584e267?auto=format&fit=crop&w=800&q=80'], desc: 'طقم من كرسيين مريحين لغرفة الطعام بظهر خشبي منحني.', isNew: false, salePrice: null },
  { id: '8', name: 'وحدة رفوف للكتب', price: 890, category: 'غرفة المعيشة', rating: 4.7, reviews: 54, images: ['https://images.unsplash.com/photo-1594026112284-02bb6f3352fe?auto=format&fit=crop&w=800&q=80'], desc: 'وحدة رفوف طويلة مفتوحة من الخلف مثالية لعرض الديكور والكتب.', isNew: true, salePrice: null }
];

// State Management
const state = {
  products: [],
  cart: JSON.parse(localStorage.getItem('almadinah_cart')) || [],
  wishlist: JSON.parse(localStorage.getItem('almadinah_wishlist')) || [],
  subscribers: [],
  promoCode: null,
  currentRoute: window.location.pathname,
  searchQuery: '',
  activeCategory: 'الكل',
  priceRange: 50000,
  sortBy: 'newest',
  isAdminAuth: false
};

// Listen to Auth State
onAuthStateChanged(auth, (user) => {
  if (user && user.email === 'bodamomo2010@gmail.com') {
    state.isAdminAuth = true;
    
    // Listen for subscribers
    onSnapshot(collection(db, 'subscribers'), (snapshot) => {
      state.subscribers = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      if (state.currentRoute === '/admin') {
        const appDiv = document.getElementById('app');
        if (appDiv) appDiv.innerHTML = renderAdmin();
      }
    });
  } else {
    state.isAdminAuth = false;
  }
  
  // Re-render if on admin page
  if (state.currentRoute === '/admin') {
    const appDiv = document.getElementById('app');
    if (appDiv) {
      appDiv.innerHTML = renderAdmin();
      attachEventListeners();
      if (window.lucide) window.lucide.createIcons();
    }
  }
});

// Listen to Firestore for products
onSnapshot(collection(db, 'products'), (snapshot) => {
  const products = [];
  snapshot.forEach((doc) => {
    products.push({ id: doc.id, ...doc.data() });
  });
  
  if (products.length === 0 && state.products.length === 0) {
    // Seed initial products if empty
    initialProducts.forEach(async (p) => {
      await setDoc(doc(db, 'products', p.id), p);
    });
  } else {
    state.products = products;
    // Re-render current view without pushing history
    const appDiv = document.getElementById('app');
    if (appDiv) {
      const urlParams = new URLSearchParams(window.location.search);
      const id = urlParams.get('id');
      const params = id ? { id } : {};
      const renderFunc = routes[state.currentRoute] || render404;
      appDiv.innerHTML = renderFunc(params);
      attachEventListeners();
      initScrollReveal();
      if (window.lucide) window.lucide.createIcons();
    }
  }
}, (error) => {
  console.error("Firestore Error:", error);
  if (error.message && error.message.includes('Quota')) {
    window.showToast('تنبيه: تم تجاوز الحد الأقصى لقاعدة البيانات (Quota Exceeded). يرجى المحاولة لاحقاً.');
  }
});

// Save state to localStorage (only cart and wishlist now)
function saveState() {
  localStorage.setItem('almadinah_cart', JSON.stringify(state.cart));
  localStorage.setItem('almadinah_wishlist', JSON.stringify(state.wishlist));
  updateCartBadge();
}

// Router
const routes = {
  '/': renderHome,
  '/shop': renderShop,
  '/product': renderProduct,
  '/cart': renderCart,
  '/checkout': renderCheckout,
  '/about': renderAbout,
  '/contact': renderContact,
  '/admin': renderAdmin
};

window.navigateTo = function(path, params = {}) {
  const appDiv = document.getElementById('app');
  appDiv.style.opacity = 0;
  
  setTimeout(() => {
    state.currentRoute = path;
    const queryString = params.id ? `?id=${params.id}` : '';
    window.history.pushState(params, '', path + queryString);
    
    document.getElementById('mobile-menu').classList.remove('open');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    
    const renderFunc = routes[path] || render404;
    appDiv.innerHTML = renderFunc(params);
    
    attachEventListeners();
    initScrollReveal();
    if (window.lucide) window.lucide.createIcons();
    
    appDiv.style.opacity = 1;
  }, 300);
}

window.addEventListener('popstate', (e) => {
  const path = window.location.pathname;
  const urlParams = new URLSearchParams(window.location.search);
  const id = urlParams.get('id');
  
  const appDiv = document.getElementById('app');
  appDiv.style.opacity = 0;
  
  setTimeout(() => {
    state.currentRoute = path;
    const renderFunc = routes[path] || render404;
    appDiv.innerHTML = renderFunc(id ? { id } : {});
    attachEventListeners();
    initScrollReveal();
    if (window.lucide) window.lucide.createIcons();
    appDiv.style.opacity = 1;
  }, 300);
});

// UI Components
function renderNavbar() {
  const cartCount = state.cart.reduce((sum, item) => sum + item.quantity, 0);
  return `
    <nav class="navbar" id="main-nav">
      <div class="container nav-container">
        <a onclick="navigateTo('/')" class="logo nav-link-route">المدينة المنورة</a>
        <div class="nav-links">
          <a onclick="navigateTo('/')" class="nav-link nav-link-route ${state.currentRoute === '/' ? 'active' : ''}">الرئيسية</a>
          <a onclick="navigateTo('/shop')" class="nav-link nav-link-route ${state.currentRoute === '/shop' ? 'active' : ''}">المتجر</a>
          <a onclick="navigateTo('/admin')" class="nav-link nav-link-route ${state.currentRoute === '/admin' ? 'active' : ''}">الإدارة</a>
        </div>
        <div class="nav-icons">
          <button class="icon-btn" onclick="navigateTo('/shop')"><i data-lucide="search"></i></button>
          <button class="icon-btn cart-icon-wrapper" onclick="navigateTo('/cart')" id="cart-btn">
            <i data-lucide="shopping-cart"></i>
            <span class="cart-badge" id="cart-badge">${cartCount}</span>
          </button>
          <button class="hamburger" id="hamburger-btn" onclick="document.getElementById('mobile-menu').classList.add('open')"><i data-lucide="menu"></i></button>
        </div>
      </div>
    </nav>
    
    <div class="mobile-menu" id="mobile-menu">
      <button class="close-modal" id="close-mobile-menu" onclick="document.getElementById('mobile-menu').classList.remove('open')" style="position:absolute; top:20px; left:20px;"><i data-lucide="x"></i></button>
      <a onclick="navigateTo('/')" class="nav-link nav-link-route">الرئيسية</a>
      <a onclick="navigateTo('/shop')" class="nav-link nav-link-route">المتجر</a>
      <a onclick="navigateTo('/cart')" class="nav-link nav-link-route">السلة</a>
      <a onclick="navigateTo('/admin')" class="nav-link nav-link-route">الإدارة</a>
    </div>
  `;
}

function renderFooter() {
  return `
    <footer class="footer">
      <div class="container">
        <div class="footer-grid">
          <div>
            <div class="footer-logo">المدينة المنورة</div>
            <p class="footer-tagline">أثاث خشبي صلب مصنوع بدقه لمنازل تنبض بالحياة.</p>
            <div class="social-links">
              <a href="https://www.facebook.com/Elmadina.Elmnoara?locale=ar_AR" class="social-link" target="_blank" title="فيسبوك">
                <svg viewBox="0 0 24 24" width="22" height="22" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"></path></svg>
              </a>
               <a href="https://www.instagram.com/elmadina.elmnoara.gallery?fbclid=IwY2xjawQ92XJleHRuA2FlbQIxMABicmlkETFyMURhVG1tT0lqNjF6c3d2c3J0YwZhcHBfaWQQMjIyMDM5MTc4ODIwMDg5MgABHo4so9L3c-ADm59at_tWchOUfBtEWfJ8z9N3YSr75E9o_LXj8Sr_uque7rge_aem_gWBI-RD6V9y36_U34DKv7g" class="social-link" target="_blank" title="انستجرام">
                <svg viewBox="0 0 24 24" width="22" height="22" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line></svg>
              </a>
              <a href="https://wa.me/201013600821" class="social-link" target="_blank" title="واتساب">
                <svg viewBox="0 0 24 24" width="22" height="22" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path></svg>
              </a>
            </div>
          </div>
          <div>
            <h4 class="footer-title">المتجر</h4>
            <ul class="footer-links">
              <li><a onclick="navigateTo('/shop')">جميع المنتجات</a></li>
              <li><a onclick="navigateTo('/shop')">غرفة المعيشة</a></li>
              <li><a onclick="navigateTo('/shop')">غرفة النوم</a></li>
              <li><a onclick="navigateTo('/shop')">غرفة الطعام</a></li>
              <li><a onclick="navigateTo('/shop')">غرفة أطفال</a></li>
            </ul>
          </div>
          <div>
            <h4 class="footer-title">عن الشركة</h4>
            <ul class="footer-links">
              <li><a onclick="navigateTo('/about')">قصتنا</a></li>
              <li><a href="#">الاستدامة</a></li>
              <li><a href="#">المواد المستخدمة</a></li>
              <li><a href="#">الحرفية</a></li>
            </ul>
          </div>
          <div>
            <h4 class="footer-title">الدعم</h4>
            <ul class="footer-links">
              <li><a onclick="navigateTo('/contact')" style="cursor: pointer;">اتصل بنا</a></li>
              <li><a onclick="navigateTo('/admin')" style="cursor: pointer;">تسجيل دخول الإدارة</a></li>
            </ul>
          </div>
          <div>
            <h4 class="footer-title">فروعنا</h4>
            <a href="https://maps.app.goo.gl/mrqew284aCFR9gNF7" target="_blank" style="color: var(--accent-gold); font-size: 0.9rem; text-decoration: none; display: flex; align-items: center; gap: 5px; margin-bottom: 10px;">
              <i data-lucide="map-pin" style="width: 16px; height: 16px;"></i> الفرع الأول
            </a>
            <a href="https://maps.app.goo.gl/hrKEBDUmAGv3Sqx59" target="_blank" style="color: var(--accent-gold); font-size: 0.9rem; text-decoration: none; display: flex; align-items: center; gap: 5px;">
              <i data-lucide="map-pin" style="width: 16px; height: 16px;"></i> الفرع الثاني
            </a>
          </div>
        </div>
        <div class="footer-bottom" style="display: flex; flex-direction: column; align-items: center; gap: 8px;">
          <div>&copy; ${new Date().getFullYear()} المدينة المنورة. جميع الحقوق محفوظة.</div>
          <div style="font-size: 0.85rem; color: #a0a0a0; display: flex; align-items: center; gap: 8px; flex-wrap: wrap; justify-content: center; direction: ltr;">
            <span>Developed by</span>
            <a href="https://mahmoud-rabea.netlify.app" target="_blank" style="color: var(--accent-gold); text-decoration: none; font-weight: bold; letter-spacing: 0.5px; transition: color 0.3s;" onmouseover="this.style.color='#fff'" onmouseout="this.style.color='var(--accent-gold)'" title="Portfolio">Mahmoud Rabea</a>
            <span style="color: #555;">|</span>
            <a href="https://www.linkedin.com/in/mahmoud-rabea-456547259" target="_blank" style="color: #a0a0a0; text-decoration: none; display: flex; align-items: center; transition: color 0.3s;" onmouseover="this.style.color='#0a66c2'" onmouseout="this.style.color='#a0a0a0'" title="LinkedIn">
              <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"></path><rect x="2" y="9" width="4" height="12"></rect><circle cx="4" cy="4" r="2"></circle></svg>
            </a>
          </div>
        </div>
      </div>
    </footer>
  `;
}

function renderProductCard(product) {
  if (!product) return '';
  const priceDisplay = product.salePrice 
    ? `<span class="product-price">${product.salePrice} ج.م</span><span class="product-original-price">${product.price || 0} ج.م</span>`
    : `<span class="product-price">${product.price || 0} ج.م</span>`;
    
  const badge = product.salePrice ? '<div class="product-badge" style="color: #e74c3c;">تخفيض</div>' : 
                (product.isNew ? '<div class="product-badge">جديد</div>' : '');
                
  const isWishlisted = state.wishlist.includes(product.id);
  
  let firstImage = '#ccc';
  if (product.images && Array.isArray(product.images) && product.images.length > 0 && product.images[0]) {
    firstImage = product.images[0];
  } else if (product.image) {
    firstImage = product.image;
  }
  
  const isUrl = typeof firstImage === 'string' && (firstImage.startsWith('http') || firstImage.startsWith('data:image'));
  const imageHtml = isUrl 
    ? `<img src="${firstImage}" alt="${product.name || ''}">`
    : `<div style="width:100%; height:100%; background-color:${firstImage};"></div>`;

  return `
    <div class="product-card reveal" data-id="${product.id}">
      ${badge}
      <button class="wishlist-btn ${isWishlisted ? 'active' : ''}" onclick="toggleWishlist(event, '${product.id}')">
        ${isWishlisted ? '<i data-lucide="heart" fill="currentColor" style="width: 18px; height: 18px;"></i>' : '<i data-lucide="heart" style="width: 18px; height: 18px;"></i>'}
      </button>
      <div class="product-image" onclick="navigateTo('/product', {id: '${product.id}'})">
        ${imageHtml}
      </div>
      <div class="product-info" onclick="navigateTo('/product', {id: '${product.id}'})">
        <div class="product-category">${product.category || ''}</div>
        <h3 class="product-title">${product.name || 'بدون اسم'}</h3>
        <p class="product-desc">${product.desc || ''}</p>
        <div class="product-meta">
          <div>${priceDisplay}</div>
          <div class="product-rating" style="display:flex; align-items:center; gap:4px;"><i data-lucide="star" fill="currentColor" style="width: 14px; height: 14px; color: var(--accent-gold);"></i> ${product.rating || 0}</div>
        </div>
        <button class="btn add-to-cart-btn" onclick="addToCart(event, '${product.id}')">أضف إلى السلة</button>
      </div>
    </div>
  `;
}

// Pages
function renderHome() {
  const bestSellers = state.products.slice(0, 4);
  
  return `
    <section class="hero">
      <div class="hero-content">
        <div class="hero-badge">شحن مجاني للطلبات فوق 25000 ج.م</div>
        <h1>حيث تلتقي الطبيعة بالحرفية</h1>
        <p>أثاث خشبي صلب مصنوع بدقه لمنازل تنبض بالحياة.</p>
        <div class="hero-btns">
          <button class="btn btn-primary" onclick="navigateTo('/shop')">تسوق المجموعة</button>
          <button class="btn btn-outline" onclick="navigateTo('/about')">قصتنا</button>
        </div>
      </div>
      <div class="scroll-down">↓</div>
    </section>
    
    <section class="trust-bar">
      <div class="container trust-grid">
        <div class="trust-item">
          <div class="trust-icon"><i data-lucide="truck"></i></div>
          <div class="trust-text">توصيل مجاني</div>
        </div>
        <div class="trust-item">
          <div class="trust-icon"><i data-lucide="shield-check"></i></div>
          <div class="trust-text">ضمان 5 سنوات</div>
        </div>
        <div class="trust-item">
          <div class="trust-icon"><i data-lucide="tree-pine"></i></div>
          <div class="trust-text">مصادر مستدامة</div>
        </div>
        <div class="trust-item">
          <div class="trust-icon"><i data-lucide="hammer"></i></div>
          <div class="trust-text">صناعة يدوية</div>
        </div>
      </div>
    </section>
    
    <section class="section container">
      <div class="text-center reveal">
        <h2 class="h2 mb-2">لماذا المدينة المنورة؟</h2>
        <p class="text-lg text-gray-dark">نحن نؤمن بالأثاث الذي يدوم لأجيال.</p>
      </div>
      <div class="features-grid">
        <div class="feature-card reveal" style="transition-delay: 0.1s">
          <div class="feature-icon"><i data-lucide="leaf"></i></div>
          <h3>مواد طبيعية 100٪</h3>
          <p>لا نستخدم قشور صناعية أو تشطيبات سامة. فقط خشب صلب نقي معالج بزيوت طبيعية.</p>
        </div>
        <div class="feature-card reveal" style="transition-delay: 0.2s">
          <div class="feature-icon"><i data-lucide="hammer"></i></div>
          <h3>حرفيون مهرة</h3>
          <p>يتم بناء كل قطعة بواسطة حرفيين يتمتعون بعقود من الخبرة في النجارة التقليدية.</p>
        </div>
        <div class="feature-card reveal" style="transition-delay: 0.3s">
          <div class="feature-icon"><i data-lucide="recycle"></i></div>
          <h3>صديق للبيئة</h3>
          <p>مقابل كل شجرة نستخدمها، نزرع ثلاث أشجار أخرى. ورشتنا تعمل بالطاقة المتجددة 100٪.</p>
        </div>
      </div>
    </section>
    
    <section class="section container" style="background-color: var(--white); border-radius: 24px; padding: 60px 40px; margin-bottom: 80px; box-shadow: var(--shadow-sm);">
      <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 40px;" class="reveal">
        <div>
          <h2 class="h2">الأكثر مبيعاً</h2>
          <p>القطع الأكثر طلباً، جاهزة لمنزلك.</p>
        </div>
        <button class="btn btn-outline-dark" onclick="navigateTo('/shop')">عرض الكل</button>
      </div>
      <div class="product-grid">
        ${bestSellers.map(p => renderProductCard(p)).join('')}
      </div>
    </section>
    
    <section class="section container testimonials">
      <div class="text-center reveal">
        <h2 class="h2 mb-2">ماذا يقول عملاؤنا</h2>
        <p>قصص حقيقية من منازل حقيقية.</p>
      </div>
      <div class="testimonial-grid">
        <div class="testimonial-card reveal" style="transition-delay: 0.1s">
          <div class="quote-icon">"</div>
          <p class="testimonial-text">ترابيزة السفرة خشب الجوز غيرت شكل الأوضة بالكامل. الفينيش والتقفيل ممتاز جداً. دي مش مجرد عفش، دي تحفة فنية.</p>
          <div class="testimonial-author">سارة أحمد</div>
          <div class="testimonial-city">سوهاج</div>
        </div>
        <div class="testimonial-card reveal" style="transition-delay: 0.2s">
          <div class="quote-icon">"</div>
          <p class="testimonial-text">السرير متين جداً وتصميمه مودرن وبسيط. ريحة الخشب الطبيعي أول ما وصل كانت تحفة، بصراحة شغل عالي ومحترم.</p>
          <div class="testimonial-author">محمد عبدالله</div>
          <div class="testimonial-city">أسيوط</div>
        </div>
        <div class="testimonial-card reveal" style="transition-delay: 0.3s">
          <div class="quote-icon">"</div>
          <p class="testimonial-text">خدمة العملاء محترمين جداً، والركنة مريحة لأبعد الحدود وخامتها ممتازة. بصراحة تستحق كل جنيه اندفع فيها.</p>
          <div class="testimonial-author">فاطمة علي</div>
          <div class="testimonial-city">سوهاج</div>
        </div>
      </div>
    </section>
    
    <section class="newsletter reveal">
      <div class="container">
        <h2 class="h2">انضم لعائلة المدينة المنورة</h2>
        <p>اشترك في نشرتنا الإخبارية للحصول على إلهام التصميم، والوصول الجديد، وخصم 10٪ على طلبك الأول.</p>
        <form class="newsletter-form" onsubmit="window.subscribeNewsletter(event)">
          <input type="email" class="newsletter-input" placeholder="أدخل بريدك الإلكتروني" required>
          <button type="submit" class="btn btn-primary">احصل على الخصم</button>
        </form>
      </div>
    </section>
  `;
}

function renderShop() {
  const categories = ['الكل', 'غرفة المعيشة', 'غرفة النوم', 'غرفة الطعام', 'غرفة أطفال', 'المكتب'];

  // Generate skeleton cards
  const skeletons = Array(6).fill(0).map(() => `
    <div class="product-card">
      <div class="product-image skeleton"></div>
      <div class="product-info">
        <div class="skeleton" style="height: 12px; width: 40%; margin-bottom: 10px;"></div>
        <div class="skeleton" style="height: 20px; width: 80%; margin-bottom: 10px;"></div>
        <div class="skeleton" style="height: 14px; width: 100%; margin-bottom: 20px;"></div>
        <div class="skeleton" style="height: 20px; width: 30%; margin-bottom: 15px;"></div>
        <div class="skeleton" style="height: 48px; width: 100%; border-radius: 8px;"></div>
      </div>
    </div>
  `).join('');

  setTimeout(() => {
    window.renderFilteredProducts();
  }, 600);

  return `
    <div class="container shop-layout">
      <aside class="sidebar-filter reveal">
        <div class="filter-group">
          <h3 class="filter-title">الفئات</h3>
          <ul class="filter-list">
            ${categories.map(cat => `
              <li>
                <label class="filter-label">
                  <input type="radio" name="category" value="${cat}" ${state.activeCategory === cat ? 'checked' : ''} onchange="window.updateFilter('category', this.value)">
                  ${cat}
                </label>
              </li>
            `).join('')}
          </ul>
        </div>
        
        <div class="filter-group">
          <h3 class="filter-title">الحد الأقصى للسعر: <span id="price-display">${state.priceRange}</span> ج.م</h3>
          <input type="range" min="0" max="100000" step="50" value="${state.priceRange}" style="width: 100%; accent-color: var(--accent-gold);" oninput="document.getElementById('price-display').innerText = this.value" onchange="window.updateFilter('price', this.value)">
        </div>
      </aside>
      
      <main>
        <div class="shop-header reveal">
          <div class="search-bar">
            <i data-lucide="search" style="color: var(--gray-dark);"></i>
            <input type="text" placeholder="ابحث عن المنتجات..." value="${state.searchQuery}" onkeyup="window.updateFilter('search', this.value)">
          </div>
          
          <select class="sort-dropdown" onchange="window.updateFilter('sort', this.value)">
            <option value="newest" ${state.sortBy === 'newest' ? 'selected' : ''}>الأحدث</option>
            <option value="price-low" ${state.sortBy === 'price-low' ? 'selected' : ''}>السعر: من الأقل للأعلى</option>
            <option value="price-high" ${state.sortBy === 'price-high' ? 'selected' : ''}>السعر: من الأعلى للأقل</option>
            <option value="rating" ${state.sortBy === 'rating' ? 'selected' : ''}>الأعلى تقييماً</option>
          </select>
        </div>
        
        <div class="product-grid" id="shop-product-grid">
          ${skeletons}
        </div>
        
        <div class="text-center mt-5 reveal">
          <button class="btn btn-outline-dark">تحميل المزيد</button>
        </div>
      </main>
    </div>
  `;
}

window.renderFilteredProducts = function() {
  let filtered = (state.products || []).filter(p => {
    const name = p.name || '';
    const desc = p.desc || '';
    const matchesSearch = name.toLowerCase().includes(state.searchQuery.toLowerCase()) || 
                          desc.toLowerCase().includes(state.searchQuery.toLowerCase());
    const matchesCategory = state.activeCategory === 'الكل' || p.category === state.activeCategory;
    const price = p.salePrice || p.price || 0;
    const matchesPrice = price <= state.priceRange;
    return matchesSearch && matchesCategory && matchesPrice;
  });
  
  filtered.sort((a, b) => {
    const priceA = a.salePrice || a.price;
    const priceB = b.salePrice || b.price;
    if (state.sortBy === 'price-low') return priceA - priceB;
    if (state.sortBy === 'price-high') return priceB - priceA;
    if (state.sortBy === 'rating') return b.rating - a.rating;
    return 0;
  });

  const grid = document.getElementById('shop-product-grid');
  if (grid) {
    if (filtered.length === 0) {
      grid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 50px;"><h3>لم يتم العثور على منتجات تطابق بحثك.</h3><button class="btn btn-outline-dark mt-4" onclick="window.resetFilters()">مسح الفلاتر</button></div>';
    } else {
      grid.innerHTML = filtered.map(p => renderProductCard(p)).join('');
      initScrollReveal();
    }
  }
}

window.updateFilter = function(type, value) {
  if (type === 'category') state.activeCategory = value;
  if (type === 'price') state.priceRange = parseInt(value);
  if (type === 'search') state.searchQuery = value;
  if (type === 'sort') state.sortBy = value;
  window.renderFilteredProducts();
}

window.resetFilters = function() {
  state.activeCategory = 'الكل';
  state.priceRange = 50000;
  state.searchQuery = '';
  state.sortBy = 'newest';
  navigateTo('/shop');
}

function renderProduct(params) {
  const product = state.products.find(p => p.id === params.id);
  
  if (!product) {
    return render404();
  }
  
  const priceDisplay = product.salePrice 
    ? `<span class="price">${product.salePrice} ج.م</span><span class="original-price">${product.price} ج.م</span>`
    : `<span class="price">${product.price} ج.م</span>`;
    
  const isWishlisted = state.wishlist.includes(product.id);
  
  const images = product.images && product.images.length > 0 ? product.images : [product.image || '#ccc'];
  
  const mainImageHtml = images[0].startsWith('http') || images[0].startsWith('data:image') 
    ? `<img src="${images[0]}" alt="${product.name}" id="main-product-image">`
    : `<div style="width:100%; height:100%; background-color:${images[0]};" id="main-product-image"></div>`;

  const thumbnailsHtml = images.map((img, index) => {
    const isImage = img.startsWith('http') || img.startsWith('data:image');
    const content = isImage ? `<img src="${img}" alt="thumbnail">` : `<div style="width:100%; height:100%; background-color:${img};"></div>`;
    return `<div class="thumbnail ${index === 0 ? 'active' : ''}" onclick="window.setMainImage('${img}', this)">${content}</div>`;
  }).join('');

  const relatedProducts = state.products
    .filter(p => p.category === product.category && p.id !== product.id)
    .slice(0, 4);

  return `
    <div class="container product-detail-layout">
      <div class="breadcrumb reveal">
        <a onclick="navigateTo('/')">الرئيسية</a> / 
        <a onclick="navigateTo('/shop')">المتجر</a> / 
        <a onclick="window.updateFilter('category', '${product.category}'); navigateTo('/shop')">${product.category}</a> / 
        <span>${product.name}</span>
      </div>
      
      <div class="product-detail-grid">
        <div class="product-gallery reveal">
          <div class="main-image">
            ${mainImageHtml}
          </div>
          <div class="thumbnail-grid">
            ${thumbnailsHtml}
          </div>
        </div>
        
        <div class="product-info-detail reveal" style="transition-delay: 0.2s">
          <div class="product-badge mb-2" style="display:inline-block; position:static;">${product.category}</div>
          <h1 class="h2">${product.name}</h1>
          
          <div class="rating" style="display:flex; align-items:center; gap:8px;">
            <div style="display:flex; gap:2px; color:var(--accent-gold);">
              <i data-lucide="star" fill="currentColor" style="width:16px; height:16px;"></i>
              <i data-lucide="star" fill="currentColor" style="width:16px; height:16px;"></i>
              <i data-lucide="star" fill="currentColor" style="width:16px; height:16px;"></i>
              <i data-lucide="star" fill="currentColor" style="width:16px; height:16px;"></i>
              <i data-lucide="star" fill="currentColor" style="width:16px; height:16px;"></i>
            </div>
            <span style="color: var(--gray-dark);">(${product.rating})</span>
            <span class="review-count">${product.reviews} تقييم</span>
          </div>
          
          <div class="price-row">
            ${priceDisplay}
          </div>
          
          <p class="description">${product.desc}</p>
          
          <ul class="specs-list">
            <li><span class="spec-name">المواد</span> <span>خشب صلب، طلاء زيت طبيعي</span></li>
            <li><span class="spec-name">الأبعاد</span> <span>عرض: 80سم x عمق: 85سم x ارتفاع: 90سم</span></li>
            <li><span class="spec-name">الوزن</span> <span>24 كجم</span></li>
          </ul>
          
          ${product.videoUrl ? `
          <div class="product-video mt-4 mb-4">
            <h3 class="h4 mb-2">فيديو المنتج</h3>
            <div style="position: relative; padding-bottom: 56.25%; height: 0; overflow: hidden; border-radius: 8px; box-shadow: var(--shadow-sm);">
              ${(product.videoUrl.includes('youtube.com') || product.videoUrl.includes('youtu.be')) 
                ? `<iframe src="${product.videoUrl.replace('watch?v=', 'embed/').replace('youtu.be/', 'youtube.com/embed/')}" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; border: none;" allowfullscreen></iframe>`
                : `<video controls style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; background: #000;"><source src="${product.videoUrl}" type="video/mp4">متصفحك لا يدعم تشغيل الفيديو.</video>`
              }
            </div>
          </div>
          ` : ''}
          
          <div class="action-row">
            <div class="quantity-selector">
              <button class="qty-btn" onclick="window.updateQty('detail-qty', -1)">-</button>
              <input type="number" id="detail-qty" class="qty-input" value="1" min="1">
              <button class="qty-btn" onclick="window.updateQty('detail-qty', 1)">+</button>
            </div>
            <button class="btn btn-primary add-to-cart-large" onclick="window.addToCartFromDetail('${product.id}')">أضف إلى السلة</button>
            <button class="btn ${isWishlisted ? 'btn-outline-dark' : 'btn-outline-dark'}" style="display:flex; align-items:center; gap:8px;" onclick="window.toggleWishlist(event, '${product.id}')">
              ${isWishlisted ? '<i data-lucide="heart" fill="currentColor" style="width:18px; height:18px;"></i> محفوظ' : '<i data-lucide="heart" style="width:18px; height:18px;"></i> حفظ'}
            </button>
          </div>
        </div>
      </div>
      
      <div class="tabs-container reveal">
        <div class="tabs-header">
          <button class="tab-btn active" onclick="window.switchTab('desc')">الوصف</button>
          <button class="tab-btn" onclick="window.switchTab('specs')">المواصفات</button>
          <button class="tab-btn" onclick="window.switchTab('reviews')">التقييمات</button>
          <button class="tab-btn" onclick="window.switchTab('shipping')">معلومات الشحن</button>
        </div>
        
        <div id="tab-desc" class="tab-content active">
          <p>صُنعت هذه القطعة باهتمام لا مثيل له بالتفاصيل، وتجسد فلسفتنا في جلب الطبيعة إلى الداخل. يضمن الهيكل الخشبي الصلب متانة تدوم لأجيال، بينما يحمي طلاء الزيت الطبيعي الخشب ويبرز أنماط حبيباته الفريدة.</p>
          <p class="mt-4">يتم صنفرة كل حافة يدوياً إلى حد الكمال، مما يخلق تجربة ملموسة لا يمكن للأثاث المنتج بكميات كبيرة أن يضاهيها. بمرور الوقت، سيكتسب الخشب مظهراً غنياً، مما يجعله ملكك حقاً.</p>
        </div>
        <div id="tab-specs" class="tab-content">
          <p><strong>تعليمات العناية:</strong> امسح بقطعة قماش مبللة. تجنب المواد الكيميائية القاسية. ضع شمع الخشب الطبيعي كل 6 أشهر للحفاظ على الطلاء.</p>
          <p class="mt-4"><strong>التجميع:</strong> يصل مجمعاً بالكامل.</p>
        </div>
        <div id="tab-reviews" class="tab-content">
          <p>ستظهر تقييمات العملاء هنا.</p>
        </div>
        <div id="tab-shipping" class="tab-content">
          <p><strong>توصيل مجاني للطلبات فوق 25000 ج.م.</strong> سيقوم فريقنا بتوصيل الأثاث وفك تغليفه ووضعه في الغرفة التي تختارها، وإزالة جميع مواد التغليف.</p>
          <p class="mt-4">يستغرق التوصيل العادي من أسبوعين إلى 4 أسابيع حيث يتم الانتهاء من كل قطعة حسب الطلب.</p>
        </div>
      </div>
      
      ${relatedProducts.length > 0 ? `
        <div class="mt-5 pt-5 reveal">
          <h2 class="h3 mb-4">قد يعجبك أيضاً</h2>
          <div class="product-grid">
            ${relatedProducts.map(p => renderProductCard(p)).join('')}
          </div>
        </div>
      ` : ''}
    </div>
  `;
}

window.setMainImage = function(imgSrc, el) {
  const mainImgContainer = document.querySelector('.main-image');
  if (mainImgContainer) {
    const isImage = imgSrc.startsWith('http') || imgSrc.startsWith('data:image');
    mainImgContainer.innerHTML = isImage 
      ? `<img src="${imgSrc}" alt="product" id="main-product-image">`
      : `<div style="width:100%; height:100%; background-color:${imgSrc};" id="main-product-image"></div>`;
  }
  document.querySelectorAll('.thumbnail').forEach(t => t.classList.remove('active'));
  el.classList.add('active');
}

window.switchTab = function(tabId) {
  document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
  
  event.target.classList.add('active');
  document.getElementById('tab-' + tabId).classList.add('active');
}

window.updateQty = function(inputId, change) {
  const input = document.getElementById(inputId);
  let val = parseInt(input.value) + change;
  if (val < 1) val = 1;
  input.value = val;
}

window.addToCartFromDetail = function(productId) {
  const qty = parseInt(document.getElementById('detail-qty').value);
  for(let i=0; i<qty; i++) {
    window.addToCart(null, productId, i === qty - 1); // Only show drawer on last addition
  }
}

function renderCart() {
  if (state.cart.length === 0) {
    return `
      <div class="container cart-layout" style="display:block;">
        <div class="empty-cart reveal">
          <div class="empty-cart-icon"><i data-lucide="shopping-cart" style="width:48px; height:48px; color:var(--gray-dark);"></i></div>
          <h2 class="h2 mb-3">سلة المشتريات فارغة</h2>
          <p class="mb-4 text-gray-dark">يبدو أنك لم تضف أي قطع مصنوعة يدوياً بعد.</p>
          <button class="btn btn-primary" onclick="navigateTo('/shop')">ابدأ التسوق</button>
        </div>
      </div>
    `;
  }

  const subtotal = state.cart.reduce((sum, item) => sum + ((item.salePrice || item.price) * item.quantity), 0);
  const shipping = subtotal > 25000 ? 0 : 49;
  const discount = state.promoCode === 'WELCOME10' ? subtotal * 0.1 : 0;
  const total = subtotal + shipping - discount;

  return `
    <div class="container cart-layout">
      <div class="cart-items reveal">
        <h2 class="h3 mb-4">سلة المشتريات</h2>
        <div class="cart-header">
          <div>المنتج</div>
          <div>السعر</div>
          <div>الكمية</div>
          <div>المجموع الفرعي</div>
          <div></div>
        </div>
        
        ${state.cart.map(item => {
          const price = item.salePrice || item.price;
          const firstImage = (item.images && item.images.length > 0) ? item.images[0] : (item.image || '#ccc');
          const imageHtml = firstImage.startsWith('http') || firstImage.startsWith('data:image') 
            ? `<img src="${firstImage}" alt="${item.name}">`
            : `<div style="width:100%; height:100%; background-color:${firstImage};"></div>`;
            
          return `
            <div class="cart-item">
              <div class="cart-item-info">
                <div class="cart-item-image" onclick="navigateTo('/product', {id: '${item.id}'})" style="cursor:pointer;">
                  ${imageHtml}
                </div>
                <div>
                  <div class="cart-item-title">${item.name}</div>
                  <div class="text-sm text-gray-dark">${item.category}</div>
                </div>
              </div>
              <div>${price} ج.م</div>
              <div class="quantity-selector" style="width:120px;">
                <button class="qty-btn" onclick="window.updateCartQty('${item.id}', -1)">-</button>
                <input type="text" class="qty-input" value="${item.quantity}" readonly>
                <button class="qty-btn" onclick="window.updateCartQty('${item.id}', 1)">+</button>
              </div>
              <div style="font-weight:700;">${price * item.quantity} ج.م</div>
              <button class="cart-item-remove" onclick="window.removeFromCart('${item.id}')"><i data-lucide="x" style="width:16px; height:16px;"></i></button>
            </div>
          `;
        }).join('')}
      </div>
      
      <div class="order-summary reveal" style="transition-delay: 0.2s">
        <h3>ملخص الطلب</h3>
        <div class="summary-row">
          <span>المجموع الفرعي</span>
          <span>${subtotal.toFixed(2)} ج.م</span>
        </div>
        <div class="summary-row">
          <span>الشحن</span>
          <span>${shipping === 0 ? 'مجاني' : shipping.toFixed(2) + ' ج.م'}</span>
        </div>
        
        ${discount > 0 ? `
          <div class="summary-row" style="color: #2ecc71;">
            <span>الخصم (10%)</span>
            <span>-${discount.toFixed(2)} ج.م</span>
          </div>
        ` : ''}
        
        <div class="promo-code">
          <input type="text" id="promo-input" class="promo-input" placeholder="كود الخصم" value="${state.promoCode ? state.promoCode.code : ''}">
          <button class="promo-btn" onclick="window.applyPromo()">تطبيق</button>
        </div>
        
        <div class="summary-total">
          <span>الإجمالي</span>
          <span>${total.toFixed(2)} ج.م</span>
        </div>
        
        <button class="btn btn-primary checkout-btn" onclick="navigateTo('/checkout')">إتمام الطلب</button>
      </div>
    </div>
  `;
}

window.updateCartQty = function(id, change) {
  const item = state.cart.find(i => i.id === id);
  if (item) {
    item.quantity += change;
    if (item.quantity <= 0) {
      window.removeFromCart(id);
    } else {
      saveState();
      navigateTo('/cart');
    }
  }
}

window.removeFromCart = function(id) {
  state.cart = state.cart.filter(i => i.id !== id);
  saveState();
  window.showToast('تمت إزالة العنصر من السلة');
  navigateTo('/cart');
}

window.applyPromo = async function() {
  const code = document.getElementById('promo-input').value.trim().toUpperCase();
  if (!code) return;

  try {
    const { collection, query, where, getDocs } = await import('firebase/firestore');
    const q = query(collection(db, 'coupons'), where('code', '==', code));
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      window.showToast('كود الخصم غير صحيح أو منتهي الصلاحية');
      return;
    }

    const couponDoc = snapshot.docs[0];
    const couponData = couponDoc.data();

    if (couponData.used) {
      window.showToast('عذراً، تم استخدام هذا الكود من قبل');
      return;
    }

    state.promoCode = { code: couponData.code, id: couponDoc.id, discount: couponData.discount || 0.1 };
    saveState();
    window.showToast('تم تطبيق كود الخصم بنجاح!');
    navigateTo('/cart');
  } catch (error) {
    console.error("Error applying promo:", error);
    window.showToast('حدث خطأ أثناء التحقق من الكود');
  }
}

function renderAbout() {
  return `
    <div class="container" style="padding: 60px 20px;">
      <div class="text-center mb-5 reveal">
        <h1 class="h1 mb-3">قصتنا</h1>
        <p class="text-lg text-gray-dark" style="max-width: 600px; margin: 0 auto;">
          في المدينة المنورة، نؤمن بأن الأثاث ليس مجرد قطع خشبية، بل هو جزء من روح المنزل.
        </p>
      </div>

      <div class="about-grid" style="display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-bottom: 60px; align-items: center;">
        <div class="reveal">
          <img src="https://images.unsplash.com/photo-1581428982868-e410dd047a90?auto=format&fit=crop&w=800&q=80" alt="ورشتنا" style="width: 100%; border-radius: 16px; box-shadow: var(--shadow-md);">
        </div>
        <div class="reveal" style="transition-delay: 0.2s;">
          <h2 class="h2 mb-3">بدايتنا</h2>
          <p     style="line-height: 1.8; margin-bottom: 15px;">
            تأسس معرض المدينة المنورة للأثاث على يد مجموعة من الحرفيين الشغوفين بصناعة الأثاث الخشبي الصلب. بدأنا في ورشة صغيرة، واليوم نفخر بتقديم قطع أثاث فريدة تزين آلاف المنازل.
          </p>
          <p style="line-height: 1.8;">
            نحن نستخدم أفضل أنواع الخشب الطبيعي، ونحرص على أدق التفاصيل في كل قطعة نصنعها، لضمان جودة تدوم لأجيال.
          </p>
        </div>
      </div>

      <div class="text-center mb-5 reveal">
        <h2 class="h2 mb-4">المؤسسون</h2>
        <div style="display: flex; justify-content: center; gap: 30px; flex-wrap: wrap;">
          <div style="text-align: center; max-width: 250px;">
            <img src="https://drive.google.com/thumbnail?id=1x81kXfA6wrKFcb31Ilj9boOb8w8UcQjs&sz=w500" alt="مؤسس 1" style="width: 150px; height: 150px; border-radius: 50%; object-fit: cover; margin-bottom: 15px; box-shadow: var(--shadow-sm);">
            <h3 class="h4">الشيخ حسني  </h3>
            <p class="text-gray-dark mb-2">المدير التنفيذي ومصمم رئيسي</p>
          </div>
           <div style="text-align: center; max-width: 250px;">
            <img src="https://drive.google.com/thumbnail?id=1Obd6xJ1yDMIHIHIyi33IHVC14ToW6Ye2&sz=w500" alt="محمد حسني" style="width: 150px; height: 150px; border-radius: 50%; object-fit: cover; margin-bottom: 15px; box-shadow: var(--shadow-sm);">
            <h3 class="h4">محمد حسني</h3>
            <p class="text-gray-dark mb-2">مدير تنفيذي </p>
          </div>
          <div style="text-align: center; max-width: 250px;">
            <img src="https://drive.google.com/thumbnail?id=1ifE12GIhP8qb2uCmeriqE8ChfwVKGR-B&sz=w500" alt="احمد حسني" style="width: 150px; height: 150px; border-radius: 50%; object-fit: cover; margin-bottom: 15px; box-shadow: var(--shadow-sm);">
            <h3 class="h4">احمد حسني </h3>
            <p class="text-gray-dark mb-2">مدير تنفيذي </p>
          </div>
          <div style="text-align: center; max-width: 250px;">
            <img src="https://drive.google.com/thumbnail?id=1GCFcCmP5FfHlg9YIEVPT-_VUgQi5nwM0&sz=w500" alt="محمود حسني" style="width: 150px; height: 150px; border-radius: 50%; object-fit: cover; margin-bottom: 15px; box-shadow: var(--shadow-sm);">
            <h3 class="h4">محمود حسني </h3>
            <p class="text-gray-dark mb-2">مدير تنفيذي </p>
          </div>

        </div>
      </div>

      <div class="reveal" style="background-color: var(--gray-light); padding: 40px; border-radius: 16px; text-align: center;">
        <h2 class="h2 mb-4">فروعنا</h2>
        <p class="mb-4">تفضل بزيارتنا في فروعنا لرؤية جودة منتجاتنا عن قرب.</p>
        <div style="display: flex; gap: 20px; justify-content: center; flex-wrap: wrap;">
          <a href="https://maps.app.goo.gl/mrqew284aCFR9gNF7" target="_blank" class="btn btn-primary" style="display:flex; align-items:center; gap:8px;">
            <i data-lucide="map-pin" style="width:18px; height:18px;"></i> الفرع الأول على خرائط جوجل
          </a>
          <a href="https://maps.app.goo.gl/hrKEBDUmAGv3Sqx59" target="_blank" class="btn btn-outline" style="display:flex; align-items:center; gap:8px;">
            <i data-lucide="map-pin" style="width:18px; height:18px;"></i> الفرع الثاني على خرائط جوجل
          </a>
        </div>
      </div>
    </div>
  `;
}

function renderContact() {
  return `
    <div class="container" style="padding: 100px 20px; max-width: 800px; margin: 0 auto;">
      <h1 class="h1 mb-4 text-center">اتصل بنا</h1>
      <p class="text-center text-gray-dark mb-5">نحن هنا لمساعدتك. تواصل معنا عبر أي من الطرق التالية:</p>
      
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 30px; margin-bottom: 50px;">
        <div style="background: var(--gray-light); padding: 30px; border-radius: 12px; text-align: center;">
          <i data-lucide="phone" style="width: 40px; height: 40px; color: var(--accent-gold); margin-bottom: 15px;"></i>
          <h3 class="h3 mb-3">أرقام التواصل</h3>
          <p class="mb-2"><a href="tel:+201013600821" dir="ltr" style="color: var(--text-color); text-decoration: none; font-family: monospace; font-size: 1.1rem;">+20 101 360 0821</a></p>
          <p class="mb-2"><a href="tel:+201124440656" dir="ltr" style="color: var(--text-color); text-decoration: none; font-family: monospace; font-size: 1.1rem;">+20 112 444 0656</a></p>
          <p class="mb-2"><a href="tel:+201007504842" dir="ltr" style="color: var(--text-color); text-decoration: none; font-family: monospace; font-size: 1.1rem;">+20 100 750 4842</a></p>
          <p class="mb-2"><a href="tel:+201002437624" dir="ltr" style="color: var(--text-color); text-decoration: none; font-family: monospace; font-size: 1.1rem;">+20 100 243 7624</a></p>
          <p><a href="tel:+201063199352" dir="ltr" style="color: var(--text-color); text-decoration: none; font-family: monospace; font-size: 1.1rem;">+20 106 319 9352</a></p>
        </div>
        
        <div style="background: var(--gray-light); padding: 30px; border-radius: 12px; text-align: center;">
          <i data-lucide="message-circle" style="width: 40px; height: 40px; color: var(--accent-gold); margin-bottom: 15px;"></i>
          <h3 class="h3 mb-3">واتساب</h3>
          <p class="mb-3 text-gray-dark">تواصل معنا مباشرة عبر واتساب للرد السريع على استفساراتك.</p>
          <a href="https://wa.me/201013600821" target="_blank" class="btn btn-primary" style="display: inline-flex; align-items: center; gap: 8px;">
            <i data-lucide="message-circle" style="width: 18px; height: 18px;"></i>
            مراسلة عبر واتساب
          </a>
        </div>
      </div>
      
      <div style="background: var(--gray-light); padding: 40px; border-radius: 12px; text-align: center;">
        <i data-lucide="map-pin" style="width: 40px; height: 40px; color: var(--accent-gold); margin-bottom: 15px;"></i>
        <h3 class="h3 mb-3">فروعنا</h3>
        <p class="mb-4 text-gray-dark">تفضل بزيارة معارضنا لرؤية جودة منتجاتنا على الطبيعة.</p>
        <div style="display: flex; gap: 15px; justify-content: center; flex-wrap: wrap;">
          <a href="https://maps.app.goo.gl/mrqew284aCFR9gNF7" target="_blank" class="btn btn-outline-dark" style="display: inline-flex; align-items: center; gap: 8px;">
            <i data-lucide="map" style="width: 18px; height: 18px;"></i>
            الفرع الأول
          </a>
          <a href="https://maps.app.goo.gl/hrKEBDUmAGv3Sqx59" target="_blank" class="btn btn-outline-dark" style="display: inline-flex; align-items: center; gap: 8px;">
            <i data-lucide="map" style="width: 18px; height: 18px;"></i>
            الفرع الثاني
          </a>
        </div>
      </div>
    </div>
  `;
}

function renderCheckout() {
  if (state.cart.length === 0) {
    navigateTo('/cart');
    return '';
  }

  const subtotal = state.cart.reduce((sum, item) => sum + ((item.salePrice || item.price) * item.quantity), 0);
  const shipping = subtotal > 25000 ? 0 : 49;
  const discount = state.promoCode === 'WELCOME10' ? subtotal * 0.1 : 0;
  const total = subtotal + shipping - discount;

  return `
    <div class="container checkout-layout">
      <div class="checkout-form-container reveal">
        <h2 class="h3 mb-4">تفاصيل الطلب والدفع</h2>
        
        <h3 class="h4 mt-4 mb-3">طريقة الدفع</h3>
        <div class="form-group">
          <label class="form-label" style="display:flex; align-items:center; gap:10px; margin-bottom:10px; cursor:pointer;">
            <input type="radio" name="paymentMethod" value="vodafone" checked onchange="window.togglePaymentDetails()" style="width:20px; height:20px;"> فودافون كاش
          </label>
          <label class="form-label" style="display:flex; align-items:center; gap:10px; cursor:pointer;">
            <input type="radio" name="paymentMethod" value="cod" onchange="window.togglePaymentDetails()" style="width:20px; height:20px;"> الدفع عند الاستلام
          </label>
        </div>

        <div id="vodafone-details" style="display:block;">
          <div class="payment-instructions" style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px; border: 1px solid #e2e8f0;">
            <h4 style="color: #e60000; margin-bottom: 10px; display: flex; align-items: center; gap: 10px;">
              <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z"></path><path d="M9 12l2 2 4-4"></path></svg>
              الدفع عبر فودافون كاش
            </h4>
            <p style="margin-bottom: 10px;">برجاء تحويل إجمالي المبلغ <strong>${total.toFixed(2)} ج.م</strong> إلى الرقم التالي:</p>
            <p style="font-size: 1.5rem; font-weight: bold; letter-spacing: 2px; text-align: center; background: #fff; padding: 10px; border-radius: 4px; border: 2px dashed #e60000;">01013600821</p>
            <p style="margin-top: 10px; font-size: 0.9rem; color: #666;">بعد التحويل، يرجى إدخال رقم الموبايل الذي قمت بالتحويل منه في النموذج بالأسفل لتأكيد طلبك.</p>
            <p style="color: #e60000; font-weight: bold; margin-top: 10px; font-size: 0.95rem;">* هام جداً: يرجى التقاط "سكرين شوت" (صورة للشاشة) لعملية التحويل وإرسالها لنا على الواتساب لتأكيد طلبك.</p>
          </div>
        </div>

        <form id="checkout-form" onsubmit="event.preventDefault(); window.submitOrder();">
          <div class="form-group">
            <label class="form-label">الاسم الكامل</label>
            <input type="text" id="checkout-name" class="form-control" required>
          </div>
          <div class="form-group">
            <label class="form-label">رقم الهاتف (للتواصل)</label>
            <input type="tel" id="checkout-phone" class="form-control" required>
          </div>
          <div class="form-group">
            <label class="form-label">العنوان بالتفصيل</label>
            <textarea id="checkout-address" class="form-control" rows="3" required></textarea>
          </div>
          
          <div class="form-group" id="vf-number-group">
            <label class="form-label" style="color: #e60000; font-weight: bold;">رقم فودافون كاش المحول منه</label>
            <input type="tel" id="checkout-vf-number" class="form-control" placeholder="010xxxxxxxx" required>
          </div>
          
          <button type="submit" class="btn btn-primary mt-4" style="width:100%;">تأكيد الطلب (${total.toFixed(2)} ج.م)</button>
        </form>
      </div>
      
      <div class="reveal" style="transition-delay: 0.2s">
        <div class="order-summary mb-4">
          <h3>ملخص الطلب</h3>
          ${state.cart.map(item => `
            <div class="summary-row" style="font-size: 0.9rem;">
              <span>${item.name} (x${item.quantity})</span>
              <span>${((item.salePrice || item.price) * item.quantity).toFixed(2)} ج.م</span>
            </div>
          `).join('')}
          <hr style="margin: 15px 0; border: none; border-top: 1px solid var(--gray-light);">
          <div class="summary-row">
            <span>الإجمالي</span>
            <span style="font-weight: 700; color: var(--accent-gold);">${total.toFixed(2)} ج.م</span>
          </div>
        </div>
        
        <div class="map-container">
          <h3 class="h4 mb-3">فروعنا</h3>
          <div style="display: flex; flex-direction: column; gap: 10px;">
            <a href="https://maps.app.goo.gl/mrqew284aCFR9gNF7" target="_blank" class="btn btn-outline" style="width: 100%; display:flex; align-items:center; justify-content:center; gap:8px;">
              <i data-lucide="map-pin" style="width:18px; height:18px;"></i> الفرع الأول على خرائط جوجل
            </a>
            <a href="https://maps.app.goo.gl/hrKEBDUmAGv3Sqx59" target="_blank" class="btn btn-outline" style="width: 100%; display:flex; align-items:center; justify-content:center; gap:8px;">
              <i data-lucide="map-pin" style="width:18px; height:18px;"></i> الفرع الثاني على خرائط جوجل
            </a>
          </div>
        </div>
      </div>
    </div>
  `;
}

window.togglePaymentDetails = function() {
  const method = document.querySelector('input[name="paymentMethod"]:checked').value;
  const vfDetails = document.getElementById('vodafone-details');
  const vfInputGroup = document.getElementById('vf-number-group');
  const vfInput = document.getElementById('checkout-vf-number');
  
  if (method === 'vodafone') {
    vfDetails.style.display = 'block';
    vfInputGroup.style.display = 'block';
    vfInput.required = true;
  } else {
    vfDetails.style.display = 'none';
    vfInputGroup.style.display = 'none';
    vfInput.required = false;
    vfInput.value = '';
  }
}

window.subscribeNewsletter = async function(event) {
  event.preventDefault();
  const input = event.target.querySelector('input[type="email"]');
  const email = input.value.trim();
  
  if (!email) return;
  
  try {
    const { collection, addDoc, query, where, getDocs } = await import('firebase/firestore');
    
    // Check if email already used
    const q = query(collection(db, 'coupons'), where('email', '==', email));
    const snapshot = await getDocs(q);
    
    if (!snapshot.empty) {
      window.showToast('عذراً، هذا البريد الإلكتروني مسجل بالفعل وقد حصل على كود خصم.', 4000);
      return;
    }

    const uniqueCode = 'WEL-' + Math.random().toString(36).substring(2, 8).toUpperCase();

    await addDoc(collection(db, 'subscribers'), {
      email: email,
      createdAt: new Date()
    });

    await addDoc(collection(db, 'coupons'), {
      code: uniqueCode,
      email: email,
      used: false,
      discount: 0.1,
      createdAt: new Date()
    });

    window.showToast(`شكراً لاشتراكك! كود الخصم الخاص بك هو: ${uniqueCode}`, 6000);
    input.value = '';
  } catch (error) {
    console.error("Error subscribing:", error);
    window.showToast('حدث خطأ أثناء الاشتراك. يرجى المحاولة لاحقاً.');
  }
};

window.submitOrder = async function() {
  const name = document.getElementById('checkout-name').value;
  const phone = document.getElementById('checkout-phone').value;
  const address = document.getElementById('checkout-address').value;
  const paymentMethod = document.querySelector('input[name="paymentMethod"]:checked').value;
  const vfNumber = document.getElementById('checkout-vf-number').value;
  
  const paymentText = paymentMethod === 'vodafone' ? 'فودافون كاش' : 'الدفع عند الاستلام';

  const subtotal = state.cart.reduce((sum, item) => sum + ((item.salePrice || item.price) * item.quantity), 0);
  const shipping = subtotal > 25000 ? 0 : 49;
  const discount = state.promoCode === 'WELCOME10' ? subtotal * 0.1 : 0;
  const total = subtotal + shipping - discount;

  const order = {
    customer: { 
      name, 
      phone, 
      address, 
      vfNumber: paymentMethod === 'vodafone' ? vfNumber : null 
    },
    items: state.cart,
    subtotal,
    shipping,
    discount,
    promoCode: state.promoCode ? state.promoCode.code : null,
    total,
    status: 'pending',
    paymentMethod: paymentText,
    createdAt: new Date().toISOString()
  };

  try {
    const { addDoc, collection, doc, updateDoc } = await import('firebase/firestore');
    await addDoc(collection(db, 'orders'), order);
    
    if (state.promoCode && state.promoCode.id) {
      try {
        await updateDoc(doc(db, 'coupons', state.promoCode.id), { used: true });
      } catch (e) {
        console.error("Error updating coupon status", e);
      }
    }

    // Construct WhatsApp Message
    let message = `*طلب جديد من المدينة المنورة*\n\n`;
    message += `*الاسم:* ${name}\n`;
    message += `*رقم الهاتف:* ${phone}\n`;
    message += `*العنوان:* ${address}\n`;
    message += `*طريقة الدفع:* ${paymentText}\n`;
    
    if (paymentMethod === 'vodafone') {
      message += `*رقم التحويل:* ${vfNumber}\n\n`;
      message += `*(ملاحظة: سأقوم بإرسال سكرين شوت التحويل الآن لتأكيد الطلب)*\n\n`;
    } else {
      message += `\n`;
    }
    
    message += `*المنتجات:*\n`;
    state.cart.forEach(item => {
      message += `- ${item.name} (الكمية: ${item.quantity}) = ${((item.salePrice || item.price) * item.quantity).toFixed(2)} ج.م\n`;
    });
    
    message += `\n*الإجمالي:* ${total.toFixed(2)} ج.م`;

    // Clear cart
    state.cart = [];
    state.promoCode = null;
    saveState();
    
    window.showToast('تم استلام طلبك بنجاح! جاري تحويلك لواتساب...');
    
    const waUrl = `https://wa.me/201013600821?text=${encodeURIComponent(message)}`;
    
    // Create a temporary link and click it to open in a new tab safely
    const link = document.createElement('a');
    link.href = waUrl;
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    navigateTo('/');
    
  } catch (error) {
    console.error("Error submitting order:", error);
    window.showToast('حدث خطأ أثناء إرسال الطلب، يرجى المحاولة مرة أخرى.');
  }
}

function renderAdmin() {
  if (!state.isAdminAuth) {
    return `
      <div class="container" style="padding: 150px 20px; max-width: 450px;">
        <div class="text-center mb-4">
          <h2 class="h2">تسجيل دخول الإدارة</h2>
          <p class="text-gray-dark mt-2">يرجى تسجيل الدخول بحساب الإدارة المعتمد</p>
        </div>
        <button onclick="window.adminLogin()" class="btn btn-primary" style="width:100%; display: flex; align-items: center; justify-content: center; gap: 10px;">
          <svg viewBox="0 0 24 24" width="24" height="24" xmlns="http://www.w3.org/2000/svg"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/><path d="M1 1h22v22H1z" fill="none"/></svg>
          تسجيل الدخول باستخدام Google
        </button>
      </div>
    `;
  }

  return `
    <div class="container admin-layout">
      <div class="admin-header reveal">
        <h2 class="h2">لوحة الإدارة</h2>
        <div>
          <button class="btn btn-outline-dark" style="margin-right:10px;" onclick="window.adminLogout()">تسجيل الخروج</button>
        </div>
      </div>
      
      <div class="admin-tabs reveal" style="display: flex; gap: 10px; margin-bottom: 20px;">
        <button class="btn btn-primary" id="tab-products" onclick="window.switchAdminTab('products')">إدارة المنتجات</button>
        <button class="btn btn-outline-dark" id="tab-orders" onclick="window.switchAdminTab('orders')">الطلبات الواردة</button>
        <button class="btn btn-outline-dark" id="tab-subscribers" onclick="window.switchAdminTab('subscribers')">المشتركين</button>
      </div>
      
      <div id="admin-products-view" class="reveal" style="overflow-x:auto;">
        <div style="display: flex; justify-content: flex-end; margin-bottom: 15px;">
          <button class="btn btn-primary" onclick="window.openProductModal()">+ إضافة منتج</button>
        </div>
        <table class="admin-table">
          <thead>
            <tr>
              <th>الصورة</th>
              <th>الاسم</th>
              <th>الفئة</th>
              <th>السعر</th>
              <th>الإجراءات</th>
            </tr>
          </thead>
          <tbody>
            ${(state.products || []).map(p => {
              let firstImage = '#ccc';
              if (p.images && Array.isArray(p.images) && p.images.length > 0 && p.images[0]) {
                firstImage = p.images[0];
              } else if (p.image) {
                firstImage = p.image;
              }
              
              const isUrl = typeof firstImage === 'string' && (firstImage.startsWith('http') || firstImage.startsWith('data:image'));
              const imageHtml = isUrl 
                ? `<img src="${firstImage}" style="width:60px; height:60px; object-fit:cover; border-radius:8px;">`
                : `<div style="width:60px; height:60px; background-color:${firstImage}; border-radius:8px;"></div>`;
                
              return `
                <tr>
                  <td>${imageHtml}</td>
                  <td style="font-weight:700;">${p.name || 'بدون اسم'}</td>
                  <td>${p.category || 'غير محدد'}</td>
                  <td style="font-weight:700; color:var(--accent-gold);">${p.price || 0} ج.م</td>
                  <td>
                    <div class="admin-actions">
                      <button class="btn-edit" onclick="window.openProductModal('${p.id}')">تعديل</button>
                      <button class="btn-delete" onclick="window.deleteProduct('${p.id}')">حذف</button>
                    </div>
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>

      <div id="admin-orders-view" class="reveal" style="display: none; overflow-x:auto;">
        <table class="admin-table">
          <thead>
            <tr>
              <th>التاريخ</th>
              <th>العميل</th>
              <th>الهاتف</th>
              <th>طريقة الدفع</th>
              <th>الإجمالي</th>
              <th>الحالة</th>
              <th>الإجراءات</th>
            </tr>
          </thead>
          <tbody id="orders-table-body">
            <tr><td colspan="7" style="text-align:center;">جاري تحميل الطلبات...</td></tr>
          </tbody>
        </table>
      </div>
    </div>
    
    <!-- Order Details Modal -->
    <div class="modal-overlay" id="order-modal">
      <div class="modal-content" style="max-width: 600px;">
        <div class="modal-header">
          <h3 class="h3">تفاصيل الطلب</h3>
          <button class="close-modal" onclick="document.getElementById('order-modal').classList.remove('active')"><i data-lucide="x" style="width:16px; height:16px;"></i></button>
        </div>
        <div id="order-details-content" style="margin-top: 20px;">
          <!-- Order details will be injected here -->
        </div>
      </div>
    </div>

      <div id="admin-subscribers-view" class="reveal" style="display: none; overflow-x:auto;">
        <table class="admin-table">
          <thead>
            <tr>
              <th>البريد الإلكتروني</th>
              <th>تاريخ الاشتراك</th>
            </tr>
          </thead>
          <tbody>
            ${state.subscribers && state.subscribers.length > 0 ? state.subscribers.map(sub => `
              <tr>
                <td style="direction: ltr; text-align: right;">${sub.email || ''}</td>
                <td>${sub.createdAt ? new Date(sub.createdAt.seconds ? sub.createdAt.toDate() : sub.createdAt).toLocaleDateString('ar-EG') : 'حديث'}</td>
              </tr>
            `).join('') : '<tr><td colspan="2" class="text-center">لا يوجد مشتركين حتى الآن</td></tr>'}
          </tbody>
        </table>
      </div>

    <!-- Product Modal -->
    <div class="modal-overlay" id="product-modal">
      <div class="modal-content">
        <div class="modal-header">
          <h3 class="h3" id="modal-title">إضافة منتج</h3>
          <button class="close-modal" onclick="window.closeProductModal()"><i data-lucide="x" style="width:16px; height:16px;"></i></button>
        </div>
        <form id="product-form" onsubmit="event.preventDefault(); window.saveProduct();">
          <input type="hidden" id="prod-id">
          
          <div class="form-group">
            <label class="form-label">اسم المنتج</label>
            <input type="text" id="prod-name" class="form-control" required>
          </div>
          
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:20px;">
            <div class="form-group">
              <label class="form-label">السعر (ج.م)</label>
              <input type="number" id="prod-price" class="form-control" required>
            </div>
            <div class="form-group">
              <label class="form-label">سعر التخفيض (ج.م) - اختياري</label>
              <input type="number" id="prod-sale" class="form-control">
            </div>
          </div>
          
          <div class="form-group">
            <label class="form-label">الفئة</label>
            <select id="prod-category" class="form-control" required>
              <option value="غرفة المعيشة">غرفة المعيشة</option>
              <option value="غرفة النوم">غرفة النوم</option>
              <option value="غرفة الطعام">غرفة الطعام</option>
              <option value="غرفة أطفال">غرفة أطفال</option>
              <option value="المكتب">المكتب</option>
            </select>
          </div>
          
          <div class="form-group">
            <label class="form-label">الوصف</label>
            <textarea id="prod-desc" class="form-control" rows="3" required></textarea>
          </div>
          
          <div class="form-group">
            <label class="form-label">رابط فيديو (يوتيوب أو رابط مباشر) - اختياري</label>
            <input type="url" id="prod-video" class="form-control" placeholder="https://www.youtube.com/watch?v=...">
          </div>
          
          <div class="form-group">
            <label class="form-label">الصور (رفع صور، أو روابط URL مفصولة بفاصلة، أو لون Hex)</label>
            <input type="file" id="prod-image-file" class="form-control mb-2" accept="image/*" multiple onchange="window.handleImageUpload(event)">
            <input type="text" id="prod-image-color" class="form-control" placeholder="رابط صورة أو لون (مثال: #8C7A6B)" onchange="window.handleImageUrlChange(event)">
            <input type="hidden" id="prod-image-data">
            <div id="image-preview" style="margin-top:15px; display:flex; gap:10px; flex-wrap:wrap; min-height:120px; border-radius:8px; background-color:var(--gray-light); padding:10px;"></div>
          </div>
          
          <div class="form-group">
            <label class="form-label" style="display:flex; align-items:center; gap:10px;">
              <input type="checkbox" id="prod-new" style="width:20px; height:20px;"> تعيين كمنتج جديد
            </label>
          </div>
          
          <button type="submit" class="btn btn-primary" style="width:100%;">حفظ المنتج</button>
        </form>
      </div>
    </div>

    <!-- Delete Confirm Modal -->
    <div class="modal-overlay" id="delete-confirm-modal">
      <div class="modal-content" style="max-width: 400px; text-align: center;">
        <h3 class="h3 mb-3">تأكيد الحذف</h3>
        <p class="mb-4" id="delete-confirm-text">هل أنت متأكد أنك تريد الحذف؟ لا يمكن التراجع عن هذا الإجراء.</p>
        <div style="display: flex; gap: 10px; justify-content: center;">
          <button class="btn btn-outline-dark" onclick="window.closeDeleteConfirmModal()">إلغاء</button>
          <button class="btn btn-primary" style="background-color: #dc3545; border-color: #dc3545;" id="confirm-delete-btn">حذف</button>
        </div>
      </div>
    </div>
  `;
}

window.adminLogin = async function() {
  try {
    const result = await signInWithPopup(auth, provider);
    if (result.user.email === 'bodamomo2010@gmail.com') {
      window.showToast('تم تسجيل الدخول بنجاح كمسؤول');
      navigateTo('/admin');
    } else {
      window.showToast('عذراً، هذا الحساب ليس لديه صلاحيات الإدارة');
      await signOut(auth);
    }
  } catch (error) {
    console.error(error);
    window.showToast('فشل تسجيل الدخول');
  }
}

window.adminLogout = async function() {
  try {
    await signOut(auth);
    navigateTo('/');
    window.showToast('تم تسجيل الخروج');
  } catch (error) {
    console.error(error);
  }
}

window.switchAdminTab = function(tab) {
  const productsView = document.getElementById('admin-products-view');
  const ordersView = document.getElementById('admin-orders-view');
  const subscribersView = document.getElementById('admin-subscribers-view');
  const tabProducts = document.getElementById('tab-products');
  const tabOrders = document.getElementById('tab-orders');
  const tabSubscribers = document.getElementById('tab-subscribers');

  // Reset all
  productsView.style.display = 'none';
  ordersView.style.display = 'none';
  if (subscribersView) subscribersView.style.display = 'none';
  
  tabProducts.className = 'btn btn-outline-dark';
  tabOrders.className = 'btn btn-outline-dark';
  if (tabSubscribers) tabSubscribers.className = 'btn btn-outline-dark';

  if (tab === 'products') {
    productsView.style.display = 'block';
    tabProducts.className = 'btn btn-primary';
    // Force re-render of products table to ensure it shows up correctly
    const appDiv = document.getElementById('app');
    if (appDiv) {
      appDiv.innerHTML = renderAdmin();
      attachEventListeners();
      if (window.lucide) window.lucide.createIcons();
      // Ensure the correct tab is active after re-render
      document.getElementById('admin-products-view').style.display = 'block';
      document.getElementById('admin-orders-view').style.display = 'none';
      if (document.getElementById('admin-subscribers-view')) document.getElementById('admin-subscribers-view').style.display = 'none';
      document.getElementById('tab-products').className = 'btn btn-primary';
      document.getElementById('tab-orders').className = 'btn btn-outline-dark';
      if (document.getElementById('tab-subscribers')) document.getElementById('tab-subscribers').className = 'btn btn-outline-dark';
    }
  } else if (tab === 'orders') {
    ordersView.style.display = 'block';
    tabOrders.className = 'btn btn-primary';
    loadOrders();
  } else if (tab === 'subscribers') {
    if (subscribersView) subscribersView.style.display = 'block';
    if (tabSubscribers) tabSubscribers.className = 'btn btn-primary';
  }
}

let adminOrders = [];

async function loadOrders() {
  const tbody = document.getElementById('orders-table-body');
  try {
    const { collection, getDocs, query, orderBy } = await import('firebase/firestore');
    const q = query(collection(db, 'orders'), orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(q);
    
    adminOrders = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    
    if (adminOrders.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;">لا توجد طلبات حتى الآن</td></tr>';
      return;
    }

    tbody.innerHTML = adminOrders.map(order => {
      const date = new Date(order.createdAt).toLocaleDateString('ar-EG', { year: 'numeric', month: 'short', day: 'numeric' });
      const statusColor = order.status === 'pending' ? 'orange' : (order.status === 'delivered' ? 'green' : 'gray');
      const statusText = order.status === 'pending' ? 'قيد الانتظار' : (order.status === 'delivered' ? 'مكتمل' : order.status);
      
      return `
        <tr>
          <td>${date}</td>
          <td style="font-weight:700;">${order.customer.name}</td>
          <td dir="ltr" style="text-align:right;">${order.customer.phone}</td>
          <td>${order.paymentMethod}</td>
          <td style="font-weight:700; color:var(--accent-gold);">${order.total} ج.م</td>
          <td style="color:${statusColor}; font-weight:bold;">${statusText}</td>
          <td>
            <button class="btn-outline-dark" style="padding: 5px 10px; font-size: 0.8rem;" onclick="window.viewOrderDetails('${order.id}')">التفاصيل</button>
            <button class="btn-delete" style="padding: 5px 10px; font-size: 0.8rem; margin-right: 5px;" onclick="window.deleteOrder('${order.id}')">حذف</button>
          </td>
        </tr>
      `;
    }).join('');
  } catch (error) {
    console.error("Error loading orders:", error);
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; color:red;">حدث خطأ أثناء تحميل الطلبات</td></tr>';
  }
}

window.viewOrderDetails = function(orderId) {
  const order = adminOrders.find(o => o.id === orderId);
  if (!order) return;

  const content = document.getElementById('order-details-content');
  const date = new Date(order.createdAt).toLocaleString('ar-EG');
  
  let html = `
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 20px;">
      <div style="background: #f8f9fa; padding: 15px; border-radius: 8px;">
        <h4 style="margin-bottom: 10px; color: var(--primary);">بيانات العميل</h4>
        <p><strong>الاسم:</strong> ${order.customer.name}</p>
        <p><strong>الهاتف:</strong> <a href="tel:${order.customer.phone}" dir="ltr">${order.customer.phone}</a></p>
        <p><strong>العنوان:</strong> ${order.customer.address}</p>
      </div>
      <div style="background: #f8f9fa; padding: 15px; border-radius: 8px;">
        <h4 style="margin-bottom: 10px; color: var(--primary);">تفاصيل الدفع</h4>
        <p><strong>الطريقة:</strong> ${order.paymentMethod}</p>
        ${order.customer.vfNumber ? `<p><strong>رقم التحويل:</strong> <span dir="ltr">${order.customer.vfNumber}</span></p>` : ''}
        <p><strong>التاريخ:</strong> <span dir="ltr">${date}</span></p>
        <p><strong>الحالة:</strong> 
          <select onchange="window.updateOrderStatus('${order.id}', this.value)" style="padding: 5px; border-radius: 4px; border: 1px solid #ccc;">
            <option value="pending" ${order.status === 'pending' ? 'selected' : ''}>قيد الانتظار</option>
            <option value="processing" ${order.status === 'processing' ? 'selected' : ''}>جاري التجهيز</option>
            <option value="shipped" ${order.status === 'shipped' ? 'selected' : ''}>تم الشحن</option>
            <option value="delivered" ${order.status === 'delivered' ? 'selected' : ''}>مكتمل (تم التوصيل)</option>
            <option value="cancelled" ${order.status === 'cancelled' ? 'selected' : ''}>ملغي</option>
          </select>
        </p>
      </div>
    </div>
    
    <h4 style="margin-bottom: 15px; border-bottom: 2px solid var(--accent-gold); padding-bottom: 5px; display: inline-block;">المنتجات المطلوبة</h4>
    <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
      <thead>
        <tr style="background: #f1f1f1; text-align: right;">
          <th style="padding: 10px; border: 1px solid #ddd;">المنتج</th>
          <th style="padding: 10px; border: 1px solid #ddd;">السعر</th>
          <th style="padding: 10px; border: 1px solid #ddd;">الكمية</th>
          <th style="padding: 10px; border: 1px solid #ddd;">المجموع</th>
        </tr>
      </thead>
      <tbody>
        ${order.items.map(item => `
          <tr>
            <td style="padding: 10px; border: 1px solid #ddd;">${item.name}</td>
            <td style="padding: 10px; border: 1px solid #ddd;">${item.salePrice || item.price} ج.م</td>
            <td style="padding: 10px; border: 1px solid #ddd;">${item.quantity}</td>
            <td style="padding: 10px; border: 1px solid #ddd;">${((item.salePrice || item.price) * item.quantity).toFixed(2)} ج.م</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
    
    <div style="text-align: left; background: #f8f9fa; padding: 15px; border-radius: 8px; width: fit-content; margin-right: auto;">
      <p><strong>المجموع الفرعي:</strong> ${order.subtotal.toFixed(2)} ج.م</p>
      <p><strong>الشحن:</strong> ${order.shipping === 0 ? 'مجاني' : order.shipping + ' ج.م'}</p>
      ${order.discount > 0 ? `<p style="color: green;"><strong>الخصم ${order.promoCode ? `(${order.promoCode})` : ''}:</strong> -${order.discount.toFixed(2)} ج.م</p>` : ''}
      <h3 style="margin-top: 10px; color: var(--accent-gold);">الإجمالي: ${order.total.toFixed(2)} ج.م</h3>
    </div>
  `;
  
  content.innerHTML = html;
  document.getElementById('order-modal').classList.add('active');
}

window.updateOrderStatus = async function(orderId, newStatus) {
  try {
    const { doc, updateDoc } = await import('firebase/firestore');
    const orderRef = doc(db, 'orders', orderId);
    await updateDoc(orderRef, { status: newStatus });
    
    // Update local state
    const orderIndex = adminOrders.findIndex(o => o.id === orderId);
    if (orderIndex > -1) {
      adminOrders[orderIndex].status = newStatus;
    }
    
    window.showToast('تم تحديث حالة الطلب بنجاح');
    loadOrders(); // Refresh table
  } catch (error) {
    console.error("Error updating order status:", error);
    window.showToast('حدث خطأ أثناء تحديث الحالة');
  }
}

window.openProductModal = function(id = null) {
  const modal = document.getElementById('product-modal');
  const title = document.getElementById('modal-title');
  const form = document.getElementById('product-form');
  
  form.reset();
  document.getElementById('image-preview').innerHTML = '';
  document.getElementById('prod-image-data').value = '';
  
  if (id) {
    const p = state.products.find(x => x.id === id);
    if (p) {
      title.innerText = 'تعديل المنتج';
      document.getElementById('prod-id').value = p.id;
      document.getElementById('prod-name').value = p.name;
      document.getElementById('prod-price').value = p.price;
      document.getElementById('prod-sale').value = p.salePrice || '';
      document.getElementById('prod-category').value = p.category;
      document.getElementById('prod-desc').value = p.desc;
      document.getElementById('prod-video').value = p.videoUrl || '';
      document.getElementById('prod-new').checked = p.isNew;
      
      if (p.images && p.images.length > 0) {
        document.getElementById('prod-image-data').value = p.images.join('|');
        window.renderImagePreviews();
      }
    }
  } else {
    title.innerText = 'إضافة منتج';
    document.getElementById('prod-id').value = '';
  }
  
  modal.classList.add('active');
}

window.closeProductModal = function() {
  document.getElementById('product-modal').classList.remove('active');
}

window.renderImagePreviews = function() {
  const dataStr = document.getElementById('prod-image-data').value;
  const previewContainer = document.getElementById('image-preview');
  previewContainer.innerHTML = '';
  
  if (!dataStr) return;
  
  const images = dataStr.split('|').map(s => s.trim()).filter(s => s);
  
  images.forEach((img, index) => {
    const div = document.createElement('div');
    div.style.cssText = 'position:relative; width:80px; height:80px; border-radius:8px; overflow:hidden; border:1px solid #ddd;';
    
    if (img.startsWith('http') || img.startsWith('data:image')) {
      div.innerHTML = `<img src="${img}" style="width:100%; height:100%; object-fit:cover;">`;
    } else {
      div.innerHTML = `<div style="width:100%; height:100%; background-color:${img};"></div>`;
    }
    
    const removeBtn = document.createElement('button');
    removeBtn.innerHTML = '&times;';
    removeBtn.style.cssText = 'position:absolute; top:2px; right:2px; background:rgba(255,0,0,0.7); color:white; border:none; border-radius:50%; width:20px; height:20px; cursor:pointer; display:flex; align-items:center; justify-content:center; font-size:14px;';
    removeBtn.onclick = (e) => {
      e.preventDefault();
      window.removeImage(index);
    };
    
    div.appendChild(removeBtn);
    previewContainer.appendChild(div);
  });
}

window.removeImage = function(index) {
  const dataStr = document.getElementById('prod-image-data').value;
  if (!dataStr) return;
  
  let images = dataStr.split('|').map(s => s.trim()).filter(s => s);
  images.splice(index, 1);
  document.getElementById('prod-image-data').value = images.join('|');
  window.renderImagePreviews();
}

window.handleImageUrlChange = function(event) {
  const val = event.target.value.trim();
  if (val) {
    const currentData = document.getElementById('prod-image-data').value;
    const images = currentData ? currentData.split('|').map(s => s.trim()).filter(s => s) : [];
    
    // Split by comma in case user pasted multiple URLs
    const newUrls = val.split(',').map(s => s.trim()).filter(s => s);
    images.push(...newUrls);
    
    document.getElementById('prod-image-data').value = images.join('|');
    event.target.value = ''; // Clear input
    window.renderImagePreviews();
  }
}

window.handleImageUpload = async function(event) {
  const files = event.target.files;
  if (!files || files.length === 0) return;
  
  const currentData = document.getElementById('prod-image-data').value;
  let images = currentData ? currentData.split('|').map(s => s.trim()).filter(s => s) : [];
  
  window.showToast('جاري ضغط ورفع الصور...');
  
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    try {
      // 1. Compress image to a Blob
      const compressedBlob = await compressImage(file);
      
      // 2. Upload to Firebase Storage
      const { ref, uploadBytes, getDownloadURL } = await import('firebase/storage');
      const fileName = `products/${Date.now()}_${Math.random().toString(36).substring(2)}.jpg`;
      const storageRef = ref(storage, fileName);
      
      await uploadBytes(storageRef, compressedBlob);
      const downloadURL = await getDownloadURL(storageRef);
      
      // 3. Save the URL
      images.push(downloadURL);
    } catch (error) {
      console.error("Error uploading image:", error);
      window.showToast('حدث خطأ أثناء رفع بعض الصور');
    }
  }
  
  document.getElementById('prod-image-data').value = images.join('|');
  document.getElementById('prod-image-color').value = '';
  window.renderImagePreviews();
  window.showToast('تمت إضافة الصور بنجاح');
}

function compressImage(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = event => {
      const img = new Image();
      img.src = event.target.result;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 800;
        const MAX_HEIGHT = 800;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        
        // Compress to JPEG Blob with 70% quality for Firebase Storage
        canvas.toBlob((blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error('Canvas to Blob failed'));
          }
        }, 'image/jpeg', 0.7);
      };
      img.onerror = error => reject(error);
    };
    reader.onerror = error => reject(error);
  });
}

window.saveProduct = async function() {
  const id = document.getElementById('prod-id').value || Date.now().toString();
  const name = document.getElementById('prod-name').value;
  const price = parseFloat(document.getElementById('prod-price').value);
  const salePrice = document.getElementById('prod-sale').value ? parseFloat(document.getElementById('prod-sale').value) : null;
  const category = document.getElementById('prod-category').value;
  const desc = document.getElementById('prod-desc').value;
  const videoUrl = document.getElementById('prod-video').value;
  const isNew = document.getElementById('prod-new').checked;
  
  let imagesStr = document.getElementById('prod-image-data').value;
  let images = [];
  if (imagesStr) {
    images = imagesStr.split('|').map(s => s.trim()).filter(s => s);
  } else {
    images = [document.getElementById('prod-image-color').value || '#EEEEEE']; // Default color
  }
  
  const productData = {
    id, name, price, salePrice, category, desc, isNew, images,
    videoUrl: videoUrl || null,
    rating: 5.0, reviews: 0 // Default for new products
  };
  
  const existingIndex = state.products.findIndex(p => p.id === id);
  if (existingIndex >= 0) {
    // Preserve rating/reviews
    productData.rating = state.products[existingIndex].rating;
    productData.reviews = state.products[existingIndex].reviews;
    window.showToast('تم تحديث المنتج بنجاح');
  } else {
    window.showToast('تمت إضافة المنتج بنجاح');
  }
  
  try {
    await setDoc(doc(db, 'products', id), productData);
  } catch (error) {
    console.error("Error saving product:", error);
    window.showToast('حدث خطأ أثناء حفظ المنتج');
  }
  
  window.closeProductModal();
  navigateTo('/admin');
}

let productToDelete = null;

window.deleteProduct = function(id) {
  productToDelete = id;
  const modal = document.getElementById('delete-confirm-modal');
  const confirmBtn = document.getElementById('confirm-delete-btn');
  document.getElementById('delete-confirm-text').innerText = 'هل أنت متأكد أنك تريد حذف هذا المنتج؟ لا يمكن التراجع عن هذا الإجراء.';
  
  confirmBtn.onclick = async function() {
    if (productToDelete) {
      try {
        await deleteDoc(doc(db, 'products', productToDelete));
        // Remove from cart and wishlist too
        state.cart = state.cart.filter(i => i.id !== productToDelete);
        state.wishlist = state.wishlist.filter(wId => wId !== productToDelete);
        saveState();
        window.showToast('تم حذف المنتج');
      } catch (error) {
        console.error("Error deleting product:", error);
        window.showToast('حدث خطأ أثناء حذف المنتج');
      }
      window.closeDeleteConfirmModal();
      navigateTo('/admin');
    }
  };
  
  modal.classList.add('active');
}

window.closeDeleteConfirmModal = function() {
  productToDelete = null;
  orderToDelete = null;
  document.getElementById('delete-confirm-modal').classList.remove('active');
}

let orderToDelete = null;

window.deleteOrder = function(id) {
  orderToDelete = id;
  const modal = document.getElementById('delete-confirm-modal');
  const confirmBtn = document.getElementById('confirm-delete-btn');
  document.getElementById('delete-confirm-text').innerText = 'هل أنت متأكد أنك تريد حذف هذا الطلب؟ لا يمكن التراجع عن هذا الإجراء.';
  
  confirmBtn.onclick = async function() {
    if (orderToDelete) {
      try {
        const { doc, deleteDoc } = await import('firebase/firestore');
        await deleteDoc(doc(db, 'orders', orderToDelete));
        window.showToast('تم حذف الطلب بنجاح');
        loadOrders(); // Refresh the orders table
      } catch (error) {
        console.error("Error deleting order:", error);
        window.showToast('حدث خطأ أثناء حذف الطلب');
      }
      window.closeDeleteConfirmModal();
    }
  };
  
  modal.classList.add('active');
}

function render404() {
  return `
    <div class="container text-center" style="padding: 150px 20px;">
      <h1 class="h1 mb-3">404</h1>
      <h2 class="h2 mb-4">الصفحة غير موجودة</h2>
      <p class="mb-5 text-gray-dark">الصفحة التي تبحث عنها غير موجودة أو تم نقلها.</p>
      <button class="btn btn-primary" onclick="navigateTo('/')">العودة للرئيسية</button>
    </div>
  `;
}

// Global Functions
window.addToCart = function(event, productId, showDrawer = true) {
  if (event) event.stopPropagation();
  
  const product = state.products.find(p => p.id === productId);
  if (!product) return;
  
  const existingItem = state.cart.find(item => item.id === productId);
  if (existingItem) {
    existingItem.quantity += 1;
  } else {
    state.cart.push({ ...product, quantity: 1 });
  }
  
  saveState();
  
  // Animate cart icon
  const cartBtn = document.getElementById('cart-btn');
  cartBtn.classList.remove('shake');
  void cartBtn.offsetWidth; // trigger reflow
  cartBtn.classList.add('shake');
  
  window.showToast('تمت الإضافة للسلة <i data-lucide="check" style="width:16px; height:16px; display:inline-block; vertical-align:middle;"></i>');
  
  if (showDrawer) {
    window.updateMiniCart();
    document.getElementById('mini-cart').classList.add('open');
    setTimeout(() => {
      document.getElementById('mini-cart').classList.remove('open');
    }, 3000);
  }
}

window.toggleWishlist = function(event, productId) {
  if (event) event.stopPropagation();
  
  const index = state.wishlist.indexOf(productId);
  if (index >= 0) {
    state.wishlist.splice(index, 1);
    window.showToast('تمت الإزالة من المفضلة');
  } else {
    state.wishlist.push(productId);
    window.showToast('تم حفظ المنتج! <i data-lucide="heart" fill="currentColor" style="width:16px; height:16px; display:inline-block; vertical-align:middle;"></i>');
  }
  
  saveState();
  
  // Update UI if on shop or home
  if (event && event.currentTarget) {
    event.currentTarget.classList.toggle('active');
    event.currentTarget.innerHTML = index >= 0 ? '<i data-lucide="heart" style="width: 18px; height: 18px;"></i>' : '<i data-lucide="heart" fill="currentColor" style="width: 18px; height: 18px;"></i>';
    if(window.lucide) window.lucide.createIcons();
  } else {
    // Re-render if called from detail page
    navigateTo(state.currentRoute, {id: productId});
  }
}

window.showToast = function(message, duration = 3000) {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.innerHTML = `<span style="display:flex; align-items:center; gap:8px;">${message}</span>`;
  
  container.appendChild(toast);
  if(window.lucide) window.lucide.createIcons();
  
  // Trigger animation
  setTimeout(() => toast.classList.add('show'), 10);
  
  // Remove after duration
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

window.updateMiniCart = function() {
  const container = document.getElementById('mini-cart-items');
  const totalEl = document.getElementById('mini-cart-total');
  
  if (state.cart.length === 0) {
    container.innerHTML = '<p class="text-center text-gray-dark mt-5">سلة المشتريات فارغة.</p>';
    totalEl.innerText = '0 ج.م';
    return;
  }
  
  let total = 0;
  container.innerHTML = state.cart.map(item => {
    const price = item.salePrice || item.price;
    total += price * item.quantity;
    
    const firstImage = (item.images && item.images.length > 0) ? item.images[0] : (item.image || '#ccc');
    const imageHtml = firstImage.startsWith('http') || firstImage.startsWith('data:image') 
      ? `<img src="${firstImage}" style="width:70px; height:70px; object-fit:cover; border-radius:8px;">`
      : `<div style="width:70px; height:70px; background-color:${firstImage}; border-radius:8px;"></div>`;
      
    return `
      <div style="display:flex; gap:15px; margin-bottom:20px; padding-bottom:20px; border-bottom:1px solid var(--gray-light);">
        ${imageHtml}
        <div style="flex:1;">
          <div style="font-weight:700; font-size:1rem;">${item.name}</div>
          <div style="color:var(--gray-dark); font-size:0.85rem;">الكمية: ${item.quantity}</div>
          <div style="font-weight:700; margin-top:5px; color:var(--accent-gold);">${price * item.quantity} ج.م</div>
        </div>
      </div>
    `;
  }).join('');
  
  totalEl.innerText = total.toFixed(2) + ' ج.م';
}

window.closeMiniCart = function() {
  document.getElementById('mini-cart').classList.remove('open');
}

function updateCartBadge() {
  const badge = document.getElementById('cart-badge');
  if (badge) {
    badge.innerText = state.cart.reduce((sum, item) => sum + item.quantity, 0);
  }
}

// Scroll Reveal & Sticky Nav
function initScrollReveal() {
  const reveals = document.querySelectorAll('.reveal');
  
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('active');
      }
    });
  }, { threshold: 0.1 });
  
  reveals.forEach(reveal => observer.observe(reveal));
}

window.addEventListener('scroll', () => {
  const navbar = document.getElementById('main-nav');
  const backToTop = document.getElementById('back-to-top');
  
  if (navbar) {
    if (window.scrollY > 50) {
      navbar.classList.add('scrolled');
    } else {
      navbar.classList.remove('scrolled');
    }
  }
  
  if (backToTop) {
    if (window.scrollY > 400) {
      backToTop.classList.add('visible');
    } else {
      backToTop.classList.remove('visible');
    }
  }
});

// Intercept link clicks for routing
function attachEventListeners() {
  document.querySelectorAll('a.nav-link-route').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const path = e.currentTarget.getAttribute('href') || e.currentTarget.getAttribute('onclick').match(/'([^']+)'/)[1];
      if (path && !path.startsWith('#')) {
        navigateTo(path);
      }
    });
  });
}

// Initialization
function init() {
  document.getElementById('nav-container').innerHTML = renderNavbar();
  document.getElementById('footer-container').innerHTML = renderFooter();
  
  // Parse URL params
  const urlParams = new URLSearchParams(window.location.search);
  const id = urlParams.get('id');
  
  // Initial render
  const path = window.location.pathname;
  const renderFunc = routes[path] || render404;
  document.getElementById('app').innerHTML = renderFunc(id ? { id } : {});
  
  attachEventListeners();
  initScrollReveal();
  updateCartBadge();
}

// Run init when DOM is loaded
document.addEventListener('DOMContentLoaded', init);
