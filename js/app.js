// Supabase database object
var db = null;

// Register PWA Service Worker
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("/sw.js").catch(function () {});
}

// Check if current page is inside /pages/ folder
function isInPagesFolder() {
  return window.location.pathname.indexOf("/pages/") !== -1;
}

// Session cache helpers for stale-while-revalidate reads
function getSessionCache(key) {
  try {
    var raw = sessionStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch (err) {
    return null;
  }
}

function setSessionCache(key, value) {
  try {
    sessionStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    // Ignore storage quota errors
  }
}

function removeSessionCache(key) {
  try {
    sessionStorage.removeItem(key);
  } catch (err) {
    // Ignore
  }
}

function clearUserSessionCache(token) {
  if (!token) return;
  var keySuffix = token.slice(0, 16);
  removeSessionCache("skit_user_" + keySuffix);
  removeSessionCache("skit_batches_" + keySuffix);
  removeSessionCache("skit_history_" + keySuffix);
}

// Strict raster image data URL validation (blocks SVG/XSS payloads)
function isSafeImageDataUrl(value) {
  if (typeof value !== "string") return false;
  return /^data:image\/(jpeg|jpg|png|webp|gif);base64,[A-Za-z0-9+/=]+$/i.test(value);
}

// Read SUPABASE_URL and SUPABASE_ANON_KEY from sessionStorage, js/env.json (Vercel), or .env.local (local)
async function connectDatabase() {
  if (db !== null) {
    return db;
  }

  var cachedConfig = getSessionCache("skit_db_config");
  if (cachedConfig && cachedConfig.url && cachedConfig.key && window.supabase) {
    db = window.supabase.createClient(cachedConfig.url, cachedConfig.key);
    return db;
  }

  var url = "";
  var key = "";

  try {
    var envJsonPath = isInPagesFolder() ? "../js/env.json" : "js/env.json";
    var jsonRes = await fetch(envJsonPath);
    if (jsonRes.ok) {
      var envObj = await jsonRes.json();
      url = (envObj.SUPABASE_URL || "").trim();
      key = (envObj.SUPABASE_ANON_KEY || "").trim();
    }
  } catch (err) {
    // Ignore and fall back to .env.local
  }

  if (!url || !key) {
    try {
      var envPath = isInPagesFolder() ? "../.env.local" : ".env.local";
      var response = await fetch(envPath);
      if (response.ok) {
        var text = await response.text();
        var lines = text.split("\n");

        for (var i = 0; i < lines.length; i++) {
          var line = lines[i].trim();
          if (line.indexOf("SUPABASE_URL=") === 0) {
            url = line.replace("SUPABASE_URL=", "").trim();
          }
          if (line.indexOf("SUPABASE_ANON_KEY=") === 0) {
            key = line.replace("SUPABASE_ANON_KEY=", "").trim();
          }
        }
      }
    } catch (err) {
      // Ignore
    }
  }

  if (!url || !key || url.indexOf("your-project-id") !== -1) {
    return null;
  }

  setSessionCache("skit_db_config", { url: url, key: key });
  db = window.supabase.createClient(url, key);
  return db;
}

connectDatabase();

// Cryptographic session token cookie helpers
function setSessionCookie(token) {
  var secureFlag = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie =
    "skitSessionToken=" + encodeURIComponent(token) +
    "; path=/; max-age=604800; SameSite=Lax" + secureFlag;
}

function getSessionCookie() {
  var cookies = document.cookie.split(";");
  for (var i = 0; i < cookies.length; i++) {
    var parts = cookies[i].trim().split("=");
    if (parts[0] === "skitSessionToken") {
      return decodeURIComponent(parts[1] || "");
    }
  }
  return "";
}

function clearSessionCookie() {
  var secureFlag = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = "skitSessionToken=; path=/; max-age=0; SameSite=Lax" + secureFlag;
  document.cookie = "loggedInMobile=; path=/; max-age=0; SameSite=Lax" + secureFlag;
}

// Map RPC errors to safe user-facing messages without leaking DB internals
var SAFE_ERROR_MESSAGES = [
  "Wrong mobile number or password",
  "Too many failed attempts. Please try again in a few minutes",
  "Mobile number already registered",
  "Enter 10-digit mobile number",
  "Enter shop name",
  "Minimum 6 characters required",
  "Enter item name",
  "Enter valid quantity",
  "Select expiry date",
  "Invalid product details",
  "Item not found",
  "Session expired"
];

function getSafeErrorMessage(error, fallback) {
  if (error && typeof error.message === "string") {
    for (var i = 0; i < SAFE_ERROR_MESSAGES.length; i++) {
      if (error.message.indexOf(SAFE_ERROR_MESSAGES[i]) !== -1) {
        return SAFE_ERROR_MESSAGES[i];
      }
    }
  }
  return fallback || "Something went wrong. Please try again";
}

function handleSessionExpired() {
  var token = getSessionCookie();
  clearUserSessionCache(token);
  clearSessionCookie();
  window.location.href = isInPagesFolder() ? "login.html" : "pages/login.html";
}

// Helper to show loading state on submit button
function setButtonLoading(formId, isLoading, loadingText, normalText) {
  var form = document.getElementById(formId);
  if (!form) return;
  var btn = form.querySelector("button[type='submit']");
  if (!btn) return;

  btn.disabled = isLoading;
  btn.innerText = isLoading ? loadingText : normalText;
}

// Show or hide hamburger side menu
function toggleMenu() {
  var overlay = document.getElementById("side-menu-overlay");
  if (overlay) {
    overlay.classList.toggle("open");
  }
}

// Show or hide password
function togglePassword(inputId, btn) {
  var input = document.getElementById(inputId);
  if (input.type === "password") {
    input.type = "text";
    btn.innerText = "Hide";
  } else {
    input.type = "password";
    btn.innerText = "Show";
  }
}

// Clear all error messages
function clearErrors() {
  var errors = document.getElementsByClassName("error");
  for (var i = 0; i < errors.length; i++) {
    errors[i].innerText = "";
  }

  var ids = [
    "login-main-error",
    "signup-main-error",
    "profile-main-error",
    "profile-success",
    "add-main-error",
    "add-success"
  ];
  for (var j = 0; j < ids.length; j++) {
    var el = document.getElementById(ids[j]);
    if (el) el.innerText = "";
  }
}

// Allow only digits in mobile input
function allowOnlyNumbers(inputId) {
  var input = document.getElementById(inputId);
  if (input) {
    input.addEventListener("input", function () {
      input.value = input.value.replace(/[^0-9]/g, "");
    });
  }
}

allowOnlyNumbers("login-mobile");
allowOnlyNumbers("signup-mobile");
allowOnlyNumbers("profile-mobile");

// Client-side auth attempt throttle
var authCooldownUntil = 0;
var consecutiveAuthFailures = 0;

function checkAuthCooldown(errorElementId) {
  var now = Date.now();
  if (now < authCooldownUntil) {
    var secs = Math.ceil((authCooldownUntil - now) / 1000);
    document.getElementById(errorElementId).innerText = "Please wait " + secs + "s before trying again";
    return true;
  }
  return false;
}

function recordAuthFailure() {
  consecutiveAuthFailures++;
  if (consecutiveAuthFailures >= 3) {
    var waitMs = Math.min(30000, (consecutiveAuthFailures - 2) * 5000);
    authCooldownUntil = Date.now() + waitMs;
  }
}

function resetAuthFailure() {
  consecutiveAuthFailures = 0;
  authCooldownUntil = 0;
}

// Login form submit
async function handleLogin(event) {
  event.preventDefault();
  clearErrors();

  if (checkAuthCooldown("login-main-error")) {
    return;
  }

  var mobile = document.getElementById("login-mobile").value.trim();
  var password = document.getElementById("login-password").value;
  var hasError = false;

  if (mobile.length !== 10) {
    document.getElementById("login-mobile-error").innerText = "Enter 10-digit mobile number";
    hasError = true;
  }

  if (password === "") {
    document.getElementById("login-password-error").innerText = "Enter password";
    hasError = true;
  }

  if (hasError) {
    return;
  }

  setButtonLoading("login-form", true, "Logging in...", "Login");

  var client = await connectDatabase();
  if (client === null) {
    setButtonLoading("login-form", false, "Logging in...", "Login");
    document.getElementById("login-main-error").innerText = "Service unavailable";
    return;
  }

  var result = await client.rpc("auth_login", {
    p_mobile: mobile,
    p_password: password
  });

  if (result.error || !result.data || !result.data.session_token) {
    recordAuthFailure();
    setButtonLoading("login-form", false, "Logging in...", "Login");
    document.getElementById("login-main-error").innerText = getSafeErrorMessage(
      result.error,
      "Wrong mobile number or password"
    );
    return;
  }

  resetAuthFailure();
  var token = result.data.session_token;
  setSessionCookie(token);
  setSessionCache("skit_user_" + token.slice(0, 16), {
    mobile: result.data.mobile,
    shop_name: result.data.shop_name,
    profile_icon: result.data.profile_icon || ""
  });

  window.location.href = "home.html";
}

// Sign up form submit
async function handleSignup(event) {
  event.preventDefault();
  clearErrors();

  if (checkAuthCooldown("signup-main-error")) {
    return;
  }

  var mobile = document.getElementById("signup-mobile").value.trim();
  var shopName = document.getElementById("signup-shop").value.trim();
  var password = document.getElementById("signup-password").value;
  var confirmPassword = document.getElementById("signup-confirm").value;
  var hasError = false;

  if (mobile.length !== 10) {
    document.getElementById("signup-mobile-error").innerText = "Enter 10-digit mobile number";
    hasError = true;
  }

  if (shopName.length < 2) {
    document.getElementById("signup-shop-error").innerText = "Enter shop name";
    hasError = true;
  }

  if (password.length < 6) {
    document.getElementById("signup-password-error").innerText = "Minimum 6 characters required";
    hasError = true;
  }

  if (confirmPassword !== password || confirmPassword === "") {
    document.getElementById("signup-confirm-error").innerText = "Passwords do not match";
    hasError = true;
  }

  if (hasError) {
    return;
  }

  setButtonLoading("signup-form", true, "Signing up...", "Sign Up");

  var client = await connectDatabase();
  if (client === null) {
    setButtonLoading("signup-form", false, "Signing up...", "Sign Up");
    document.getElementById("signup-main-error").innerText = "Service unavailable";
    return;
  }

  var result = await client.rpc("auth_signup", {
    p_mobile: mobile,
    p_shop_name: shopName,
    p_password: password
  });

  if (result.error || !result.data || !result.data.session_token) {
    recordAuthFailure();
    setButtonLoading("signup-form", false, "Signing up...", "Sign Up");
    document.getElementById("signup-main-error").innerText = getSafeErrorMessage(
      result.error,
      "Unable to create account"
    );
    return;
  }

  resetAuthFailure();
  var token = result.data.session_token;
  setSessionCookie(token);
  setSessionCache("skit_user_" + token.slice(0, 16), {
    mobile: result.data.mobile,
    shop_name: result.data.shop_name,
    profile_icon: ""
  });

  window.location.href = "home.html";
}

// Logout button click
async function handleLogout() {
  var logoutBtn = document.getElementById("logout-btn");
  if (logoutBtn) {
    logoutBtn.disabled = true;
    logoutBtn.innerText = "Logging out...";
  }

  var token = getSessionCookie();
  var client = await connectDatabase();

  if (client !== null && token !== "") {
    await client.rpc("auth_logout", { p_token: token });
  }

  clearUserSessionCache(token);
  clearSessionCookie();
  window.location.href = "login.html";
}

var selectedProfileIcon = "";

function previewProfileIcon(event) {
  var file = event.target.files[0];
  var preview = document.getElementById("profile-icon-preview");
  if (!file || !preview) return;

  compressImageFile(file, function (compressedData) {
    if (!isSafeImageDataUrl(compressedData)) return;
    selectedProfileIcon = compressedData;
    preview.src = compressedData;
    preview.style.display = "block";
  });
}

function renderTopBarProfile(shopName, profileIcon) {
  var topShopName = document.getElementById("top-shop-name");
  if (topShopName) {
    topShopName.innerText = shopName || "";
  }

  var profileBtn = document.getElementById("profile-btn");
  if (profileBtn) {
    profileBtn.textContent = "";
    if (isSafeImageDataUrl(profileIcon)) {
      var img = document.createElement("img");
      img.src = profileIcon;
      img.alt = "Profile";
      profileBtn.appendChild(img);
    } else if (shopName) {
      profileBtn.innerText = shopName.charAt(0).toUpperCase();
    }
  }
}

function applyUserInfoToUI(userData) {
  if (!userData) return;
  var shopName = userData.shop_name;
  selectedProfileIcon = isSafeImageDataUrl(userData.profile_icon) ? userData.profile_icon : "";
  renderTopBarProfile(shopName, selectedProfileIcon);

  var profileShopInput = document.getElementById("profile-shop");
  var profileMobileInput = document.getElementById("profile-mobile");
  if (profileShopInput && profileMobileInput) {
    profileShopInput.value = shopName;
    profileMobileInput.value = userData.mobile;

    var iconPreview = document.getElementById("profile-icon-preview");
    if (iconPreview && selectedProfileIcon) {
      iconPreview.src = selectedProfileIcon;
      iconPreview.style.display = "block";
    }
  }
}

// Save updated profile details
async function handleProfileSave(event) {
  event.preventDefault();
  clearErrors();

  var token = getSessionCookie();
  if (!token) {
    handleSessionExpired();
    return;
  }

  var newShop = document.getElementById("profile-shop").value.trim();
  var newMobile = document.getElementById("profile-mobile").value.trim();
  var newPassword = document.getElementById("profile-password").value;
  var hasError = false;

  if (newShop.length < 2) {
    document.getElementById("profile-shop-error").innerText = "Enter shop name";
    hasError = true;
  }

  if (newMobile.length !== 10) {
    document.getElementById("profile-mobile-error").innerText = "Enter 10-digit mobile number";
    hasError = true;
  }

  if (newPassword !== "" && newPassword.length < 6) {
    document.getElementById("profile-password-error").innerText = "Minimum 6 characters required";
    hasError = true;
  }

  if (hasError) {
    return;
  }

  setButtonLoading("profile-form", true, "Saving...", "Save Changes");

  var client = await connectDatabase();
  if (client === null) {
    setButtonLoading("profile-form", false, "Saving...", "Save Changes");
    document.getElementById("profile-main-error").innerText = "Service unavailable";
    return;
  }

  var safeIcon = isSafeImageDataUrl(selectedProfileIcon) ? selectedProfileIcon : "";

  var updateRes = await client.rpc("auth_update_profile", {
    p_token: token,
    p_shop_name: newShop,
    p_new_mobile: newMobile,
    p_new_password: newPassword,
    p_profile_icon: safeIcon
  });

  setButtonLoading("profile-form", false, "Saving...", "Save Changes");

  if (updateRes.error) {
    if (updateRes.error.message && updateRes.error.message.indexOf("Session expired") !== -1) {
      handleSessionExpired();
      return;
    }
    document.getElementById("profile-main-error").innerText = getSafeErrorMessage(
      updateRes.error,
      "Unable to save profile"
    );
    return;
  }

  setSessionCache("skit_user_" + token.slice(0, 16), {
    mobile: newMobile,
    shop_name: newShop,
    profile_icon: safeIcon
  });
  renderTopBarProfile(newShop, safeIcon);
  document.getElementById("profile-password").value = "";
  document.getElementById("profile-success").innerText = "Profile updated";
}

// Compress an uploaded image file (supports .heic, .jpg, .png, etc.)
async function compressImageFile(file, callback) {
  var imageBlob = file;
  var fileName = (file.name || "").toLowerCase();
  var isHeic =
    fileName.endsWith(".heic") ||
    fileName.endsWith(".heif") ||
    file.type === "image/heic" ||
    file.type === "image/heif";

  if (isHeic && window.heic2any) {
    try {
      imageBlob = await window.heic2any({
        blob: file,
        toType: "image/jpeg",
        quality: 0.7
      });
      if (Array.isArray(imageBlob)) {
        imageBlob = imageBlob[0];
      }
    } catch (err) {
      // Ignore conversion error
    }
  }

  var reader = new FileReader();
  reader.onload = function (e) {
    var img = new Image();
    img.onload = function () {
      var maxSize = 240;
      var width = img.width;
      var height = img.height;

      if (width > height && width > maxSize) {
        height = Math.round((height * maxSize) / width);
        width = maxSize;
      } else if (height > maxSize) {
        width = Math.round((width * maxSize) / height);
        height = maxSize;
      }

      var canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;

      var ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, width, height);
      callback(canvas.toDataURL("image/jpeg", 0.6));
    };
    img.onerror = function () {
      callback("");
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(imageBlob);
}

// Camera stream state
var activeCameraStream = null;

async function openCamera(mode) {
  closeCamera(mode);
  var box = document.getElementById(mode + "-camera-box");
  var video = document.getElementById(mode + "-camera-video");
  if (!box || !video || !navigator.mediaDevices) return;

  try {
    activeCameraStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "environment" },
      audio: false
    });
    video.srcObject = activeCameraStream;
    box.classList.add("open");
  } catch (err) {
    // Camera permission denied or unavailable
  }
}

