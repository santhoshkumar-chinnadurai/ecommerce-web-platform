const state = {
  user: JSON.parse(localStorage.getItem("user") || "null"),
  token: localStorage.getItem("token"),
  products: [],
  cart: JSON.parse(localStorage.getItem("cart") || "[]"),
  category: "All",
  search: ""
};

const els = {
  pages: {
    shop: document.querySelector("#shopPage"),
    product: document.querySelector("#productPage"),
    login: document.querySelector("#loginPage"),
    register: document.querySelector("#registerPage"),
    orders: document.querySelector("#ordersPage"),
    admin: document.querySelector("#adminPage")
  },
  adminLink: document.querySelector("#adminLink"),
  loginLink: document.querySelector("#loginLink"),
  registerLink: document.querySelector("#registerLink"),
  accountButton: document.querySelector("#accountButton"),
  cartButton: document.querySelector("#cartButton"),
  cartCount: document.querySelector("#cartCount"),
  closeCart: document.querySelector("#closeCart"),
  cartDrawer: document.querySelector("#cartDrawer"),
  categoryList: document.querySelector("#categoryList"),
  catalogEyebrow: document.querySelector("#catalogEyebrow"),
  searchInput: document.querySelector("#searchInput"),
  productGrid: document.querySelector("#productGrid"),
  productDetail: document.querySelector("#productDetail"),
  backToShop: document.querySelector("#backToShop"),
  loginForm: document.querySelector("#loginForm"),
  registerForm: document.querySelector("#registerForm"),
  cartItems: document.querySelector("#cartItems"),
  cartTotal: document.querySelector("#cartTotal"),
  checkoutButton: document.querySelector("#checkoutButton"),
  refreshOrdersButton: document.querySelector("#refreshOrdersButton"),
  ordersList: document.querySelector("#ordersList"),
  productForm: document.querySelector("#productForm"),
  clearProductForm: document.querySelector("#clearProductForm"),
  adminProducts: document.querySelector("#adminProducts"),
  toast: document.querySelector("#toast")
};

function money(value) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value || 0);
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#039;"
  })[char]);
}

function showToast(message) {
  els.toast.textContent = message;
  els.toast.classList.remove("hidden");
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => els.toast.classList.add("hidden"), 3200);
}

async function api(path, options = {}) {
  const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
  if (state.token) headers.Authorization = `Bearer ${state.token}`;

  const response = await fetch(path, { ...options, headers });
  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: "Request failed" }));
    throw new Error(error.message || "Request failed");
  }

  if (response.status === 204) return null;
  return response.json();
}

function navigate(path) {
  history.pushState(null, "", path);
  renderRoute();
}

function currentRoute() {
  const path = window.location.pathname;
  if (path.startsWith("/product/")) return "product";
  if (path === "/login") return "login";
  if (path === "/register") return "register";
  if (path === "/orders") return "orders";
  if (path === "/admin") return "admin";
  return "shop";
}

function showPage(pageName) {
  Object.entries(els.pages).forEach(([name, page]) => {
    page.classList.toggle("hidden", name !== pageName);
  });
}

function renderRoute() {
  const route = currentRoute();

  if (route === "orders" && !state.user) {
    showToast("Login to view orders");
    navigate("/login");
    return;
  }

  if (route === "admin" && state.user?.role !== "Admin") {
    showToast("Admin access required");
    navigate("/");
    return;
  }

  showPage(route);
  renderHeader();

  if (route === "product") renderProductDetail();
  if (route === "orders") loadOrders();
  if (route === "admin") renderAdminProducts();
}

function renderHeader() {
  const signedIn = Boolean(state.user);
  els.loginLink.classList.toggle("hidden", signedIn);
  els.registerLink.classList.toggle("hidden", signedIn);
  els.accountButton.classList.toggle("hidden", !signedIn);
  els.adminLink.classList.toggle("hidden", state.user?.role !== "Admin");

  if (signedIn) {
    els.accountButton.textContent = `${state.user.name} - Logout`;
  }
}

function categories() {
  return ["All", ...Array.from(new Set(state.products.map((product) => product.category))).sort()];
}

