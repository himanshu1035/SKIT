/**
 * SKIT: Smart Kariyana Inventory Technology
 * Production Application Controller & Route Orchestrator
 */

(function (window, document) {
  'use strict';

  // State
  let currentRoute = 'welcome';
  let activeSoldModal = null;
  let cameraStream = null;
  let deferredInstallPrompt = null;

  // Scanner Live Form State
  let scannerState = {
    barcode: '8901260012345',
    name: 'Packaged Grocery Item',
    category: 'Daily Staples',
    mrp: 50,
    cost_price: 40,
    expiryDate: getFutureDate(30),
    daysLeft: 30,
    batchCode: 'BT-' + Math.floor(1000 + Math.random() * 9000),
    quantity: 1
  };

  function getFutureDate(days) {
    const d = new Date();
    d.setDate(d.getDate() + days);
    return d.toISOString().split('T')[0];
  }

  function formatDateHuman(isoDate) {
    if (!isoDate) return 'No Date';
    const d = new Date(isoDate);
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  // -------------------------------------------------------------
  // Toast Notification System
  // -------------------------------------------------------------
  function showToast(message, isSuccess = true, icon = null) {
    const toast = document.getElementById('app-toast');
    if (!toast) return;

    const msgEl = document.getElementById('app-toast-msg');
    const iconEl = document.getElementById('app-toast-icon');

    if (msgEl) msgEl.textContent = message;
    if (iconEl) {
      iconEl.textContent = icon || (isSuccess ? 'check_circle' : 'info');
      iconEl.className = isSuccess
        ? 'material-symbols-outlined text-primary-fixed text-[22px]'
        : 'material-symbols-outlined text-tertiary-container text-[22px]';
    }

    toast.classList.remove('opacity-0', '-translate-y-28', 'pointer-events-none');
    toast.classList.add('opacity-100', 'translate-y-0');

    if (window._toastTimer) clearTimeout(window._toastTimer);
    window._toastTimer = setTimeout(() => {
      toast.classList.add('opacity-0', '-translate-y-28', 'pointer-events-none');
      toast.classList.remove('opacity-100', 'translate-y-0');
    }, 3000);
  }
  window.showToast = showToast;

  // -------------------------------------------------------------
  // Client Router
  // -------------------------------------------------------------
  const routes = ['welcome', 'login', 'signup', 'dashboard', 'scan', 'clearance', 'inventory', 'settings'];

  function navigateTo(route) {
    const clean = route.replace(/^#\/?/, '').toLowerCase() || 'welcome';
    window.location.hash = '#' + clean;
  }
  window.navigateTo = navigateTo;

  async function handleRoute() {
    const hash = window.location.hash.replace(/^#\/?/, '').toLowerCase();
    const route = routes.includes(hash) ? hash : 'welcome';
    currentRoute = route;

    // Check Authentication Guard
    const merchant = window.SkitDB.getMerchant();
    const isAuthRoute = ['welcome', 'login', 'signup'].includes(route);

    if (!merchant && !isAuthRoute) {
      navigateTo('welcome');
      return;
    }
    if (merchant && isAuthRoute) {
      navigateTo('dashboard');
      return;
    }

    // Stop camera feed if navigating away from scanner
    if (route !== 'scan' && cameraStream) {
      cameraStream.getTracks().forEach((track) => track.stop());
      cameraStream = null;
    }

    // Toggle View DOM Elements
    document.querySelectorAll('.app-view').forEach((el) => {
      if (el.dataset.route === route) {
        el.classList.remove('hidden');
      } else {
        el.classList.add('hidden');
      }
    });

    // Toggle Bottom Navigation Visibility
    const nav = document.getElementById('app-bottom-nav');
    if (nav) {
      if (isAuthRoute) {
        nav.classList.add('hidden');
      } else {
        nav.classList.remove('hidden');
        updateNavState(route);
      }
    }

    // Render screen
    if (route === 'dashboard') {
      await renderDashboard();
    } else if (route === 'scan') {
      await renderScanner();
    } else if (route === 'clearance') {
      await renderClearance();
    } else if (route === 'inventory') {
      await renderInventory();
    } else if (route === 'settings') {
      await renderSettings();
    }

    window.scrollTo(0, 0);
  }

  function updateNavState(route) {
    document.querySelectorAll('#app-bottom-nav [data-path]').forEach((link) => {
      const path = link.getAttribute('data-path');
      const iconWrap = link.querySelector('div');
      const label = link.querySelector('span:last-child');
      const icon = link.querySelector('.material-symbols-outlined');

      if (path === route || (path === 'dashboard' && route === '')) {
        link.classList.add('text-primary');
        link.classList.remove('text-on-surface-variant');
        if (iconWrap && path !== 'scan') iconWrap.classList.add('bg-primary-container/25');
        if (icon && path !== 'scan') icon.classList.add('text-primary');
        if (label && path !== 'scan') label.classList.add('font-semibold', 'text-primary');
      } else {
        link.classList.remove('text-primary');
        link.classList.add('text-on-surface-variant');
        if (iconWrap && path !== 'scan') iconWrap.classList.remove('bg-primary-container/25');
        if (icon && path !== 'scan') icon.classList.remove('text-primary');
        if (label && path !== 'scan') label.classList.remove('font-semibold', 'text-primary');
      }
    });
  }

  // -------------------------------------------------------------
  // Screen: Store Dashboard & Real-Time FEFO Queue
  // -------------------------------------------------------------
  async function renderDashboard() {
    const merchant = window.SkitDB.getMerchant();
    if (!merchant) return;

    // Display Authenticated Store Context
    const storeTitle = document.getElementById('dash-store-name');
    const storeLoc = document.getElementById('dash-store-loc');
    if (storeTitle) storeTitle.textContent = merchant.store_name || 'My Kirana Store';
    if (storeLoc) storeLoc.textContent = merchant.location || 'Local Market';

    // Show loading state for metrics
    const metrics = await window.SkitDB.getMetrics();
    const batches = await window.SkitDB.getBatches();

    // Bento Tickers
    const activeSkusEl = document.getElementById('stat-active-skus');
    const fefoCountEl = document.getElementById('stat-fefo-count');
    const moneySavedEl = document.getElementById('stat-money-saved');
    const actionCountEl = document.getElementById('action-items-count');

    if (activeSkusEl) activeSkusEl.textContent = metrics.activeSkus;
    if (fefoCountEl) fefoCountEl.textContent = metrics.fefoCount;
    if (moneySavedEl) moneySavedEl.textContent = '₹' + Number(metrics.moneySaved).toLocaleString('en-IN');

    // Filter batches needing priority action (<= 7 days)
    const priorityQueue = batches.filter((b) => b.days_left <= 7);
    const sectionTitleEl = document.getElementById('dash-section-title');
    if (sectionTitleEl) {
      sectionTitleEl.textContent = priorityQueue.length > 0 ? 'Action Required' : 'Stock Inventory';
    }
    if (actionCountEl) {
      actionCountEl.textContent = priorityQueue.length > 0 
        ? priorityQueue.length + ' urgent' 
        : batches.length + ' active items';
      actionCountEl.className = priorityQueue.length > 0 
        ? 'text-xs font-semibold text-error' 
        : 'text-xs font-semibold text-primary';
    }

    const queueContainer = document.getElementById('dashboard-action-queue');
    if (!queueContainer) return;

    // Empty State when new store has 0 batches
    if (batches.length === 0) {
      queueContainer.innerHTML = `
        <div class="bg-surface-container-lowest rounded-2xl p-6 text-center shadow-sm flex flex-col items-center">
          <div class="w-12 h-12 rounded-full bg-primary/10 text-primary mx-auto flex items-center justify-center mb-2">
            <span class="material-symbols-outlined text-[28px]">inventory_2</span>
          </div>
          <h4 class="font-bold text-sm text-on-surface">No Items In Stock</h4>
          <p class="text-xs text-on-surface-variant mt-1">Tap below to scan and track your first grocery item.</p>
          <button onclick="location.hash='#scan'" class="mt-3 px-4 py-2 bg-primary text-on-primary rounded-xl text-xs font-semibold flex items-center gap-1 active:scale-95 transition shadow-sm">
            <span class="material-symbols-outlined text-[16px]">qr_code_scanner</span>
            Scan Stock Intake
          </button>
        </div>
      `;
      return;
    }

    // Reassurance banner when all items have > 7 days freshness
    let bannerHTML = '';
    if (priorityQueue.length === 0) {
      bannerHTML = `
        <div class="bg-primary/10 border border-primary/20 rounded-xl px-3 py-2 flex items-center justify-between mb-1">
          <div class="flex items-center gap-2">
            <span class="material-symbols-outlined text-primary text-[18px]">verified</span>
            <span class="text-xs font-semibold text-primary">All stock fresh & safe</span>
          </div>
          <span class="text-[11px] text-on-surface-variant font-medium">${batches.length} active</span>
        </div>
      `;
    }

    // Render ALL active batches in FEFO order (earliest expiry first)
    const cardsHTML = batches
      .map((item) => {
        const badgeClass =
          item.days_left <= 1
            ? 'bg-error text-on-error font-bold'
            : item.days_left <= 3
            ? 'bg-tertiary-fixed text-on-tertiary-fixed font-bold'
            : item.days_left <= 7
            ? 'bg-secondary-fixed text-on-secondary-fixed font-semibold'
            : 'bg-primary-fixed/25 text-primary font-semibold';

        const daysLabel =
          item.days_left === 1
            ? 'Tomorrow'
            : item.days_left === 0
            ? 'Today'
            : item.days_left <= 7
            ? `${item.days_left}d left`
            : `Fresh • ${item.days_left}d`;

        return `
          <div class="bg-surface-container-lowest rounded-xl p-3 shadow-sm border border-outline-variant/20" id="card-${item.id}">
            <div class="flex gap-3 items-center">
              <div class="w-14 h-14 rounded-xl overflow-hidden bg-surface-container-low shrink-0 flex items-center justify-center">
                <img class="w-full h-full object-cover" src="${item.product_image || 'assets/images/shelf_illustration.png'}" alt="${item.product_name}" onerror="this.src='assets/images/shelf_illustration.png'" />
              </div>
              <div class="flex-1 min-w-0">
                <div class="flex items-center justify-between gap-1">
                  <h4 class="text-sm font-semibold text-on-surface truncate">${item.product_name}</h4>
                  <span class="px-2 py-0.5 rounded-full ${badgeClass} text-[10px] whitespace-nowrap">
                    ${daysLabel}
                  </span>
                </div>
                <div class="flex items-center justify-between mt-1">
                  <span class="text-xs text-on-surface-variant">
                    Batch #${item.batch_code} • <strong class="text-on-surface">${item.quantity_on_hand}</strong> ${item.unit}
                  </span>
                  <span class="text-xs font-bold text-primary">₹${item.mrp}</span>
                </div>
              </div>
            </div>
            <div class="mt-2.5">
              <button 
                class="w-full h-9 rounded-lg bg-primary text-on-primary text-xs font-semibold flex items-center justify-center gap-1.5 active:scale-98 transition shadow-sm" 
                onclick="window.openSoldModal('${item.id}', '${item.product_name.replace(/'/g, "\\'")}', ${item.quantity_on_hand}, '${item.unit}', ${item.mrp})">
                <span class="material-symbols-outlined text-[16px]">sell</span>
                Record Sale
              </button>
            </div>
          </div>
        `;
      })
      .join('');

    queueContainer.innerHTML = bannerHTML + cardsHTML;
  }

  // -------------------------------------------------------------
  // Live Item Deduction Modal
  // -------------------------------------------------------------
  window.openSoldModal = function (batchId, name, maxStock, unit, mrp) {
    activeSoldModal = {
      batchId,
      name,
      maxStock: Number(maxStock),
      unit: unit || 'units',
      mrp: Number(mrp) || 0,
      qty: 1
    };

    const subtitle = document.getElementById('modal-subtitle');
    const qtyVal = document.getElementById('modal-qty-value');
    const remainingPreview = document.getElementById('modal-remaining-preview');

    if (subtitle) subtitle.textContent = `${name} • ${maxStock} ${activeSoldModal.unit} available`;
    if (qtyVal) qtyVal.textContent = '1';
    if (remainingPreview) remainingPreview.textContent = `Remaining after sale: ${maxStock - 1} ${activeSoldModal.unit}`;

    const backdrop = document.getElementById('sold-modal-backdrop');
    const sheet = document.getElementById('sold-modal-sheet');
    if (backdrop && sheet) {
      backdrop.classList.remove('hidden');
      setTimeout(() => {
        sheet.classList.remove('translate-y-full');
      }, 10);
    }
  };

  window.closeSoldModal = function () {
    const sheet = document.getElementById('sold-modal-sheet');
    const backdrop = document.getElementById('sold-modal-backdrop');
    if (sheet && backdrop) {
      sheet.classList.add('translate-y-full');
      setTimeout(() => {
        backdrop.classList.add('hidden');
        activeSoldModal = null;
      }, 300);
    }
  };

  window.adjustQty = function (delta) {
    if (!activeSoldModal) return;
    const newQty = activeSoldModal.qty + delta;
    if (newQty >= 1 && newQty <= activeSoldModal.maxStock) {
      activeSoldModal.qty = newQty;
      updateSoldModalDisplay();
    }
  };

  window.setQty = function (val) {
    if (!activeSoldModal) return;
    if (val === 'all') {
      activeSoldModal.qty = activeSoldModal.maxStock;
    } else {
      activeSoldModal.qty = Math.min(Number(val), activeSoldModal.maxStock);
    }
    updateSoldModalDisplay();
  };

  function updateSoldModalDisplay() {
    if (!activeSoldModal) return;
    const qtyVal = document.getElementById('modal-qty-value');
    const remainingPreview = document.getElementById('modal-remaining-preview');
    if (qtyVal) qtyVal.textContent = activeSoldModal.qty;
    if (remainingPreview) {
      const rem = activeSoldModal.maxStock - activeSoldModal.qty;
      remainingPreview.textContent = `Remaining after sale: ${rem} ${activeSoldModal.unit}`;
    }
  }

  window.confirmStockDeduction = async function () {
    if (!activeSoldModal) return;
    const { batchId, name, qty, unit, mrp } = activeSoldModal;

    try {
      await window.SkitDB.deductBatchStock(batchId, qty, 'sold', mrp);
      window.closeSoldModal();
      showToast(`Logged sale: ${qty} ${unit} of ${name}`);
      await renderDashboard();
    } catch (e) {
      showToast('Error recording sale: ' + e.message, false);
    }
  };

  window.quickApplyDiscount = async function (batchId, pct) {
    try {
      await window.SkitDB.deductBatchStock(batchId, 1, 'discounted');
      showToast(`${pct}% Off sale logged!`);
      await renderDashboard();
    } catch (e) {
      showToast('Error applying discount', false);
    }
  };

  window.triggerRTV = async function (batchId, name, qty) {
    if (confirm(`Return all ${qty} units of ${name} to vendor?`)) {
      try {
        await window.SkitDB.deductBatchStock(batchId, qty, 'removed', 0);
        showToast(`RTV confirmed: Removed ${qty} units from inventory.`);
        await renderDashboard();
      } catch (e) {
        showToast('Error recording RTV', false);
      }
    }
  };

  // -------------------------------------------------------------
  // Screen: Live Scanner & Intake (M1)
  // -------------------------------------------------------------
  async function renderScanner() {
    const products = await window.SkitDB.getProducts();

    // Populate default scanner state if merchant already has products
    if (products.length > 0) {
      const p = products[0];
      scannerState.barcode = p.barcode;
      scannerState.name = p.name;
      scannerState.category = p.category;
      scannerState.mrp = p.mrp;
      scannerState.cost_price = p.cost_price;
    }

    updateScannerDisplay();
    initCameraFeed();
  }

  function updateScannerDisplay() {
    const arBarcode = document.getElementById('scan-ar-barcode');
    const arExpiry = document.getElementById('scan-ar-expiry');
    if (arBarcode) arBarcode.textContent = `${scannerState.barcode} (100%)`;
    if (arExpiry) arExpiry.textContent = `EXP: ${formatDateHuman(scannerState.expiryDate)}`;

    const nameEl = document.getElementById('scan-product-name');
    const mrpEl = document.getElementById('scan-product-mrp');
    const catEl = document.getElementById('scan-product-category');
    const barcodeEl = document.getElementById('scan-product-barcode');
    const batchCodeEl = document.getElementById('scan-batch-code');
    const expiryEl = document.getElementById('scan-expiry-date');
    const shelfLifeEl = document.getElementById('scan-shelf-life');
    const countEl = document.getElementById('intake-count');

    if (nameEl) nameEl.textContent = scannerState.name;
    if (mrpEl) mrpEl.textContent = `₹${scannerState.mrp}`;
    if (catEl) catEl.textContent = scannerState.category;
    if (barcodeEl) barcodeEl.textContent = scannerState.barcode;
    if (batchCodeEl) batchCodeEl.textContent = `Batch: #${scannerState.batchCode}`;
    if (expiryEl) expiryEl.textContent = formatDateHuman(scannerState.expiryDate);
    if (shelfLifeEl) shelfLifeEl.textContent = `${scannerState.daysLeft} Days`;
    if (countEl) countEl.textContent = scannerState.quantity;
  }

  async function initCameraFeed() {
    const video = document.getElementById('scanner-video');
    const fallbackBg = document.getElementById('scanner-fallback-bg');
    if (!video) return;

    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' }
        });
        cameraStream = stream;
        video.srcObject = stream;
        video.play();
        video.classList.remove('hidden');
        if (fallbackBg) fallbackBg.classList.add('hidden');
      } catch (err) {
        if (fallbackBg) fallbackBg.classList.remove('hidden');
        video.classList.add('hidden');
      }
    }
  }

  window.decrementIntakeCount = function () {
    if (scannerState.quantity > 1) {
      scannerState.quantity--;
      const countEl = document.getElementById('intake-count');
      if (countEl) countEl.textContent = scannerState.quantity;
    }
  };

  window.incrementIntakeCount = function () {
    scannerState.quantity++;
    const countEl = document.getElementById('intake-count');
    if (countEl) countEl.textContent = scannerState.quantity;
  };

  window.confirmIntake = async function () {
    const btn = document.getElementById('btn-confirm-intake');
    if (!btn) return;

    const originalHTML = btn.innerHTML;
    btn.innerHTML = `<span class="material-symbols-outlined text-[20px] animate-spin">refresh</span><span>Saving Stock...</span>`;

    try {
      // 1. Check if product exists in live database
      let product = await window.SkitDB.getProductByBarcode(scannerState.barcode);
      if (!product) {
        product = await window.SkitDB.addProduct({
          barcode: scannerState.barcode,
          name: scannerState.name,
          category: scannerState.category,
          mrp: scannerState.mrp,
          cost_price: scannerState.cost_price,
          shelf_life_days: scannerState.daysLeft,
          unit: 'units'
        });
      }

      // 2. Add batch under merchant store ID
      await window.SkitDB.addBatch({
        product_id: product.id,
        product_name: product.name,
        product_category: product.category,
        product_image: product.image_url,
        mrp: product.mrp,
        cost_price: product.cost_price,
        unit: product.unit || 'units',
        batch_code: scannerState.batchCode,
        expiry_date: scannerState.expiryDate,
        quantity_on_hand: scannerState.quantity
      });

      btn.innerHTML = `<span class="material-symbols-outlined text-[20px]">check_circle</span><span>Batch Added!</span>`;
      btn.classList.remove('bg-primary');
      btn.classList.add('bg-primary-container');

      showToast(`Added ${scannerState.quantity} units of ${scannerState.name} to shelf!`);

      // Rotate batch code for next intake
      scannerState.batchCode = 'BT-' + Math.floor(1000 + Math.random() * 9000);

      setTimeout(() => {
        btn.innerHTML = originalHTML;
        btn.classList.remove('bg-primary-container');
        btn.classList.add('bg-primary');
        navigateTo('dashboard');
      }, 700);
    } catch (e) {
      console.error('[confirmIntake error]', e);
      btn.innerHTML = originalHTML;
      showToast('Error adding batch: ' + (e.message || 'Check database'), false);
    }
  };

  window.openManualEditModal = function () {
    const modal = document.getElementById('manual-edit-modal');
    if (!modal) return;

    document.getElementById('manual-name').value = scannerState.name;
    document.getElementById('manual-barcode').value = scannerState.barcode;
    document.getElementById('manual-batch').value = scannerState.batchCode;
    document.getElementById('manual-mrp').value = scannerState.mrp;
    document.getElementById('manual-cost').value = scannerState.cost_price;
    document.getElementById('manual-expiry').value = scannerState.expiryDate;
    document.getElementById('manual-qty').value = scannerState.quantity;

    modal.classList.remove('hidden');
  };

  window.closeManualEditModal = function () {
    const modal = document.getElementById('manual-edit-modal');
    if (modal) modal.classList.add('hidden');
  };

  window.saveManualEdit = function () {
    scannerState.name = document.getElementById('manual-name').value.trim() || scannerState.name;
    scannerState.barcode = document.getElementById('manual-barcode').value.trim() || scannerState.barcode;
    scannerState.batchCode = document.getElementById('manual-batch').value.trim() || scannerState.batchCode;
    scannerState.mrp = Number(document.getElementById('manual-mrp').value) || scannerState.mrp;
    scannerState.cost_price = Number(document.getElementById('manual-cost').value) || scannerState.cost_price;
    scannerState.expiryDate = document.getElementById('manual-expiry').value || scannerState.expiryDate;
    scannerState.quantity = Number(document.getElementById('manual-qty').value) || 1;

    // Recalculate days left
    const days = Math.ceil((new Date(scannerState.expiryDate) - new Date()) / (1000 * 60 * 60 * 24));
    scannerState.daysLeft = Math.max(0, days);

    window.closeManualEditModal();
    updateScannerDisplay();
    showToast('Intake details updated');
  };

  // -------------------------------------------------------------
  // Screen: Clearance & Freshness Markdown Engine (M4)
  // -------------------------------------------------------------
  async function renderClearance() {
    const markdowns = await window.SkitDB.getMarkdowns();
    const countReadyEl = document.getElementById('clearance-count-ready');
    const profitEl = document.getElementById('clearance-profit-recovered');
    const container = document.getElementById('clearance-cards-container');
    const emptyState = document.getElementById('clearance-all-clear-state');

    const totalProfit = markdowns.reduce((sum, m) => sum + m.total_profit, 0);
    if (countReadyEl) countReadyEl.textContent = markdowns.length;
    if (profitEl) profitEl.textContent = '₹' + totalProfit;

    if (!container) return;

    if (markdowns.length === 0) {
      container.innerHTML = '';
      if (emptyState) emptyState.classList.remove('hidden');
      return;
    }

    if (emptyState) emptyState.classList.add('hidden');

    container.innerHTML = markdowns
      .map((item) => {
        const isUrgent = item.days_left <= 2;
        const pillBadgeClass = isUrgent
          ? 'bg-error-container text-on-error-container font-bold'
          : 'bg-secondary-fixed text-on-secondary-fixed font-semibold';
        const pillIcon = isUrgent ? 'warning' : 'timer';

        return `
          <article class="suggestion-card bg-surface-container-lowest rounded-xl p-3 shadow-sm border border-outline-variant/20 transition-all duration-300" data-id="${item.id}">
            <div class="flex items-center gap-3">
              <div class="w-14 h-14 rounded-xl bg-surface-container overflow-hidden shrink-0 relative flex items-center justify-center">
                <img alt="${item.product_name}" class="w-full h-full object-cover" src="${item.product_image || 'assets/images/shelf_illustration.png'}" onerror="this.src='assets/images/shelf_illustration.png'" />
                <div class="absolute bottom-0 right-0 bg-on-background/70 text-surface-container-lowest text-[9px] font-bold px-1 rounded-tl">
                  ${item.units}x
                </div>
              </div>
              <div class="flex-1 min-w-0">
                <div class="flex items-center justify-between gap-1">
                  <h3 class="text-sm font-semibold text-on-surface truncate">${item.product_name}</h3>
                  <span class="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full ${pillBadgeClass} text-[10px] shrink-0">
                    <span class="material-symbols-outlined text-[12px]">${pillIcon}</span>
                    ${item.days_left}d left
                  </span>
                </div>
                <div class="flex items-center gap-2 mt-1">
                  <span class="text-base font-bold text-on-surface">₹${item.suggested_price}</span>
                  <span class="text-[10px] bg-primary/15 text-primary px-1.5 py-0.5 rounded font-bold">${item.discount_pct}% OFF</span>
                  <span class="text-xs text-outline line-through">₹${item.mrp}</span>
                </div>
              </div>
            </div>

            <!-- Action -->
            <div class="mt-2.5 flex items-center gap-2">
              <button 
                class="flex-1 h-9 rounded-lg bg-primary text-on-primary text-xs font-semibold flex items-center justify-center gap-1 active:scale-98 transition shadow-sm" 
                onclick="window.acceptClearance('${item.id}', '${item.batch_id}', ${item.units}, ${item.suggested_price}, '${item.product_name.replace(/'/g, "\\'")}')" 
                type="button">
                <span class="material-symbols-outlined text-[16px]">check</span>
                Accept ₹${item.suggested_price}
              </button>
              <button 
                class="w-9 h-9 rounded-lg bg-surface-container text-on-surface flex items-center justify-center active:scale-95 transition" 
                onclick="window.dismissClearance('${item.id}')" 
                title="Dismiss"
                type="button">
                <span class="material-symbols-outlined text-[16px]">close</span>
              </button>
            </div>
          </article>
        `;
        `;
      })
      .join('');
  }

  window.acceptClearance = async function (cardId, batchId, units, price, name) {
    const card = document.querySelector(`[data-id="${cardId}"]`);
    if (card) card.classList.add('scale-95', 'opacity-0');

    try {
      await window.SkitDB.deductBatchStock(batchId, units, 'discounted', price);
      showToast(`${name} marked down to ₹${price} on POS!`);
      setTimeout(async () => {
        await renderClearance();
      }, 250);
    } catch (e) {
      showToast('Error accepting clearance', false);
    }
  };

  window.dismissClearance = function (cardId) {
    const card = document.querySelector(`[data-id="${cardId}"]`);
    if (card) {
      card.classList.add('translate-x-full', 'opacity-0');
      setTimeout(() => {
        card.remove();
        showToast('Clearance recommendation dismissed', false);
      }, 250);
    }
  };

  window.bulkAcceptClearance = async function () {
    const markdowns = await window.SkitDB.getMarkdowns();
    if (markdowns.length === 0) return;

    for (const m of markdowns) {
      await window.SkitDB.deductBatchStock(m.batch_id, m.units, 'discounted', m.suggested_price);
    }

    showToast(`All ${markdowns.length} markdowns pushed to POS system!`);
    await renderClearance();
  };

  // -------------------------------------------------------------
  // Screen: Inventory Catalog
  // -------------------------------------------------------------
  let inventoryCategoryFilter = 'all';

  async function renderInventory() {
    const products = await window.SkitDB.getProducts();
    const batches = await window.SkitDB.getBatches();
    const searchInput = document.getElementById('inventory-search');
    const query = (searchInput ? searchInput.value : '').toLowerCase().trim();

    // Reconstruct product records from batches if products list is empty
    let allProducts = products;
    if (allProducts.length === 0 && batches.length > 0) {
      const seenIds = new Set();
      allProducts = batches
        .filter((b) => {
          if (seenIds.has(String(b.product_id))) return false;
          seenIds.add(String(b.product_id));
          return true;
        })
        .map((b) => ({
          id: b.product_id,
          name: b.product_name || 'Item',
          category: b.product_category || 'General',
          mrp: b.mrp || 0,
          cost_price: b.cost_price || 0,
          unit: b.unit || 'units',
          image_url: b.product_image,
          barcode: b.batch_code || ''
        }));
    }

    const filtered = allProducts.filter((p) => {
      const pCat = (p.category || '').toLowerCase();
      const matchesCat =
        inventoryCategoryFilter === 'all' ||
        pCat.includes(inventoryCategoryFilter.toLowerCase()) ||
        (inventoryCategoryFilter === 'daily' && pCat.includes('staple'));
      const matchesQuery = !query || (p.name && p.name.toLowerCase().includes(query)) || (p.barcode && String(p.barcode).includes(query));
      return matchesCat && matchesQuery;
    });

    const container = document.getElementById('inventory-list-container');
    if (!container) return;

    if (filtered.length === 0) {
      container.innerHTML = `
        <div class="bg-surface-container-lowest rounded-2xl p-8 text-center text-on-surface-variant flex flex-col items-center">
          <span class="material-symbols-outlined text-[36px] text-outline mb-2">search_off</span>
          <p class="font-body-medium text-body-medium font-semibold text-on-surface">No Products Found</p>
          <p class="text-xs text-on-surface-variant mt-1">Tap the Scan button to add stock.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = filtered
      .map((p) => {
        const prodBatches = batches.filter((b) => String(b.product_id) === String(p.id) && b.quantity_on_hand > 0);
        const totalStock = prodBatches.reduce((sum, b) => sum + b.quantity_on_hand, 0);
        const nearestExpiry = prodBatches.length > 0 ? Math.min(...prodBatches.map((b) => b.days_left)) : null;

        const expiryBadge =
          nearestExpiry !== null
            ? nearestExpiry <= 3
              ? `<span class="px-2 py-0.5 rounded-full bg-error-container text-on-error-container text-[10px] font-bold">${nearestExpiry}d left</span>`
              : nearestExpiry <= 7
              ? `<span class="px-2 py-0.5 rounded-full bg-secondary-fixed text-on-secondary-fixed text-[10px] font-bold">${nearestExpiry}d left</span>`
              : `<span class="px-2 py-0.5 rounded-full bg-primary-fixed/25 text-primary text-[10px] font-bold">Fresh • ${nearestExpiry}d</span>`
            : `<span class="px-2 py-0.5 rounded-full bg-surface-container-high text-outline text-[10px]">Out of Stock</span>`;

        return `
          <div class="bg-surface-container-lowest rounded-xl p-3 shadow-sm border border-outline-variant/20 flex items-center gap-3">
            <div class="w-14 h-14 rounded-xl bg-surface-container-low overflow-hidden shrink-0 flex items-center justify-center">
              <img src="${p.image_url || 'assets/images/shelf_illustration.png'}" alt="${p.name}" class="w-full h-full object-cover" onerror="this.src='assets/images/shelf_illustration.png'" />
            </div>
            <div class="flex-1 min-w-0">
              <div class="flex items-center justify-between gap-1">
                <h4 class="text-sm font-semibold text-on-surface truncate">${p.name}</h4>
                ${expiryBadge}
              </div>
              <div class="flex items-center gap-2 mt-0.5 text-xs text-on-surface-variant">
                <span>Stock: <strong class="text-on-surface font-semibold">${totalStock}</strong> ${p.unit}</span>
                <span>•</span>
                <span>MRP: ₹${p.mrp}</span>
                <span>•</span>
                <span>Cost: ₹${p.cost_price}</span>
              </div>
              <div class="flex items-center gap-1 mt-1 text-on-surface-variant font-mono text-[11px]">
                <span class="material-symbols-outlined text-[13px] text-outline">barcode</span>
                <span>${p.barcode}</span>
              </div>
            </div>
          </div>
        `;
      })
      .join('');
  }

  window.filterInventoryCategory = function (cat) {
    inventoryCategoryFilter = cat;
    document.querySelectorAll('.cat-filter-btn').forEach((btn) => {
      if (btn.dataset.category === cat) {
        btn.classList.add('bg-primary', 'text-on-primary');
        btn.classList.remove('bg-surface-container', 'text-on-surface');
      } else {
        btn.classList.remove('bg-primary', 'text-on-primary');
        btn.classList.add('bg-surface-container', 'text-on-surface');
      }
    });
    renderInventory();
  };

  // -------------------------------------------------------------
  // Screen: Settings & Store Profile (NO Credentials Form)
  // -------------------------------------------------------------
  async function renderSettings() {
    const merchant = window.SkitDB.getMerchant();
    if (!merchant) return;

    const nameInput = document.getElementById('settings-store-name');
    const locInput = document.getElementById('settings-store-loc');
    const phoneEl = document.getElementById('settings-merchant-phone');
    const statusPill = document.getElementById('settings-supabase-status');

    if (nameInput) nameInput.value = merchant.store_name || '';
    if (locInput) locInput.value = merchant.location || '';
    if (phoneEl) phoneEl.textContent = '+91 ' + merchant.phone;

    if (statusPill) {
      if (window.SkitDB.supabase) {
        statusPill.innerHTML = `
          <span class="w-2 h-2 rounded-full bg-primary animate-pulse"></span>
          <span class="text-primary font-semibold">Supabase Cloud Connected</span>
        `;
      } else {
        statusPill.innerHTML = `
          <span class="w-2 h-2 rounded-full bg-secondary"></span>
          <span class="text-secondary font-semibold">Offline PWA Storage Active</span>
        `;
      }
    }
  }

  window.saveStoreSettings = async function () {
    const store_name = document.getElementById('settings-store-name').value.trim();
    const location = document.getElementById('settings-store-loc').value.trim();

    try {
      await window.SkitDB.updateMerchantProfile({ store_name, location });
      showToast('Store profile updated successfully');
    } catch (e) {
      showToast('Error updating store profile', false);
    }
  };

  window.handleLogout = function () {
    if (confirm('Are you sure you want to log out of your store?')) {
      window.SkitDB.logout();
      showToast('Logged out successfully');
      navigateTo('welcome');
    }
  };

  // -------------------------------------------------------------
  // Authentication & Registration Handlers (One-Time 1111 OTP)
  // -------------------------------------------------------------
  window.handleLogin = async function () {
    const phone = document.getElementById('login-phone').value.trim();
    const pin = document.getElementById('login-pin').value.trim();
    const btn = document.getElementById('btn-login-submit');

    if (btn) btn.innerHTML = '<span class="material-symbols-outlined text-[18px] animate-spin">refresh</span> Logging in...';

    try {
      await window.SkitDB.loginMerchantWithPin(phone, pin);
      showToast('Login successful! Welcome back.');
      navigateTo('dashboard');
    } catch (e) {
      showToast(e.message || 'Login failed', false);
    } finally {
      if (btn) btn.innerHTML = '<span>Log In</span><span class="material-symbols-outlined text-[18px]">arrow_forward</span>';
    }
  };

  window.handleSignup = async function () {
    const phone = document.getElementById('signup-phone').value.trim();
    const otp = document.getElementById('signup-otp').value.trim();
    const pin = document.getElementById('signup-pin').value.trim();
    const storeName = document.getElementById('signup-store-name').value.trim();
    const storeLoc = document.getElementById('signup-store-loc').value.trim();
    const btn = document.getElementById('btn-signup-submit');

    if (!storeName) {
      showToast('Please enter your Store Name', false);
      return;
    }
    if (!storeLoc) {
      showToast('Please enter your Store Location', false);
      return;
    }

    if (btn) btn.innerHTML = '<span class="material-symbols-outlined text-[18px] animate-spin">refresh</span> Verifying OTP & Registering...';

    try {
      // One-time 1111 OTP bypass verification & save to Supabase merchants table
      await window.SkitDB.registerMerchantWithOTP(phone, otp, pin, storeName, storeLoc);
      showToast('Store registered and verified successfully!');
      navigateTo('dashboard');
    } catch (e) {
      showToast(e.message || 'Registration failed', false);
    } finally {
      if (btn) btn.innerHTML = '<span>Verify &amp; Register</span><span class="material-symbols-outlined text-[18px]">arrow_forward</span>';
    }
  };

  window.requestLaunchOTP = function () {
    const otpInput = document.getElementById('signup-otp');
    if (otpInput) {
      otpInput.value = '1111';
      showToast('Launch test OTP filled: 1111');
    }
  };

  window.togglePinVisibility = function (inputId) {
    const input = document.getElementById(inputId);
    if (!input) return;
    input.type = input.type === 'password' ? 'text' : 'password';
  };

  // -------------------------------------------------------------
  // PWA Support & Lifecycles
  // -------------------------------------------------------------
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredInstallPrompt = e;
    const banner = document.getElementById('pwa-install-banner');
    if (banner) banner.classList.remove('hidden');
  });

  window.installPWA = function () {
    if (deferredInstallPrompt) {
      deferredInstallPrompt.prompt();
      deferredInstallPrompt.userChoice.then(() => {
        deferredInstallPrompt = null;
      });
    } else {
      showToast('To install: Tap your browser menu and choose "Add to Home screen"');
    }
  };

  // Register Service Worker
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker
        .register('/sw.js')
        .then((reg) => console.log('[SKIT PWA] Service Worker registered:', reg.scope))
        .catch((err) => console.warn('[SKIT PWA] Service Worker registration error:', err));
    });
  }

  // Hash Navigation Handler
  window.addEventListener('hashchange', handleRoute);

  document.addEventListener('DOMContentLoaded', () => {
    if (!window.location.hash) {
      window.location.hash = '#welcome';
    }
    handleRoute();

    const invSearch = document.getElementById('inventory-search');
    if (invSearch) {
      invSearch.addEventListener('input', renderInventory);
    }
  });
})(window, document);