function capturePhoto(mode) {
  var video = document.getElementById(mode + "-camera-video");
  if (!video || !video.videoWidth) return;

  var maxSize = 240;
  var width = video.videoWidth;
  var height = video.videoHeight;

  if (width > height && width > maxSize) {
    height = Math.round((height * maxSize) / width);
    width = maxSize;
  } else if (height > maxSize) {
    width = Math.round((width * maxSize) / height);
    height = maxSize;
  }

  var canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  var ctx = canvas.getContext("2d");
  ctx.drawImage(video, 0, 0, width, height);
  var compressed = canvas.toDataURL("image/jpeg", 0.6);

  if (!isSafeImageDataUrl(compressed)) {
    closeCamera(mode);
    return;
  }

  if (mode === "add") {
    selectedProductImage = compressed;
    var addPreview = document.getElementById("item-preview");
    addPreview.src = compressed;
    addPreview.style.display = "block";
  } else {
    editNewImage = compressed;
    var editPreview = document.getElementById("edit-item-preview");
    editPreview.src = compressed;
    editPreview.style.display = "block";
  }

  closeCamera(mode);
}

function closeCamera(mode) {
  if (activeCameraStream) {
    var tracks = activeCameraStream.getTracks();
    for (var i = 0; i < tracks.length; i++) {
      tracks[i].stop();
    }
    activeCameraStream = null;
  }

  var box = document.getElementById(mode + "-camera-box");
  if (box) {
    box.classList.remove("open");
  }
}