function filteredProducts() {
  const term = state.search.trim().toLowerCase();
  return state.products.filter((product) => {
    const categoryMatch = state.category === "All" || product.category === state.category;
    const text = `${product.name} ${product.description} ${product.category}`.toLowerCase();
    return categoryMatch && (!term || text.includes(term));
  });
}

function renderCategories() {
  els.categoryList.innerHTML = categories().map((category) => `
    <button class="${category === state.category ? "active" : ""}" type="button" data-category="${escapeHtml(category)}">
      ${escapeHtml(category)}
    </button>
  `).join("");
  els.catalogEyebrow.textContent = state.category === "All" ? "All products" : state.category;
}

function renderProducts() {
  const products = filteredProducts();

  els.productGrid.innerHTML = products.length ? products.map((product) => `
    <article class="product-card">
      <a href="/product/${product._id}" data-route>
        <img src="${escapeHtml(product.imageUrl || fallbackImage())}" alt="${escapeHtml(product.name)}">
      </a>
      <div class="product-body">
        <div class="product-title">
          <span>${escapeHtml(product.category)}</span>
          <strong>${money(product.price)}</strong>
        </div>
        <h3><a href="/product/${product._id}" data-route>${escapeHtml(product.name)}</a></h3>
        <p>${escapeHtml(product.description)}</p>
        <div class="product-actions">
          <button type="button" data-add="${product._id}" ${product.stock < 1 ? "disabled" : ""}>Add to Cart</button>
          <a class="text-button" href="/product/${product._id}" data-route>View details</a>
        </div>
      </div>
    </article>
  `).join("") : "<p class=\"empty-state\">No products found.</p>";
}

function fallbackImage() {
  return "https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=900&q=80";
}

function renderProductDetail() {
  const id = window.location.pathname.split("/").pop();
  const product = state.products.find((entry) => entry._id === id);

  if (!product) {
    els.productDetail.innerHTML = "<p class=\"empty-state\">Product not found.</p>";
    return;
  }

  const features = Array.isArray(product.features) && product.features.length
    ? product.features
    : ["Quality checked", "Easy returns", "Secure checkout"];

  const specs = product.specs && typeof product.specs === "object" ? product.specs : {};

  els.productDetail.innerHTML = `
    <div class="detail-media">
      <img src="${escapeHtml(product.imageUrl || fallbackImage())}" alt="${escapeHtml(product.name)}">
    </div>
    <div class="detail-copy">
      <p class="eyebrow">${escapeHtml(product.category)}</p>
      <h1>${escapeHtml(product.name)}</h1>
      <strong class="detail-price">${money(product.price)}</strong>
      <p class="detail-description">${escapeHtml(product.longDescription || product.description)}</p>
      <p class="stock-line">${product.stock > 0 ? `${product.stock} in stock` : "Out of stock"}</p>
      <div class="detail-actions">
        <button type="button" data-add="${product._id}" ${product.stock < 1 ? "disabled" : ""}>Add to Cart</button>
        <button class="secondary" type="button" data-buy="${product._id}" ${product.stock < 1 ? "disabled" : ""}>Buy Now</button>
      </div>
      <div class="detail-section">
        <h2>Highlights</h2>
        <ul>${features.map((feature) => `<li>${escapeHtml(feature)}</li>`).join("")}</ul>
      </div>
      <div class="detail-section">
        <h2>Product Details</h2>
        <dl>
          ${Object.entries(specs).map(([key, value]) => `
            <div><dt>${escapeHtml(key)}</dt><dd>${escapeHtml(value)}</dd></div>
          `).join("") || "<div><dt>Category</dt><dd>" + escapeHtml(product.category) + "</dd></div>"}
        </dl>
      </div>
    </div>
  `;
}

