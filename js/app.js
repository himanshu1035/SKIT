/**
 * SKIT: Smart Kariyana Inventory Technology
 * Main Application Controller, Router & UI Engine
 */

(function (window, document) {
  'use strict';

  // State
  let currentRoute = 'welcome';
  let activeSoldModal = null;
  let activeManualEditModal = null;
  let deferredInstallPrompt = null;
  let cameraStream = null;

  // Selected product in scanner view
  let currentScanProductIndex = 0;
  let currentScanIntakeCount = 1;

  // Notification Toast Helper
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
    }, 2800);
  }

  // -------------------------------------------------------------
  // Router
  // -------------------------------------------------------------
  const routes = ['welcome', 'login', 'signup', 'dashboard', 'scan', 'clearance', 'inventory', 'settings'];

  function navigateTo(route) {
    const clean = route.replace(/^#\/?/, '').toLowerCase() || 'welcome';
    const target = routes.includes(clean) ? clean : 'welcome';
    window.location.hash = '#' + target;
  }

  function handleRoute() {
    const hash = window.location.hash.replace(/^#\/?/, '').toLowerCase();
    const route = routes.includes(hash) ? hash : 'welcome';
    currentRoute = route;

    // Stop camera if leaving scanner
    if (route !== 'scan' && cameraStream) {
      cameraStream.getTracks().forEach((track) => track.stop());
      cameraStream = null;
    }

    // Toggle view containers
    document.querySelectorAll('.app-view').forEach((el) => {
      if (el.dataset.route === route) {
        el.classList.remove('hidden');
      } else {
        el.classList.add('hidden');
      }
    });

    // Toggle navigation visibility (hidden on welcome, login, signup)
    const nav = document.getElementById('app-bottom-nav');
    const header = document.getElementById('app-fixed-header');
    const isAuth = ['welcome', 'login', 'signup'].includes(route);

    if (nav) {
      if (isAuth) {
        nav.classList.add('hidden');
      } else {
        nav.classList.remove('hidden');
        updateNavState(route);
      }
    }

    // Render screen specific logic
    if (route === 'dashboard') {
      renderDashboard();
    } else if (route === 'scan') {
      renderScanner();
    } else if (route === 'clearance') {
      renderClearance();
    } else if (route === 'inventory') {
      renderInventory();
    } else if (route === 'settings') {
      renderSettings();
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
  // Screen: Dashboard
  // -------------------------------------------------------------
  function renderDashboard() {
    const merchant = window.SkitDB.getMerchant();
    const metrics = window.SkitDB.getMetrics();
    const queue = window.SkitDB.getFEFOQueue();

    // Store Info
    const storeTitle = document.getElementById('dash-store-name');
    const storeLoc = document.getElementById('dash-store-loc');
    if (storeTitle) storeTitle.textContent = merchant.store_name || 'Gupta General Store';
    if (storeLoc) storeLoc.textContent = merchant.location || 'Sector 14';

    // Bento Tickers
    const activeSkusEl = document.getElementById('stat-active-skus');
    const fefoCountEl = document.getElementById('stat-fefo-count');
    const moneySavedEl = document.getElementById('stat-money-saved');
    const actionCountEl = document.getElementById('action-items-count');

    if (activeSkusEl) activeSkusEl.textContent = metrics.activeSkus;
    if (fefoCountEl) fefoCountEl.textContent = metrics.fefoCount;
    if (moneySavedEl) moneySavedEl.textContent = '₹' + Number(metrics.moneySaved).toLocaleString('en-IN');
    if (actionCountEl) actionCountEl.textContent = queue.length + ' items';

    // Queue Cards
    const queueContainer = document.getElementById('dashboard-action-queue');
    if (!queueContainer) return;

    if (queue.length === 0) {
      queueContainer.innerHTML = `
        <div class="bg-surface-container-lowest rounded-2xl p-6 text-center shadow-sm">
          <div class="w-14 h-14 rounded-full bg-primary/10 text-primary mx-auto flex items-center justify-center mb-2">
            <span class="material-symbols-outlined text-[32px]">check_circle</span>
          </div>
          <h4 class="font-headline-title text-headline-title text-on-surface">All Batches Fresh</h4>
          <p class="font-body-default text-body-default text-on-surface-variant mt-1">No urgent FEFO expirations in the next 7 days.</p>
        </div>
      `;
      return;
    }

    queueContainer.innerHTML = queue
      .map((item) => {
        const isCritical = item.days_left <= 3;
        const badgeClass =
          item.days_left <= 1
            ? 'bg-error text-on-error shadow-sm'
            : isCritical
            ? 'bg-tertiary-fixed text-on-tertiary-fixed'
            : 'bg-secondary-fixed text-on-secondary-fixed';

        const daysLabel =
          item.days_left === 1
            ? 'Expires Tomorrow'
            : item.days_left === 0
            ? 'Expires Today'
            : `Expires in ${item.days_left} Days`;

        return `
          <div class="bg-surface-container-lowest rounded-xl p-space-md shadow-sm transition-all duration-200" id="card-${item.id}">
            <div class="flex gap-space-md items-start">
              <div class="relative w-16 h-16 rounded-xl overflow-hidden bg-surface-container-low flex-shrink-0">
                <img class="w-full h-full object-cover" src="${item.product_image}" alt="${item.product_name}" onerror="this.src='assets/images/shelf_illustration.png'" />
              </div>
              <div class="flex-1 min-w-0">
                <div class="flex items-start justify-between gap-1">
                  <h4 class="font-body-medium text-body-medium text-on-surface truncate">${item.product_name}</h4>
                  <span class="inline-flex items-center px-2 py-0.5 rounded-full ${badgeClass} font-label-badge text-label-badge whitespace-nowrap">
                    ${daysLabel}
                  </span>
                </div>
                <p class="font-metadata-compact text-metadata-compact text-on-surface-variant mt-0.5">
                  Batch #${item.batch_code} • <span class="font-semibold text-on-surface">${item.quantity_on_hand}</span> ${item.unit}
                </p>
                <!-- Actions -->
                <div class="mt-3 flex items-center gap-2">
                  <button 
                    class="flex-1 h-9 rounded-lg bg-primary-container text-on-primary font-label-badge text-label-badge flex items-center justify-center gap-1 active:scale-95 transition-transform shadow-sm font-medium" 
                    onclick="window.openSoldModal('${item.id}', '${item.product_name.replace(/'/g, "\\'")}', ${item.quantity_on_hand}, '${item.unit}')">
                    <span class="material-symbols-outlined text-[16px]">sell</span>
                    Item Sold
                  </button>
                  <button 
                    class="px-2.5 h-9 rounded-lg bg-surface-container-high text-on-surface font-label-badge text-label-badge flex items-center justify-center gap-1 active:scale-95 transition-transform" 
                    onclick="window.quickApplyDiscount('${item.id}', 20)">
                    <span class="material-symbols-outlined text-[15px] text-primary">percent</span>
                    20% Off
                  </button>
                  <button 
                    aria-label="Return to Vendor" 
                    title="Return to Vendor"
                    class="px-2.5 h-9 rounded-lg bg-error-container text-on-error-container font-label-badge text-label-badge flex items-center justify-center gap-0.5 active:scale-95 transition-transform" 
                    onclick="window.triggerRTV('${item.id}', '${item.product_name.replace(/'/g, "\\'")}')">
                    <span class="material-symbols-outlined text-[15px]">delete_sweep</span>
                    RTV
                  </button>
                </div>
              </div>
            </div>
          </div>
        `;
      })
      .join('');
  }

  // -------------------------------------------------------------
  // Sold Modal Flow
  // -------------------------------------------------------------
  window.openSoldModal = function (batchId, name, maxStock, unit) {
    activeSoldModal = {
      batchId,
      name,
      maxStock,
      unit,
      qty: 1
    };

    const subtitle = document.getElementById('modal-subtitle');
    const qtyVal = document.getElementById('modal-qty-value');
    const remainingPreview = document.getElementById('modal-remaining-preview');

    if (subtitle) subtitle.textContent = `${name} • ${maxStock} ${unit} available`;
    if (qtyVal) qtyVal.textContent = '1';
    if (remainingPreview) remainingPreview.textContent = `Remaining after sale: ${maxStock - 1} ${unit}`;

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

  window.confirmStockDeduction = function () {
    if (!activeSoldModal) return;
    const { batchId, name, qty, unit } = activeSoldModal;

    const result = window.SkitDB.deductBatchStock(batchId, qty, 'sold');
    window.closeSoldModal();

    if (result) {
      showToast(`Stock updated: Sold ${qty} ${unit} of ${name}`);
      renderDashboard();
    }
  };

  window.quickApplyDiscount = function (batchId, pct) {
    const batches = window.SkitDB.getBatches();
    const batch = batches.find((b) => b.id === batchId);
    if (!batch) return;

    const product = window.SkitDB.getProductById(batch.product_id) || {};
    const discountedPrice = Math.round(product.mrp * (1 - pct / 100));

    // Deduct stock as discounted sale
    window.SkitDB.deductBatchStock(batchId, 1, 'discounted', discountedPrice);
    showToast(`${pct}% Off applied to ${product.name}! Sale logged.`);
    renderDashboard();
  };

  window.triggerRTV = function (batchId, name) {
    const batches = window.SkitDB.getBatches();
    const batch = batches.find((b) => b.id === batchId);
    if (!batch) return;

    const qty = batch.quantity_on_hand;
    window.SkitDB.deductBatchStock(batchId, qty, 'removed', 0);
    showToast(`RTV initiated: Returned ${qty} units of ${name} to distributor.`);
    renderDashboard();
  };

  // -------------------------------------------------------------
  // Screen: Live Scanner & Intake (M1)
  // -------------------------------------------------------------
  const SCANNER_PRESETS = [
    {
      barcode: '8901260012345',
      name: 'Amul Butter 500g',
      category: 'Dairy / Spreads',
      mrp: 285.0,
      cost_price: 230.0,
      expiryDateText: '14 Oct 2026',
      calculatedLifeDays: 234,
      batchCode: 'BT-4092',
      confidence: '99.4%',
      fefoTier: 'FEFO Safe • Priority Tier 1',
      image: 'assets/images/amul_butter_500g.png',
      unit: 'units'
    },
    {
      barcode: '8901262010012',
      name: 'Amul Taaza Milk 500ml',
      category: 'Dairy / Fresh Milk',
      mrp: 27.0,
      cost_price: 22.0,
      expiryDateText: '21 Nov 2026',
      calculatedLifeDays: 3,
      batchCode: 'BT-8821',
      confidence: '98.9%',
      fefoTier: 'FEFO Urgent • Priority Tier 3',
      image:
        'https://lh3.googleusercontent.com/aida-public/AB6AXuAn9wUU-e6prC4R6B19O3pnoRSSqQMq-lPTYeMWrZUx39lRiQsddMk7IGYpjWFEPU-VsmuwUhqi31VxWWrfvy2IJdIZXAUjsuCyn1TlaWfmYg2wmj9ghznhb8797e6h5nLR5-FqXvHdkiJVTLVFuVzd0wzC7viBRRWzYYAxYmS95Nrt_89EUWe2ENT2rlYzwPmlK8tJLTkU-a_Q3_ULvjG5mqWzM3xiuPCSwKikSbA',
      unit: 'pouches'
    },
    {
      barcode: '8901063142104',
      name: 'Britannia Brown Bread',
      category: 'Bakery / Bread',
      mrp: 50.0,
      cost_price: 28.0,
      expiryDateText: '20 Nov 2026',
      calculatedLifeDays: 2,
      batchCode: 'BT-8904',
      confidence: '99.1%',
      fefoTier: 'FEFO Urgent • Priority Tier 3',
      image:
        'https://lh3.googleusercontent.com/aida-public/AB6AXuAmsSPfMkd0UUg7g3qacMaDxmrvuxTPGJp1pQv-6BJg4b0e-qLcdFyEU3ycEaLQhhSB9Rm_O5nwVNv_DWWfm_NjWNnDa5NliJTRFdjOphAAt6ni0iPp5PADYUlaqOrfkXI0lZBNmxuJzyvMI_ef6YOG8bL5KjA_xkq8I1Gjb6KYoLTGmkt67Qq37-RHKsEXY7aJzgrHwbAjT3yuJpkicJQgW16YeAGg04ppD3YpJMg',
      unit: 'packs'
    }
  ];

  function renderScanner() {
    const item = SCANNER_PRESETS[currentScanProductIndex];
    currentScanIntakeCount = 1;

    // Viewfinder AR tags
    const arBarcode = document.getElementById('scan-ar-barcode');
    const arExpiry = document.getElementById('scan-ar-expiry');
    if (arBarcode) arBarcode.textContent = `${item.barcode} (100%)`;
    if (arExpiry) arExpiry.textContent = `EXP: ${item.expiryDateText}`;

    // Intake card fields
    const thumb = document.getElementById('scan-product-thumb');
    const nameEl = document.getElementById('scan-product-name');
    const mrpEl = document.getElementById('scan-product-mrp');
    const catEl = document.getElementById('scan-product-category');
    const barcodeEl = document.getElementById('scan-product-barcode');
    const batchCodeEl = document.getElementById('scan-batch-code');
    const expiryEl = document.getElementById('scan-expiry-date');
    const shelfLifeEl = document.getElementById('scan-shelf-life');
    const fefoTierEl = document.getElementById('scan-fefo-tier');
    const countEl = document.getElementById('intake-count');

    if (thumb) thumb.src = item.image;
    if (nameEl) nameEl.textContent = item.name;
    if (mrpEl) mrpEl.textContent = `₹${item.mrp}`;
    if (catEl) catEl.textContent = item.category;
    if (barcodeEl) barcodeEl.textContent = item.barcode;
    if (batchCodeEl) batchCodeEl.textContent = `Batch: #${item.batchCode}`;
    if (expiryEl) expiryEl.textContent = item.expiryDateText;
    if (shelfLifeEl) shelfLifeEl.textContent = `${item.calculatedLifeDays} Days`;
    if (fefoTierEl) fefoTierEl.textContent = item.fefoTier;
    if (countEl) countEl.textContent = currentScanIntakeCount;

    // Optional camera feed initialization
    initCameraFeed();
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
        // Fallback to high quality viewfinder background from design system
        if (fallbackBg) fallbackBg.classList.remove('hidden');
        video.classList.add('hidden');
      }
    }
  }

  window.cycleScanProduct = function () {
    currentScanProductIndex = (currentScanProductIndex + 1) % SCANNER_PRESETS.length;
    renderScanner();
    showToast(`Switched target: ${SCANNER_PRESETS[currentScanProductIndex].name}`);
  };

  window.decrementIntakeCount = function () {
    if (currentScanIntakeCount > 1) {
      currentScanIntakeCount--;
      const countEl = document.getElementById('intake-count');
      if (countEl) countEl.textContent = currentScanIntakeCount;
    }
  };

  window.incrementIntakeCount = function () {
    currentScanIntakeCount++;
    const countEl = document.getElementById('intake-count');
    if (countEl) countEl.textContent = currentScanIntakeCount;
  };

  window.confirmIntake = function () {
    const item = SCANNER_PRESETS[currentScanProductIndex];
    const btn = document.getElementById('btn-confirm-intake');
    if (!btn) return;

    const originalHTML = btn.innerHTML;
    btn.innerHTML = `
      <span class="material-symbols-outlined text-[22px] animate-spin">refresh</span>
      <span>Saving to Shelf...</span>
    `;

    setTimeout(() => {
      // Find or create product in DB
      let product = window.SkitDB.getProductByBarcode(item.barcode);
      if (!product) {
        product = window.SkitDB.addProduct({
          barcode: item.barcode,
          name: item.name,
          category: item.category,
          mrp: item.mrp,
          cost_price: item.cost_price,
          shelf_life_days: item.calculatedLifeDays,
          image_url: item.image,
          unit: item.unit
        });
      }

      // Add batch
      const today = new Date();
      today.setDate(today.getDate() + item.calculatedLifeDays);
      const expiryStr = today.toISOString().split('T')[0];

      window.SkitDB.addBatch({
        product_id: product.id,
        batch_code: item.batchCode,
        expiry_date: expiryStr,
        days_left: item.calculatedLifeDays,
        quantity_on_hand: currentScanIntakeCount
      });

      btn.innerHTML = `
        <span class="material-symbols-outlined text-[22px]">check_circle</span>
        <span>Batch Added (${currentScanIntakeCount} ${item.unit})!</span>
      `;
      btn.classList.remove('bg-primary');
      btn.classList.add('bg-primary-container');

      showToast(`Intake logged: ${currentScanIntakeCount} ${item.unit} of ${item.name}`);

      setTimeout(() => {
        btn.innerHTML = originalHTML;
        btn.classList.remove('bg-primary-container');
        btn.classList.add('bg-primary');
        navigateTo('dashboard');
      }, 1200);
    }, 600);
  };

  // -------------------------------------------------------------
  // Manual Edit Modal for Scanner
  // -------------------------------------------------------------
  window.openManualEditModal = function () {
    const item = SCANNER_PRESETS[currentScanProductIndex];
    const modal = document.getElementById('manual-edit-modal');
    if (!modal) return;

    document.getElementById('manual-name').value = item.name;
    document.getElementById('manual-barcode').value = item.barcode;
    document.getElementById('manual-batch').value = item.batchCode;
    document.getElementById('manual-days').value = item.calculatedLifeDays;
    document.getElementById('manual-qty').value = currentScanIntakeCount;

    modal.classList.remove('hidden');
  };

  window.closeManualEditModal = function () {
    const modal = document.getElementById('manual-edit-modal');
    if (modal) modal.classList.add('hidden');
  };

  window.saveManualEdit = function () {
    const item = SCANNER_PRESETS[currentScanProductIndex];
    item.name = document.getElementById('manual-name').value || item.name;
    item.batchCode = document.getElementById('manual-batch').value || item.batchCode;
    item.calculatedLifeDays = parseInt(document.getElementById('manual-days').value) || item.calculatedLifeDays;
    currentScanIntakeCount = parseInt(document.getElementById('manual-qty').value) || 1;

    window.closeManualEditModal();
    renderScanner();
    showToast('Manual values updated');
  };

  // -------------------------------------------------------------
  // Screen: Clearance & Freshness Markdown Engine (M4)
  // -------------------------------------------------------------
  function renderClearance() {
    const markdowns = window.SkitDB.getMarkdowns();
    const countReadyEl = document.getElementById('clearance-count-ready');
    const profitEl = document.getElementById('clearance-profit-recovered');
    const container = document.getElementById('clearance-cards-container');
    const emptyState = document.getElementById('clearance-all-clear-state');

    const totalProfit = markdowns.reduce((sum, m) => sum + (m.total_profit || 0), 0);
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
          ? 'bg-error-container text-on-error-container'
          : 'bg-secondary-fixed text-on-secondary-fixed';
        const pillIcon = isUrgent ? 'warning' : 'timer';

        return `
          <article class="suggestion-card bg-surface-container-lowest rounded-xl p-space-md shadow-md transition-all duration-300" data-id="${item.id}">
            <div class="flex items-start gap-space-md">
              <div class="w-16 h-16 rounded-xl bg-surface-container overflow-hidden flex-shrink-0 relative">
                <img 
                  alt="${item.product_name}" 
                  class="w-full h-full object-cover" 
                  src="${item.product_image}" 
                  onerror="this.src='assets/images/shelf_illustration.png'" />
                <div class="absolute bottom-0 right-0 bg-on-background/70 text-surface-container-lowest text-[10px] font-bold px-1 rounded-tl-md">
                  x${item.units}
                </div>
              </div>
              <div class="flex-1 min-w-0">
                <div class="flex items-start justify-between gap-space-xs">
                  <h3 class="font-headline-title text-headline-title text-on-surface truncate">${item.product_name}</h3>
                  <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full ${pillBadgeClass} font-label-badge text-label-badge flex-shrink-0">
                    <span class="material-symbols-outlined text-[14px]">${pillIcon}</span>
                    ${item.days_left} days
                  </span>
                </div>
                <p class="font-metadata-compact text-metadata-compact text-outline mt-0.5">
                  Batch #${item.batch_code} • ${item.units} Units in stock
                </p>
                <div class="flex items-center gap-space-sm mt-1 font-metadata-compact text-metadata-compact">
                  <span class="text-on-surface-variant">Cost: ₹${item.cost_price}</span>
                  <span class="text-outline">•</span>
                  <span class="text-outline line-through">MRP: ₹${item.mrp}</span>
                </div>
              </div>
            </div>
            
            <!-- Suggested Price Container -->
            <div class="mt-space-md p-space-sm bg-surface-container-low rounded-lg flex items-center justify-between">
              <div>
                <div class="flex items-center gap-space-xs">
                  <span class="font-headline-metric text-headline-metric text-on-surface">₹${item.suggested_price}</span>
                  <span class="font-label-badge text-label-badge bg-primary/15 text-primary px-1.5 py-0.5 rounded font-bold">${item.discount_pct}% OFF</span>
                </div>
                <span class="font-label-micro text-label-micro text-outline">Was ₹${item.mrp}</span>
              </div>
              <div class="text-right">
                <span class="inline-flex items-center gap-1 font-label-badge text-label-badge text-primary bg-surface-container-lowest px-2 py-1 rounded-full shadow-sm font-semibold">
                  <span class="material-symbols-outlined text-[14px]">format_image_left</span>
                  +₹${item.unit_profit}/unit profit
                </span>
              </div>
            </div>

            <!-- Action Buttons -->
            <div class="mt-space-md grid grid-cols-2 gap-space-sm">
              <button 
                class="h-12 rounded-full bg-surface-container text-on-surface font-body-medium text-body-medium flex items-center justify-center gap-space-xs active:scale-95 transition-all" 
                onclick="window.dismissClearance('${item.id}')" 
                type="button">
                <span class="material-symbols-outlined text-[18px]">close</span>
                Dismiss
              </button>
              <button 
                class="h-12 rounded-full bg-primary-container text-on-primary font-body-medium text-body-medium flex items-center justify-center gap-space-xs shadow-md active:scale-95 transition-all font-semibold" 
                onclick="window.acceptClearance('${item.id}', '${item.product_name.replace(/'/g, "\\'")}', '₹${item.suggested_price}')" 
                type="button">
                <span class="material-symbols-outlined text-[20px]">check</span>
                Accept
              </button>
            </div>
          </article>
        `;
      })
      .join('');
  }

  window.acceptClearance = function (id, name, price) {
    const card = document.querySelector(`[data-id="${id}"]`);
    if (card) {
      card.classList.add('scale-95', 'opacity-0');
      setTimeout(() => {
        window.SkitDB.acceptMarkdown(id);
        showToast(`${name} marked down to ${price} on POS!`);
        renderClearance();
      }, 250);
    }
  };

  window.dismissClearance = function (id) {
    const card = document.querySelector(`[data-id="${id}"]`);
    if (card) {
      card.classList.add('translate-x-full', 'opacity-0');
      setTimeout(() => {
        window.SkitDB.dismissMarkdown(id);
        showToast('Markdown suggestion dismissed', false);
        renderClearance();
      }, 250);
    }
  };

  window.bulkAcceptClearance = function () {
    const cards = document.querySelectorAll('.suggestion-card');
    if (cards.length === 0) return;

    cards.forEach((card, index) => {
      setTimeout(() => {
        card.classList.add('scale-95', 'opacity-0');
      }, index * 80);
    });

    setTimeout(() => {
      const count = window.SkitDB.bulkAcceptAllMarkdowns();
      showToast(`All ${count} markdowns pushed to POS system!`);
      renderClearance();
    }, cards.length * 80 + 200);
  };

  // -------------------------------------------------------------
  // Screen: Full Inventory (Browser & Filter)
  // -------------------------------------------------------------
  let inventoryCategoryFilter = 'all';

  function renderInventory() {
    const products = window.SkitDB.getProducts();
    const batches = window.SkitDB.getBatches();
    const searchInput = document.getElementById('inventory-search');
    const query = (searchInput ? searchInput.value : '').toLowerCase().trim();

    const filtered = products.filter((p) => {
      const matchesCat =
        inventoryCategoryFilter === 'all' ||
        p.category.toLowerCase().includes(inventoryCategoryFilter.toLowerCase());
      const matchesQuery = !query || p.name.toLowerCase().includes(query) || p.barcode.includes(query);
      return matchesCat && matchesQuery;
    });

    const container = document.getElementById('inventory-list-container');
    if (!container) return;

    if (filtered.length === 0) {
      container.innerHTML = `
        <div class="bg-surface-container-lowest rounded-2xl p-6 text-center text-on-surface-variant">
          No matching products found.
        </div>
      `;
      return;
    }

    container.innerHTML = filtered
      .map((p) => {
        const prodBatches = batches.filter((b) => b.product_id === p.id && b.quantity_on_hand > 0);
        const totalStock = prodBatches.reduce((sum, b) => sum + b.quantity_on_hand, 0);
        const nearestExpiry = prodBatches.length > 0 ? Math.min(...prodBatches.map((b) => b.days_left)) : null;

        const expiryBadge =
          nearestExpiry !== null
            ? nearestExpiry <= 3
              ? `<span class="px-2 py-0.5 rounded-full bg-error-container text-on-error-container font-label-badge text-label-badge font-bold">${nearestExpiry}d left</span>`
              : `<span class="px-2 py-0.5 rounded-full bg-primary-fixed/30 text-on-primary-fixed-variant font-label-badge text-label-badge font-bold">${nearestExpiry}d left</span>`
            : `<span class="px-2 py-0.5 rounded-full bg-surface-container-high text-outline font-label-badge text-label-badge">Out of Stock</span>`;

        return `
          <div class="bg-surface-container-lowest rounded-xl p-space-md shadow-sm flex items-center gap-space-md">
            <div class="w-14 h-14 rounded-xl bg-surface-container-low overflow-hidden flex-shrink-0">
              <img src="${p.image_url}" alt="${p.name}" class="w-full h-full object-cover" onerror="this.src='assets/images/shelf_illustration.png'" />
            </div>
            <div class="flex-1 min-w-0">
              <div class="flex items-center justify-between gap-1">
                <h4 class="font-body-medium text-body-medium text-on-surface truncate">${p.name}</h4>
                ${expiryBadge}
              </div>
              <div class="flex items-center gap-2 mt-0.5 font-metadata-compact text-metadata-compact text-on-surface-variant">
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
  // Screen: Settings & Supabase Configuration
  // -------------------------------------------------------------
  function renderSettings() {
    const merchant = window.SkitDB.getMerchant();
    const config = window.SkitDB.getSupabaseConfig();

    const nameInput = document.getElementById('settings-store-name');
    const locInput = document.getElementById('settings-store-loc');
    const phoneInput = document.getElementById('settings-store-phone');
    const urlInput = document.getElementById('settings-supabase-url');
    const keyInput = document.getElementById('settings-supabase-key');
    const statusPill = document.getElementById('settings-supabase-status');

    if (nameInput) nameInput.value = merchant.store_name || '';
    if (locInput) locInput.value = merchant.location || '';
    if (phoneInput) phoneInput.value = merchant.phone || '';
    if (urlInput) urlInput.value = config.url || '';
    if (keyInput) keyInput.value = config.key || '';

    if (statusPill) {
      if (config.url && config.key) {
        statusPill.innerHTML = `
          <span class="w-2 h-2 rounded-full bg-primary animate-pulse"></span>
          <span class="text-primary font-semibold">Configured</span>
        `;
      } else {
        statusPill.innerHTML = `
          <span class="w-2 h-2 rounded-full bg-secondary"></span>
          <span class="text-secondary font-semibold">Offline Local Mode</span>
        `;
      }
    }
  }

  window.saveStoreSettings = function () {
    const store_name = document.getElementById('settings-store-name').value;
    const location = document.getElementById('settings-store-loc').value;
    const phone = document.getElementById('settings-store-phone').value;

    window.SkitDB.saveMerchant({ store_name, location, phone });
    showToast('Store profile saved successfully');
  };

  window.saveSupabaseConfig = async function () {
    const url = document.getElementById('settings-supabase-url').value;
    const key = document.getElementById('settings-supabase-key').value;
    const testBtn = document.getElementById('settings-save-supabase-btn');

    if (testBtn) testBtn.innerHTML = '<span class="material-symbols-outlined text-[18px] animate-spin">refresh</span> Testing...';

    try {
      if (url && key) {
        await window.SkitDB.testSupabaseConnection(url, key);
        window.SkitDB.setSupabaseConfig(url, key);
        showToast('Connected to Supabase live database!');
      } else {
        window.SkitDB.setSupabaseConfig('', '');
        showToast('Switched to Offline Local Storage mode');
      }
    } catch (e) {
      console.warn('Supabase connection warning', e);
      window.SkitDB.setSupabaseConfig(url, key);
      showToast('Config saved (offline fallback active)', false);
    } finally {
      if (testBtn) testBtn.innerHTML = '<span class="material-symbols-outlined text-[18px]">cloud_sync</span> Connect Supabase';
      renderSettings();
    }
  };

  window.resetSampleData = function () {
    if (confirm('Reset all demo inventory and batches to factory defaults?')) {
      window.SkitDB.resetToDefaultData();
      showToast('All sample Kirana data restored');
      renderDashboard();
      renderClearance();
      renderInventory();
    }
  };

  // -------------------------------------------------------------
  // Authentication & Signup
  // -------------------------------------------------------------
  window.handleLogin = function () {
    const phone = document.getElementById('login-phone').value.trim();
    const pin = document.getElementById('login-pin').value.trim();

    if (!phone || phone.length < 10) {
      showToast('Please enter a valid 10-digit mobile number', false);
      return;
    }
    if (!pin || pin.length !== 4) {
      showToast('Please enter your 4-digit PIN', false);
      return;
    }

    // Save session
    window.SkitDB.saveMerchant({ phone });
    showToast('Login successful! Welcome back.');
    navigateTo('dashboard');
  };

  window.handleSignup = function () {
    const phone = document.getElementById('signup-phone').value.trim();
    const otp = document.getElementById('signup-otp').value.trim();
    const pin = document.getElementById('signup-pin').value.trim();
    const storeName = document.getElementById('signup-store-name').value.trim() || 'Gupta General Store';
    const storeLoc = document.getElementById('signup-store-loc').value.trim() || 'Sector 14, Urban Estate';

    if (!phone || phone.length < 10) {
      showToast('Please enter a valid 10-digit mobile number', false);
      return;
    }
    if (!otp) {
      showToast('Please enter OTP (use 123456 for demo)', false);
      return;
    }
    if (!pin || pin.length !== 4) {
      showToast('Please set a 4-digit security PIN', false);
      return;
    }

    window.SkitDB.saveMerchant({
      phone,
      pin,
      store_name: storeName,
      location: storeLoc
    });

    showToast('Merchant registered successfully!');
    navigateTo('dashboard');
  };

  window.quickFillDemoLogin = function () {
    const phoneInput = document.getElementById('login-phone');
    const pinInput = document.getElementById('login-pin');
    if (phoneInput) phoneInput.value = '9876543210';
    if (pinInput) pinInput.value = '1234';
    showToast('Demo credentials filled');
  };

  window.requestDemoOTP = function () {
    const otpInput = document.getElementById('signup-otp');
    if (otpInput) {
      otpInput.value = '123456';
      showToast('Demo OTP auto-filled: 123456');
    }
  };

  window.togglePinVisibility = function (inputId) {
    const input = document.getElementById(inputId);
    if (!input) return;
    input.type = input.type === 'password' ? 'text' : 'password';
  };

  // -------------------------------------------------------------
  // Event Listeners & Bootstrapping
  // -------------------------------------------------------------
  window.addEventListener('hashchange', handleRoute);

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredInstallPrompt = e;
    const installBanner = document.getElementById('pwa-install-banner');
    if (installBanner) installBanner.classList.remove('hidden');
  });

  window.installPWA = function () {
    if (deferredInstallPrompt) {
      deferredInstallPrompt.prompt();
      deferredInstallPrompt.userChoice.then(() => {
        deferredInstallPrompt = null;
      });
    } else {
      showToast('To install: Tap browser menu and select "Add to Home Screen"');
    }
  };

  // Register Service Worker for offline PWA
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker
        .register('/sw.js')
        .then((reg) => console.log('[SKIT PWA] Service Worker registered:', reg.scope))
        .catch((err) => console.warn('[SKIT PWA] Service Worker registration failed:', err));
    });
  }

  // Initial load
  document.addEventListener('DOMContentLoaded', () => {
    // If no hash, default to #welcome
    if (!window.location.hash) {
      window.location.hash = '#welcome';
    }
    handleRoute();

    // Setup inventory search live listener
    const invSearch = document.getElementById('inventory-search');
    if (invSearch) {
      invSearch.addEventListener('input', renderInventory);
    }
  });
})(window, document);