// Store compressed product image as base64 text
var selectedProductImage = "";
var isImageCompressing = false;

function previewProductImage(event) {
  var file = event.target.files[0];
  var preview = document.getElementById("item-preview");

  if (!file) {
    selectedProductImage = "";
    isImageCompressing = false;
    preview.style.display = "none";
    preview.src = "";
    return;
  }

  isImageCompressing = true;
  compressImageFile(file, function (compressedData) {
    isImageCompressing = false;
    if (!isSafeImageDataUrl(compressedData)) {
      selectedProductImage = "";
      preview.style.display = "none";
      preview.src = "";
      return;
    }
    selectedProductImage = compressedData;
    preview.src = compressedData;
    preview.style.display = "block";
  });
}

// Save product batch via RPC
async function handleAddProduct(event) {
  event.preventDefault();
  clearErrors();

  var itemName = document.getElementById("item-name").value.trim();
  var quantity = document.getElementById("item-quantity").value.trim();
  var expiryDate = document.getElementById("item-expiry").value;
  var itemDesc = document.getElementById("item-description").value.trim();
  var hasError = false;

  if (itemName === "") {
    document.getElementById("item-name-error").innerText = "Enter item name";
    hasError = true;
  }

  if (quantity === "" || Number(quantity) < 1) {
    document.getElementById("item-quantity-error").innerText = "Enter valid quantity";
    hasError = true;
  }

  if (expiryDate === "") {
    document.getElementById("item-expiry-error").innerText = "Select expiry date";
    hasError = true;
  }

  if (hasError) {
    return;
  }

  if (isImageCompressing) {
    document.getElementById("add-main-error").innerText = "Image is still processing";
    var areaWait = document.querySelector(".main-area");
    if (areaWait) areaWait.scrollTop = 0;
    return;
  }

  var token = getSessionCookie();
  if (!token) {
    handleSessionExpired();
    return;
  }

  setButtonLoading("add-product-form", true, "Saving...", "Add Product");

  var client = await connectDatabase();
  if (client === null) {
    setButtonLoading("add-product-form", false, "Saving...", "Add Product");
    document.getElementById("add-main-error").innerText = "Service unavailable";
    var areaDb = document.querySelector(".main-area");
    if (areaDb) areaDb.scrollTop = 0;
    return;
  }

  var safeImage = isSafeImageDataUrl(selectedProductImage) ? selectedProductImage : "";

  var insertRes = await client.rpc("add_batch", {
    p_token: token,
    p_item_name: itemName,
    p_quantity: Number(quantity),
    p_expiry_date: expiryDate,
    p_description: itemDesc,
    p_image_data: safeImage
  });

  setButtonLoading("add-product-form", false, "Saving...", "Add Product");

  var mainArea = document.querySelector(".main-area");
  if (mainArea) mainArea.scrollTop = 0;

  if (insertRes.error) {
    if (insertRes.error.message && insertRes.error.message.indexOf("Session expired") !== -1) {
      handleSessionExpired();
      return;
    }
    document.getElementById("add-main-error").innerText = getSafeErrorMessage(
      insertRes.error,
      "Unable to add product"
    );
    return;
  }

  var keySuffix = token.slice(0, 16);
  removeSessionCache("skit_batches_" + keySuffix);
  removeSessionCache("skit_history_" + keySuffix);

  document.getElementById("add-product-form").reset();
  selectedProductImage = "";
  var preview = document.getElementById("item-preview");
  if (preview) {
    preview.style.display = "none";
    preview.src = "";
  }
  document.getElementById("add-success").innerText = "Product batch added";
}