function renderCart() {
  const count = state.cart.reduce((sum, item) => sum + item.quantity, 0);
  els.cartCount.textContent = count;

  if (!state.cart.length) {
    els.cartItems.innerHTML = "<p class=\"empty-state\">Your cart is empty.</p>";
  } else {
    els.cartItems.innerHTML = state.cart.map((item) => {
      const product = state.products.find((entry) => entry._id === item.productId);
      return `
        <div class="cart-row">
          <img src="${escapeHtml(product?.imageUrl || fallbackImage())}" alt="${escapeHtml(product?.name || "Product")}">
          <div>
            <strong>${escapeHtml(product?.name || "Unavailable product")}</strong>
            <span>${money(product?.price || 0)} each</span>
            <div class="qty-controls">
              <button type="button" data-dec="${item.productId}">-</button>
              <strong>${item.quantity}</strong>
              <button type="button" data-inc="${item.productId}">+</button>
              <button class="remove-button" type="button" data-remove="${item.productId}">Remove</button>
            </div>
          </div>
        </div>
      `;
    }).join("");
  }

  const total = state.cart.reduce((sum, item) => {
    const product = state.products.find((entry) => entry._id === item.productId);
    return sum + (product?.price || 0) * item.quantity;
  }, 0);

  els.cartTotal.textContent = money(total);
  els.checkoutButton.disabled = !state.cart.length;
}

function renderAdminProducts() {
  els.adminProducts.innerHTML = state.products.map((product) => `
    <div class="admin-row">
      <img src="${escapeHtml(product.imageUrl || fallbackImage())}" alt="${escapeHtml(product.name)}">
      <div>
        <strong>${escapeHtml(product.name)}</strong>
        <span>${escapeHtml(product.category)} - ${money(product.price)} - ${product.stock} in stock</span>
      </div>
      <div class="row-actions">
        <button class="secondary" type="button" data-edit="${product._id}">Edit</button>
        <button class="danger" type="button" data-delete="${product._id}">Delete</button>
      </div>
    </div>
  `).join("");
}

function renderAll() {
  renderHeader();
  renderCategories();
  renderProducts();
  renderCart();
  if (currentRoute() === "product") renderProductDetail();
  if (currentRoute() === "admin") renderAdminProducts();
}

function saveCart() {
  localStorage.setItem("cart", JSON.stringify(state.cart));
}

function addToCart(productId, openCart = false) {
  const product = state.products.find((entry) => entry._id === productId);
  if (!product || product.stock < 1) return;

  const existing = state.cart.find((item) => item.productId === productId);
  if (existing) {
    if (existing.quantity < product.stock) existing.quantity += 1;
  } else {
    state.cart.push({ productId, quantity: 1 });
  }

  saveCart();
  renderCart();
  showToast("Added to cart");
  if (openCart) els.cartDrawer.classList.remove("hidden");
}

async function loadProducts() {
  state.products = await api("/api/products");
  renderAll();
  renderRoute();
}

async function loadOrders() {
  if (!state.user) {
    els.ordersList.innerHTML = "<p class=\"empty-state\">Login to view orders.</p>";
    return;
  }

  const orders = await api("/api/orders");
  els.ordersList.innerHTML = orders.length ? orders.map((order) => `
    <article class="order-card">
      <div class="order-top">
        <div>
          <h2>Order ${order._id.slice(-6).toUpperCase()}</h2>
          <p>${new Date(order.createdAt).toLocaleString()} - ${escapeHtml(order.customerEmail)}</p>
        </div>
        <span class="status">${escapeHtml(order.status)}</span>
      </div>
      <p>${order.items.map((item) => `${escapeHtml(item.name)} x ${item.quantity}`).join(", ")}</p>
      <strong>${money(order.total)}</strong>
      ${state.user.role === "Admin" ? `
        <select data-status="${order._id}">
          ${["Placed", "Packed", "Shipped", "Delivered", "Cancelled"].map((status) => `
            <option value="${status}" ${status === order.status ? "selected" : ""}>${status}</option>
          `).join("")}
        </select>
      ` : ""}
    </article>
  `).join("") : "<p class=\"empty-state\">No orders yet.</p>";
}

function persistAuth(payload) {
  state.user = payload.user;
  state.token = payload.token;
  localStorage.setItem("user", JSON.stringify(state.user));
  localStorage.setItem("token", state.token);
  renderAll();
  navigate("/");
}

function clearAuth() {
  state.user = null;
  state.token = null;
  localStorage.removeItem("user");
  localStorage.removeItem("token");
  renderAll();
  navigate("/");
}

document.addEventListener("click", (event) => {
  const routeLink = event.target.closest("[data-route]");
  if (routeLink) {
    event.preventDefault();
    navigate(routeLink.getAttribute("href"));
    return;
  }

  const addId = event.target.dataset.add;
  const buyId = event.target.dataset.buy;
  if (addId || buyId) {
    addToCart(addId || buyId, Boolean(buyId));
  }
});

els.categoryList.addEventListener("click", (event) => {
  const category = event.target.dataset.category;
  if (!category) return;
  state.category = category;
  renderCategories();
  renderProducts();
});

els.searchInput.addEventListener("input", (event) => {
  state.search = event.target.value;
  renderProducts();
});

els.backToShop.addEventListener("click", () => navigate("/"));
els.cartButton.addEventListener("click", () => els.cartDrawer.classList.remove("hidden"));
els.closeCart.addEventListener("click", () => els.cartDrawer.classList.add("hidden"));
els.accountButton.addEventListener("click", clearAuth);
els.refreshOrdersButton.addEventListener("click", loadOrders);

els.loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const body = Object.fromEntries(new FormData(event.currentTarget));
  try {
    persistAuth(await api("/api/auth/login", { method: "POST", body: JSON.stringify(body) }));
    showToast("Logged in");
  } catch (error) {
    showToast(error.message);
  }
});

els.registerForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const body = Object.fromEntries(new FormData(event.currentTarget));
  try {
    persistAuth(await api("/api/auth/register", { method: "POST", body: JSON.stringify(body) }));
    showToast("Account created");
  } catch (error) {
    showToast(error.message);
  }
});

els.cartItems.addEventListener("click", (event) => {
  const productId = event.target.dataset.inc || event.target.dataset.dec || event.target.dataset.remove;
  if (!productId) return;

  const item = state.cart.find((entry) => entry.productId === productId);
  const product = state.products.find((entry) => entry._id === productId);
  if (!item) return;

  if (event.target.dataset.inc && (!product || item.quantity < product.stock)) item.quantity += 1;
  if (event.target.dataset.dec) item.quantity -= 1;
  if (event.target.dataset.remove || item.quantity <= 0) {
    state.cart = state.cart.filter((entry) => entry.productId !== productId);
  }

  saveCart();
  renderCart();
});

els.checkoutButton.addEventListener("click", async () => {
  if (!state.user) {
    showToast("Login before checkout");
    navigate("/login");
    return;
  }

  try {
    await api("/api/orders", { method: "POST", body: JSON.stringify({ items: state.cart }) });
    state.cart = [];
    saveCart();
    await loadProducts();
    els.cartDrawer.classList.add("hidden");
    showToast("Order placed");
    navigate("/orders");
  } catch (error) {
    showToast(error.message);
  }
});

els.productForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const body = Object.fromEntries(new FormData(event.currentTarget));
  const id = body.id;
  delete body.id;
  body.price = Number(body.price);
  body.stock = Number(body.stock);

  try {
    await api(id ? `/api/products/${id}` : "/api/products", {
      method: id ? "PUT" : "POST",
      body: JSON.stringify(body)
    });
    event.currentTarget.reset();
    await loadProducts();
    showToast("Product saved");
  } catch (error) {
    showToast(error.message);
  }
});

els.clearProductForm.addEventListener("click", () => els.productForm.reset());

els.adminProducts.addEventListener("click", async (event) => {
  const editId = event.target.dataset.edit;
  const deleteId = event.target.dataset.delete;

  if (editId) {
    const product = state.products.find((entry) => entry._id === editId);
    for (const [key, value] of Object.entries(product)) {
      if (els.productForm.elements[key]) els.productForm.elements[key].value = value;
    }
    els.productForm.elements.id.value = product._id;
  }

  if (deleteId && confirm("Delete this product?")) {
    try {
      await api(`/api/products/${deleteId}`, { method: "DELETE" });
      await loadProducts();
      showToast("Product deleted");
    } catch (error) {
      showToast(error.message);
    }
  }
});

els.ordersList.addEventListener("change", async (event) => {
  const orderId = event.target.dataset.status;
  if (!orderId) return;

  try {
    await api(`/api/orders/${orderId}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status: event.target.value })
    });
    await loadOrders();
    showToast("Order updated");
  } catch (error) {
    showToast(error.message);
  }
});

window.addEventListener("popstate", renderRoute);

loadProducts().catch((error) => showToast(error.message));