// Escape HTML for safe display
function escapeHtml(text) {
  var div = document.createElement("div");
  div.innerText = text == null ? "" : String(text);
  return div.innerHTML;
}

// Helper to render product thumbnail safely (raster data URLs only)
function getThumbHtml(imageData) {
  if (isSafeImageDataUrl(imageData)) {
    return "<img src='" + imageData + "' class='item-thumb' alt='Product' />";
  }
  return "<div class='item-thumb'></div>";
}

// Helper to set active filter button
function updateFilterButtons(btn) {
  if (!btn || !btn.parentElement) return;
  var btns = btn.parentElement.getElementsByClassName("filter-btn");
  for (var i = 0; i < btns.length; i++) {
    btns[i].classList.remove("active");
  }
  btn.classList.add("active");
}

// Helper to filter items by search text and stock status
function filterByStockAndSearch(items, searchText, filterType) {
  var result = [];
  for (var i = 0; i < items.length; i++) {
    var item = items[i];
    var matchesSearch = (item.item_name || "").toLowerCase().indexOf(searchText) !== -1;
    var matchesFilter = true;

    if (filterType === "instock") {
      matchesFilter = item.quantity > 0;
    } else if (filterType === "outofstock") {
      matchesFilter = item.quantity <= 0;
    } else if (filterType === "nearexpire") {
      matchesFilter = item.quantity > 0 && isNearExpire(item.expiry_date);
    } else if (filterType === "lowstock") {
      matchesFilter = item.quantity > 0 && item.quantity <= 5;
    }

    if (matchesSearch && matchesFilter) {
      result.push(item);
    }
  }
  return result;
}

// Check if an item expires within 7 days (or already expired)
function isNearExpire(expiryDateStr) {
  if (!expiryDateStr) return false;
  var today = new Date();
  today.setHours(0, 0, 0, 0);

  var expiry = new Date(expiryDateStr + "T00:00:00");
  var diffDays = (expiry - today) / (1000 * 60 * 60 * 24);
  return diffDays <= 7;
}

// ==========================================================================
// Home Dashboard
// ==========================================================================

var allHomeItems = [];
var currentHomeFilter = "all";

function applyHomeDashboardData(items) {
  var totalEl = document.getElementById("home-total-items");
  var nearEl = document.getElementById("home-near-expire");
  if (!totalEl || !nearEl) return;

  allHomeItems = items || [];
  var nearCount = 0;

  for (var i = 0; i < allHomeItems.length; i++) {
    if (allHomeItems[i].quantity > 0 && isNearExpire(allHomeItems[i].expiry_date)) {
      nearCount++;
    }
  }

  totalEl.innerText = allHomeItems.length;
  nearEl.innerText = nearCount;
  filterHomeItems();
}

async function loadHomeDashboard(client, token) {
  var totalEl = document.getElementById("home-total-items");
  var nearEl = document.getElementById("home-near-expire");
  var listEl = document.getElementById("home-items-list");
  if (!totalEl || !nearEl || !listEl) return;

  var cacheKey = "skit_batches_" + token.slice(0, 16);
  var cachedBatches = getSessionCache(cacheKey);
  if (cachedBatches) {
    applyHomeDashboardData(cachedBatches);
  }

  var res = await client.rpc("get_batches", { p_token: token });

  if (res.error) {
    if (res.error.message && res.error.message.indexOf("Session expired") !== -1) {
      handleSessionExpired();
      return;
    }
    if (!cachedBatches) {
      totalEl.innerText = "0";
      nearEl.innerText = "0";
      listEl.innerHTML = "<p class='empty-text'>Error loading items</p>";
    }
    return;
  }

  var data = res.data || [];
  setSessionCache(cacheKey, data);
  applyHomeDashboardData(data);
}

function setHomeFilter(filterType, btn) {
  currentHomeFilter = filterType;
  updateFilterButtons(btn);
  filterHomeItems();
}

function filterHomeItems() {
  var searchEl = document.getElementById("home-search");
  var query = searchEl ? searchEl.value.trim().toLowerCase() : "";
  var filtered = filterByStockAndSearch(allHomeItems, query, currentHomeFilter);
  renderHomeItems(filtered);
}

function renderHomeItems(items) {
  var listEl = document.getElementById("home-items-list");
  if (!listEl) return;

  if (items.length === 0) {
    listEl.innerHTML = "<p class='empty-text'>No matching items found</p>";
    return;
  }

  var html = "";
  for (var j = 0; j < items.length; j++) {
    var item = items[j];
    var itemId = Number(item.id);
    var stockBadge = item.quantity <= 0
      ? "<span class='out-of-stock'>Out of Stock</span>"
      : "<p>Left: <strong>" + Number(item.quantity) + "</strong></p>";

    var expireBadge = isNearExpire(item.expiry_date)
      ? "<span class='near-expire'>Near Expire</span>"
      : "";

    var descText = item.description
      ? "<p class='item-desc'>" + escapeHtml(item.description) + "</p>"
      : "";

    html +=
      "<div class='item-card clickable-card' onclick=\"window.location.href='inventory.html?edit=" + itemId + "'\">" +
        getThumbHtml(item.image_data) +
        "<div class='item-info'>" +
          "<p class='item-name'>" + escapeHtml(item.item_name) + "</p>" +
          stockBadge +
          expireBadge +
          descText +
          "<p>Expiry: " + escapeHtml(item.expiry_date) + "</p>" +
        "</div>" +
      "</div>";
  }

  listEl.innerHTML = html;
}

// ==========================================================================
// Inventory Page
// ==========================================================================

var allInventoryItems = [];
var currentInventoryFilter = "all";
var editNewImage = "";

async function loadInventory(client, token) {
  var listEl = document.getElementById("inventory-list");
  if (!listEl) return;

  var cacheKey = "skit_batches_" + token.slice(0, 16);
  var cachedBatches = getSessionCache(cacheKey);
  if (cachedBatches) {
    allInventoryItems = cachedBatches;
    filterInventory();
  }

  var res = await client.rpc("get_batches", { p_token: token });

  if (res.error) {
    if (res.error.message && res.error.message.indexOf("Session expired") !== -1) {
      handleSessionExpired();
      return;
    }
    if (!cachedBatches) {
      listEl.innerHTML = "<p class='empty-text'>Error loading inventory</p>";
    }
    return;
  }

  allInventoryItems = res.data || [];
  setSessionCache(cacheKey, allInventoryItems);
  filterInventory();

  var params = new URLSearchParams(window.location.search);
  var editId = params.get("edit");
  if (editId) {
    openEditBox(Number(editId));
  }
}

function setInventoryFilter(filterType, btn) {
  currentInventoryFilter = filterType;
  updateFilterButtons(btn);
  filterInventory();
}

function filterInventory() {
  var searchEl = document.getElementById("inventory-search");
  var query = searchEl ? searchEl.value.trim().toLowerCase() : "";
  var filtered = filterByStockAndSearch(allInventoryItems, query, currentInventoryFilter);
  renderInventory(filtered);
}

function renderInventory(items) {
  var listEl = document.getElementById("inventory-list");
  if (!listEl) return;

  if (items.length === 0) {
    listEl.innerHTML = "<p class='empty-text'>No products found</p>";
    return;
  }

  var html = "";
  for (var i = 0; i < items.length; i++) {
    var item = items[i];
    var itemId = Number(item.id);
    var stockBadge = item.quantity <= 0
      ? "<span class='out-of-stock'>Out of Stock</span>"
      : "<p>Left: <strong>" + Number(item.quantity) + "</strong></p>";

    var expireBadge = isNearExpire(item.expiry_date)
      ? "<span class='near-expire'>Near Expire</span>"
      : "";

    var actionButtons = item.quantity <= 0
      ? "<button type='button' class='mini-btn red' onclick='deleteItem(" + itemId + ")'>Delete</button>"
      : "<button type='button' class='sold-btn' onclick='openSoldPopup(" + itemId + ")'>Sold</button>" +
        "<button type='button' class='mini-btn blue' onclick='openEditBox(" + itemId + ")'>Edit</button>";

    var descText = item.description
      ? "<p class='item-desc'>" + escapeHtml(item.description) + "</p>"
      : "";

    html +=
      "<div class='item-card-wrap'>" +
        "<div class='item-card-top'>" +
          getThumbHtml(item.image_data) +
          "<div class='item-info'>" +
            "<p class='item-name'>" + escapeHtml(item.item_name) + "</p>" +
            stockBadge +
            expireBadge +
            descText +
            "<p>Expiry: " + escapeHtml(item.expiry_date) + "</p>" +
          "</div>" +
        "</div>" +
        "<div class='item-actions'>" +
          actionButtons +
        "</div>" +
      "</div>";
  }

  listEl.innerHTML = html;
}

function findInventoryItem(itemId) {
  for (var i = 0; i < allInventoryItems.length; i++) {
    if (allInventoryItems[i].id === itemId) {
      return allInventoryItems[i];
    }
  }
  return null;
}

async function changeQty(itemId, delta) {
  var item = findInventoryItem(itemId);
  if (!item) return;

  var newQty = item.quantity + delta;
  if (newQty < 0) newQty = 0;
  if (newQty === item.quantity) return;

  var token = getSessionCookie();
  var client = await connectDatabase();
  if (!client || !token) return;

  var res = await client.rpc("update_batch_qty", {
    p_token: token,
    p_batch_id: itemId,
    p_delta: delta
  });

  if (res.error) {
    if (res.error.message && res.error.message.indexOf("Session expired") !== -1) {
      handleSessionExpired();
    }
    return;
  }

  var updatedQty = typeof res.data === "number" ? res.data : newQty;
  item.quantity = updatedQty;
  var keySuffix = token.slice(0, 16);
  setSessionCache("skit_batches_" + keySuffix, allInventoryItems);
  removeSessionCache("skit_history_" + keySuffix);
  document.getElementById("inventory-msg").innerText = "Updated " + item.item_name + " (" + updatedQty + " left)";
  filterInventory();
}

async function markAllSold(itemId) {
  var item = findInventoryItem(itemId);
  if (!item || item.quantity <= 0) return;

  var token = getSessionCookie();
  var client = await connectDatabase();
  if (!client || !token) return;

  var res = await client.rpc("update_batch_qty", {
    p_token: token,
    p_batch_id: itemId,
    p_delta: -item.quantity
  });

  if (res.error) {
    if (res.error.message && res.error.message.indexOf("Session expired") !== -1) {
      handleSessionExpired();
    }
    return;
  }

  item.quantity = 0;
  var keySuffix = token.slice(0, 16);
  setSessionCache("skit_batches_" + keySuffix, allInventoryItems);
  removeSessionCache("skit_history_" + keySuffix);
  document.getElementById("inventory-msg").innerText = item.item_name + " marked Out of Stock";
  filterInventory();
}

async function deleteItem(itemId) {
  var token = getSessionCookie();
  var client = await connectDatabase();
  if (!client || !token) return;

  var res = await client.rpc("delete_batch", {
    p_token: token,
    p_batch_id: itemId
  });

  if (res.error) {
    if (res.error.message && res.error.message.indexOf("Session expired") !== -1) {
      handleSessionExpired();
    }
    return;
  }

  allInventoryItems = allInventoryItems.filter(function (it) {
    return it.id !== itemId;
  });
  setSessionCache("skit_batches_" + token.slice(0, 16), allInventoryItems);
  document.getElementById("inventory-msg").innerText = "Item deleted";
  filterInventory();
}

function openEditBox(itemId) {
  var item = findInventoryItem(itemId);
  if (!item) return;

  document.getElementById("edit-item-id").value = item.id;
  document.getElementById("edit-item-name").value = item.item_name;
  document.getElementById("edit-item-qty").value = item.quantity;
  document.getElementById("edit-item-expiry").value = item.expiry_date;
  document.getElementById("edit-item-description").value = item.description || "";
  document.getElementById("edit-item-image").value = "";

  editNewImage = isSafeImageDataUrl(item.image_data) ? item.image_data : "";
  var preview = document.getElementById("edit-item-preview");
  if (editNewImage) {
    preview.src = editNewImage;
    preview.style.display = "block";
  } else {
    preview.style.display = "none";
    preview.src = "";
  }

  document.getElementById("edit-popup").classList.add("open");
}

function closeEditBox() {
  closeCamera("edit");
  document.getElementById("edit-popup").classList.remove("open");
}

function stepEditQty(delta) {
  var qtyInput = document.getElementById("edit-item-qty");
  var val = Number(qtyInput.value) + delta;
  if (isNaN(val) || val < 0) val = 0;
  qtyInput.value = val;
}

async function markAllSoldFromEdit() {
  var itemId = Number(document.getElementById("edit-item-id").value);
  closeEditBox();
  await markAllSold(itemId);
}

async function deleteFromEdit() {
  var itemId = Number(document.getElementById("edit-item-id").value);
  closeEditBox();
  await deleteItem(itemId);
}

function openSoldPopup(itemId) {
  var item = findInventoryItem(itemId);
  if (!item || item.quantity <= 0) return;

  document.getElementById("sold-popup-id").value = item.id;
  document.getElementById("sold-popup-name").innerText = item.item_name + " (" + item.quantity + " left)";
  var qtyInput = document.getElementById("sold-popup-qty");
  qtyInput.value = 1;
  qtyInput.max = item.quantity;

  document.getElementById("sold-popup").classList.add("open");
}

function closeSoldPopup() {
  document.getElementById("sold-popup").classList.remove("open");
}

async function confirmSoldPopup() {
  var itemId = Number(document.getElementById("sold-popup-id").value);
  var item = findInventoryItem(itemId);
  if (!item || item.quantity <= 0) return;

  var soldCount = Number(document.getElementById("sold-popup-qty").value);
  if (isNaN(soldCount) || soldCount < 1) soldCount = 1;
  if (soldCount > item.quantity) soldCount = item.quantity;

  closeSoldPopup();
  await changeQty(itemId, -soldCount);
}

function previewEditImage(event) {
  var file = event.target.files[0];
  var preview = document.getElementById("edit-item-preview");
  if (!file) return;

  compressImageFile(file, function (compressedData) {
    if (!isSafeImageDataUrl(compressedData)) return;
    editNewImage = compressedData;
    preview.src = compressedData;
    preview.style.display = "block";
  });
}

async function saveEditedItem() {
  var itemId = Number(document.getElementById("edit-item-id").value);
  var newName = document.getElementById("edit-item-name").value.trim();
  var newQty = Number(document.getElementById("edit-item-qty").value);
  var newExpiry = document.getElementById("edit-item-expiry").value;
  var newDesc = document.getElementById("edit-item-description").value.trim();

  if (newName === "" || isNaN(newQty) || newQty < 0 || newExpiry === "") {
    return;
  }

  var token = getSessionCookie();
  var client = await connectDatabase();
  if (!client || !token) return;

  var safeImage = isSafeImageDataUrl(editNewImage) ? editNewImage : "";

  var res = await client.rpc("edit_batch", {
    p_token: token,
    p_batch_id: itemId,
    p_item_name: newName,
    p_quantity: newQty,
    p_expiry_date: newExpiry,
    p_description: newDesc,
    p_image_data: safeImage
  });

  if (res.error) {
    if (res.error.message && res.error.message.indexOf("Session expired") !== -1) {
      handleSessionExpired();
    }
    return;
  }

  var oldItem = findInventoryItem(itemId);
  var oldQty = oldItem ? oldItem.quantity : newQty;
  if (oldItem) {
    oldItem.item_name = newName;
    oldItem.quantity = newQty;
    oldItem.expiry_date = newExpiry;
    oldItem.description = newDesc;
    oldItem.image_data = safeImage;
  }

  allInventoryItems.sort(function (a, b) {
    return (a.expiry_date || "").localeCompare(b.expiry_date || "");
  });

  var keySuffix = token.slice(0, 16);
  setSessionCache("skit_batches_" + keySuffix, allInventoryItems);
  if (oldItem && newQty !== oldQty) {
    removeSessionCache("skit_history_" + keySuffix);
  }

  closeEditBox();
  document.getElementById("inventory-msg").innerText = "Item updated";
  filterInventory();
}

// ==========================================================================
// History Page
// ==========================================================================

var allHistoryItems = [];
var currentHistoryFilter = "all";

async function loadHistory(client, token) {
  var listEl = document.getElementById("history-list");
  if (!listEl) return;

  var cacheKey = "skit_history_" + token.slice(0, 16);
  var cachedHistory = getSessionCache(cacheKey);
  if (cachedHistory) {
    allHistoryItems = cachedHistory;
    filterHistory();
  }

  var res = await client.rpc("get_history", { p_token: token, p_limit: 100 });

  if (res.error) {
    if (res.error.message && res.error.message.indexOf("Session expired") !== -1) {
      handleSessionExpired();
      return;
    }
    if (!cachedHistory) {
      listEl.innerHTML = "<p class='empty-text'>Error loading history</p>";
    }
    return;
  }

  allHistoryItems = res.data || [];
  setSessionCache(cacheKey, allHistoryItems);
  filterHistory();
}

function setHistoryFilter(filterType, btn) {
  currentHistoryFilter = filterType;
  updateFilterButtons(btn);
  filterHistory();
}

function filterHistory() {
  var searchEl = document.getElementById("history-search");
  var query = searchEl ? searchEl.value.trim().toLowerCase() : "";
  var filtered = [];

  var todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  var weekAgo = new Date(todayStart.getTime() - 7 * 24 * 60 * 60 * 1000);

  for (var i = 0; i < allHistoryItems.length; i++) {
    var row = allHistoryItems[i];
    var matchesSearch = (row.item_name || "").toLowerCase().indexOf(query) !== -1;
    var matchesFilter = true;

    if (currentHistoryFilter === "added" || currentHistoryFilter === "sold") {
      matchesFilter = row.action_type === currentHistoryFilter;
    } else if (currentHistoryFilter === "today") {
      matchesFilter = row.created_at && new Date(row.created_at) >= todayStart;
    } else if (currentHistoryFilter === "week") {
      matchesFilter = row.created_at && new Date(row.created_at) >= weekAgo;
    }

    if (matchesSearch && matchesFilter) {
      filtered.push(row);
    }
  }

  renderHistory(filtered);
}

function renderHistory(items) {
  var listEl = document.getElementById("history-list");
  if (!listEl) return;

  if (items.length === 0) {
    listEl.innerHTML = "<p class='empty-text'>No history found</p>";
    return;
  }

  var html = "";
  for (var i = 0; i < items.length; i++) {
    var row = items[i];
    var qtyChanged = Number(row.quantity_changed) || 0;
    var badge = row.action_type === "added"
      ? "<span class='badge-added'>Added +" + qtyChanged + "</span>"
      : "<span class='badge-sold'>Sold -" + qtyChanged + "</span>";

    var dateText = row.created_at ? new Date(row.created_at).toLocaleString() : "";

    html +=
      "<div class='item-card'>" +
      getThumbHtml(row.image_data) +
      "<div class='item-info'>" +
      "<p class='item-name'>" + escapeHtml(row.item_name) + "</p>" +
      badge +
      "<p>" + escapeHtml(dateText) + "</p>" +
      "</div>" +
      "</div>";
  }

  listEl.innerHTML = html;
}

// Keep user logged in until they press Logout or session expires
document.addEventListener("DOMContentLoaded", async function () {
  var token = getSessionCookie();
  var path = window.location.pathname;
  var onAppPage =
    path.indexOf("home.html") !== -1 ||
    path.indexOf("add.html") !== -1 ||
    path.indexOf("inventory.html") !== -1 ||
    path.indexOf("history.html") !== -1 ||
    path.indexOf("profile.html") !== -1;

  if (token === "") {
    if (onAppPage) {
      window.location.href = "login.html";
    }
    return;
  }

  if (onAppPage) {
    var cachedUser = getSessionCache("skit_user_" + token.slice(0, 16));
    if (cachedUser) {
      applyUserInfoToUI(cachedUser);
    }
  }

  var client = await connectDatabase();
  if (client === null) {
    return;
  }

  var tasks = [client.rpc("auth_get_session", { p_token: token })];

  if (onAppPage) {
    if (path.indexOf("home.html") !== -1) {
      tasks.push(loadHomeDashboard(client, token));
    }
    if (path.indexOf("inventory.html") !== -1) {
      tasks.push(loadInventory(client, token));
    }
    if (path.indexOf("history.html") !== -1) {
      tasks.push(loadHistory(client, token));
    }
  }

  var results = await Promise.all(tasks);
  var sessionRes = results[0];

  if (!sessionRes.error && !sessionRes.data) {
    handleSessionExpired();
    return;
  }

  if (sessionRes.data) {
    setSessionCache("skit_user_" + token.slice(0, 16), sessionRes.data);
    if (onAppPage) {
      applyUserInfoToUI(sessionRes.data);
    } else {
      window.location.href = isInPagesFolder() ? "home.html" : "pages/home.html";
    }
  }
});
