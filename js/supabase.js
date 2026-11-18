/**
 * SKIT: Smart Kariyana Inventory Technology
 * Supabase Client & Offline-First Repository Layer
 */

(function (window) {
  'use strict';

  const STORAGE_KEY_PREFIX = 'skit_';
  const CONFIG_KEY = 'skit_supabase_config';

  // Margin Guard minimum safety threshold: Cost + 5%
  const MARGIN_GUARD_FACTOR = 1.05;

  const DEFAULT_MERCHANT = {
    id: '00000000-0000-0000-0000-000000000001',
    phone: '9876543210',
    pin: '1234',
    store_name: 'Gupta General Store',
    location: 'Sector 14, Urban Estate',
    currency: 'INR'
  };

  const DEFAULT_PRODUCTS = [
    {
      id: 'prod-1',
      barcode: '8901260012345',
      name: 'Amul Butter 500g',
      category: 'Dairy / Spreads',
      mrp: 285.0,
      cost_price: 230.0,
      shelf_life_days: 180,
      image_url: 'assets/images/amul_butter_500g.png',
      unit: 'units'
    },
    {
      id: 'prod-2',
      barcode: '8901262010012',
      name: 'Amul Taaza Milk 500ml',
      category: 'Dairy / Fresh Milk',
      mrp: 27.0,
      cost_price: 22.0,
      shelf_life_days: 4,
      image_url:
        'https://lh3.googleusercontent.com/aida-public/AB6AXuAn9wUU-e6prC4R6B19O3pnoRSSqQMq-lPTYeMWrZUx39lRiQsddMk7IGYpjWFEPU-VsmuwUhqi31VxWWrfvy2IJdIZXAUjsuCyn1TlaWfmYg2wmj9ghznhb8797e6h5nLR5-FqXvHdkiJVTLVFuVzd0wzC7viBRRWzYYAxYmS95Nrt_89EUWe2ENT2rlYzwPmlK8tJLTkU-a_Q3_ULvjG5mqWzM3xiuPCSwKikSbA',
      unit: 'pouches'
    },
    {
      id: 'prod-3',
      barcode: '8901063142104',
      name: 'Britannia Brown Bread',
      category: 'Bakery / Bread',
      mrp: 50.0,
      cost_price: 28.0,
      shelf_life_days: 6,
      image_url:
        'https://lh3.googleusercontent.com/aida-public/AB6AXuAmsSPfMkd0UUg7g3qacMaDxmrvuxTPGJp1pQv-6BJg4b0e-qLcdFyEU3ycEaLQhhSB9Rm_O5nwVNv_DWWfm_NjWNnDa5NliJTRFdjOphAAt6ni0iPp5PADYUlaqOrfkXI0lZBNmxuJzyvMI_ef6YOG8bL5KjA_xkq8I1Gjb6KYoLTGmkt67Qq37-RHKsEXY7aJzgrHwbAjT3yuJpkicJQgW16YeAGg04ppD3YpJMg',
      unit: 'packs'
    },
    {
      id: 'prod-4',
      barcode: '8901030773010',
      name: 'Mother Dairy Dahi 400g',
      category: 'Dairy / Yogurt',
      mrp: 35.0,
      cost_price: 26.0,
      shelf_life_days: 10,
      image_url:
        'https://lh3.googleusercontent.com/aida-public/AB6AXuCxxJ3soEYmoJeGOEjPBcgIYUBKEYbX51uIC6vVG-a_ma9om4vrja43Za4jW-sRjj31R1SPpfgvcl7vl_GPRCIV1inFtofCsiReaDd3nKyOBeGkK0bfsQdc3_bh1kidfAl4xKeqQOkqLMmMVrnOzuU3HVghRpUo1VPiiFVib-XkSMiJcWK-qA6116GBfvZeQZjeeRFoMqyMFKtdIgOorT3UAJjv_PUJheidh-mvtSA',
      unit: 'units'
    },
    {
      id: 'prod-5',
      barcode: '8904018300215',
      name: 'Fresh Malai Paneer 200g',
      category: 'Dairy / Fresh',
      mrp: 95.0,
      cost_price: 72.0,
      shelf_life_days: 5,
      image_url:
        'https://lh3.googleusercontent.com/aida-public/AB6AXuBbXrmFf07AoObIpuJV9T8gQYRY1jyhHY8ilVi127f6JmIZkWKwJDMGd4VGmJvHYIhXv_o8vqYCnPB0OJOsAswqv1aaN54FgZO-xFWw4x1FPbLjrUJuI9y8_rQBA1_8wOyPTAfjqrhgWJTBTJe3-4hSmderl-doQ2Dp1CAyiM14ScMuqKwsQaQGaE0VgqAaikxzbQwNFj_hAGU7F1cOuLuOZsvRTrwvld6dQJjPOzA',
      unit: 'blocks'
    },
    {
      id: 'prod-6',
      barcode: '8901058852204',
      name: 'Nestle Milk Pack 1L',
      category: 'Dairy / Tetra Pak',
      mrp: 60.0,
      cost_price: 42.0,
      shelf_life_days: 90,
      image_url:
        'https://lh3.googleusercontent.com/aida-public/AB6AXuDdce9kFVmXPWA24hQuDbwBrcPD0-Xw_nSnen1iNqJ9TajgLnwwiQ5wgFiRz6dPEEHKJypCYyEziQzpNnKQxAdCoFOK20cujGatg4LJEGq4_qqqKEpGBXG07Xzo2xCECBp3xUk31TH-_VKzIudAds_uVUx_HaVqo4Oh-D34cMh6uT-wHnGLPJix_z3JA1f6VGSXdNayvaBAthF6uSd6cd5Fp4cJfQitnhlRF6jR01A',
      unit: 'units'
    },
    {
      id: 'prod-7',
      barcode: '8906073120019',
      name: 'Epigamia Greek Yogurt',
      category: 'Dairy / Gourmet',
      mrp: 60.0,
      cost_price: 35.0,
      shelf_life_days: 15,
      image_url:
        'https://lh3.googleusercontent.com/aida-public/AB6AXuD1iI15DrdxKXE43A8cMJY6RWOH-YtGXUzPWZG6KXvHwk2AoY9yhrnIjSMjt06ufmSl2lVjmjmuZUIzrFhepH4ZgDBdOzGRX8L_9MOIfw_wOlvDsKH89hvt4rJt8yeMl1Z6puWYmivtoS3c1O2tlWRF3beVbBoWECvcxbp8Y88hN2PzeAENZOyPWbJrlUVyFiCcKNqd8gF2bNyM0laCwpAT4HdTbzf4t7Iv4m9Nblk',
      unit: 'units'
    }
  ];

  function getDaysFromNow(days) {
    const d = new Date();
    d.setDate(d.getDate() + days);
    return d.toISOString().split('T')[0];
  }

  const DEFAULT_BATCHES = [
    {
      id: 'batch-1',
      product_id: 'prod-2',
      batch_code: 'BT-8821',
      expiry_date: getDaysFromNow(3),
      days_left: 3,
      quantity_on_hand: 8,
      status: 'critical'
    },
    {
      id: 'batch-2',
      product_id: 'prod-3',
      batch_code: 'BT-8904',
      expiry_date: getDaysFromNow(2),
      days_left: 2,
      quantity_on_hand: 5,
      status: 'critical'
    },
    {
      id: 'batch-3',
      product_id: 'prod-4',
      batch_code: 'BT-9042',
      expiry_date: getDaysFromNow(7),
      days_left: 7,
      quantity_on_hand: 14,
      status: 'warning'
    },
    {
      id: 'batch-4',
      product_id: 'prod-5',
      batch_code: 'BT-9118',
      expiry_date: getDaysFromNow(1),
      days_left: 1,
      quantity_on_hand: 4,
      status: 'critical'
    },
    {
      id: 'batch-5',
      product_id: 'prod-1',
      batch_code: 'BT-4092',
      expiry_date: getDaysFromNow(3),
      days_left: 3,
      quantity_on_hand: 12,
      status: 'warning'
    },
    {
      id: 'batch-6',
      product_id: 'prod-6',
      batch_code: 'NM-104',
      expiry_date: getDaysFromNow(5),
      days_left: 5,
      quantity_on_hand: 18,
      status: 'warning'
    },
    {
      id: 'batch-7',
      product_id: 'prod-7',
      batch_code: 'EG-550',
      expiry_date: getDaysFromNow(4),
      days_left: 4,
      quantity_on_hand: 15,
      status: 'warning'
    }
  ];

  const DEFAULT_MARKDOWNS = [
    {
      id: 'md-1',
      batch_id: 'batch-5',
      product_name: 'Amul Butter 500g',
      product_image: 'assets/images/amul_butter_500g.png',
      batch_code: 'BT-4092',
      units: 12,
      cost_price: 230.0,
      mrp: 285.0,
      days_left: 3,
      discount_pct: 15,
      suggested_price: 242.0,
      unit_profit: 12.0,
      total_profit: 144.0,
      status: 'pending'
    },
    {
      id: 'md-2',
      batch_id: 'batch-6',
      product_name: 'Nestle Milk Pack 1L',
      product_image:
        'https://lh3.googleusercontent.com/aida-public/AB6AXuDdce9kFVmXPWA24hQuDbwBrcPD0-Xw_nSnen1iNqJ9TajgLnwwiQ5wgFiRz6dPEEHKJypCYyEziQzpNnKQxAdCoFOK20cujGatg4LJEGq4_qqqKEpGBXG07Xzo2xCECBp3xUk31TH-_VKzIudAds_uVUx_HaVqo4Oh-D34cMh6uT-wHnGLPJix_z3JA1f6VGSXdNayvaBAthF6uSd6cd5Fp4cJfQitnhlRF6jR01A',
      batch_code: 'NM-104',
      units: 18,
      cost_price: 42.0,
      mrp: 60.0,
      days_left: 5,
      discount_pct: 20,
      suggested_price: 48.0,
      unit_profit: 6.0,
      total_profit: 108.0,
      status: 'pending'
    },
    {
      id: 'md-3',
      batch_id: 'batch-2',
      product_name: 'Britannia 100% Bread',
      product_image:
        'https://lh3.googleusercontent.com/aida-public/AB6AXuDipvpXPxCxdWLJ3eWAKE7gDXg3YaOTr3wjksnThtJL5OZc7CDf6U-IRW6otEIpYaWzN3KU4B-kUaHR1DTytGFn5auZYy3D2KbCkXWfiGPNlhx5BPH-ZwuZzhBNGvCVZkg-zEqDTj4byKp9HGN7VqeDH1U_337e4OqOE0tUMh1CD0zr-8iuk6uAFhcMSYbztTpbVAiDsDtSzfcV-GgHRfF_IAmdcmjWNa23xQzMOUk',
      batch_code: 'BR-882',
      units: 8,
      cost_price: 28.0,
      mrp: 50.0,
      days_left: 2,
      discount_pct: 30,
      suggested_price: 35.0,
      unit_profit: 7.0,
      total_profit: 56.0,
      status: 'pending'
    },
    {
      id: 'md-4',
      batch_id: 'batch-7',
      product_name: 'Epigamia Greek Yogurt',
      product_image:
        'https://lh3.googleusercontent.com/aida-public/AB6AXuD1iI15DrdxKXE43A8cMJY6RWOH-YtGXUzPWZG6KXvHwk2AoY9yhrnIjSMjt06ufmSl2lVjmjmuZUIzrFhepH4ZgDBdOzGRX8L_9MOIfw_wOlvDsKH89hvt4rJt8yeMl1Z6puWYmivtoS3c1O2tlWRF3beVbBoWECvcxbp8Y88hN2PzeAENZOyPWbJrlUVyFiCcKNqd8gF2bNyM0laCwpAT4HdTbzf4t7Iv4m9Nblk',
      batch_code: 'EG-550',
      units: 15,
      cost_price: 35.0,
      mrp: 60.0,
      days_left: 4,
      discount_pct: 25,
      suggested_price: 45.0,
      unit_profit: 10.0,
      total_profit: 150.0,
      status: 'pending'
    }
  ];

  class SkitDatabase {
    constructor() {
      this.listeners = [];
      this.supabaseClient = null;
      this.isOnline = navigator.onLine;
      this.init();
    }

    init() {
      // Setup online/offline listeners
      window.addEventListener('online', () => {
        this.isOnline = true;
        this.notify('network_online');
      });
      window.addEventListener('offline', () => {
        this.isOnline = false;
        this.notify('network_offline');
      });

      // Initialize storage defaults if empty
      if (!this._get('products')) {
        this._set('products', DEFAULT_PRODUCTS);
      }
      if (!this._get('batches')) {
        this._set('batches', DEFAULT_BATCHES);
      }
      if (!this._get('markdowns')) {
        this._set('markdowns', DEFAULT_MARKDOWNS);
      }
      if (!this._get('sales')) {
        this._set('sales', []);
      }
      if (!this._get('merchant')) {
        this._set('merchant', DEFAULT_MERCHANT);
      }
      if (!this._get('stats')) {
        this._set('stats', {
          baseActiveSkus: 420,
          moneySaved: 2450
        });
      }

      this.initSupabaseClient();
    }

    initSupabaseClient() {
      const config = this.getSupabaseConfig();
      if (config.url && config.key && window.supabase) {
        try {
          this.supabaseClient = window.supabase.createClient(config.url, config.key);
          console.log('[SKIT] Supabase live client connected:', config.url);
        } catch (e) {
          console.warn('[SKIT] Supabase client init failed:', e);
          this.supabaseClient = null;
        }
      }
    }

    getSupabaseConfig() {
      try {
        const raw = localStorage.getItem(CONFIG_KEY);
        return raw ? JSON.parse(raw) : { url: '', key: '' };
      } catch (e) {
        return { url: '', key: '' };
      }
    }

    setSupabaseConfig(url, key) {
      localStorage.setItem(CONFIG_KEY, JSON.stringify({ url: url.trim(), key: key.trim() }));
      this.initSupabaseClient();
      this.notify('config_changed');
    }

    async testSupabaseConnection(url, key) {
      if (!window.supabase) {
        throw new Error('Supabase client library not loaded yet');
      }
      const testClient = window.supabase.createClient(url.trim(), key.trim());
      const { data, error } = await testClient.from('products').select('count', { count: 'exact', head: true });
      if (error) {
        throw error;
      }
      return true;
    }

    _get(key) {
      try {
        const item = localStorage.getItem(STORAGE_KEY_PREFIX + key);
        return item ? JSON.parse(item) : null;
      } catch (e) {
        return null;
      }
    }

    _set(key, val) {
      try {
        localStorage.setItem(STORAGE_KEY_PREFIX + key, JSON.stringify(val));
      } catch (e) {
        console.error('Storage quota exceeded or error', e);
      }
    }

    subscribe(fn) {
      this.listeners.push(fn);
      return () => {
        this.listeners = this.listeners.filter((l) => l !== fn);
      };
    }

    notify(event, payload) {
      this.listeners.forEach((fn) => {
        try {
          fn(event, payload);
        } catch (e) {
          console.error('Listener error', e);
        }
      });
    }

    // -------------------------------------------------------------
    // Merchant Profile
    // -------------------------------------------------------------
    getMerchant() {
      return this._get('merchant') || DEFAULT_MERCHANT;
    }

    saveMerchant(data) {
      const current = this.getMerchant();
      const updated = { ...current, ...data };
      this._set('merchant', updated);
      this.notify('merchant_updated', updated);

      if (this.supabaseClient) {
        this.supabaseClient.from('merchants').upsert({
          id: updated.id,
          phone: updated.phone,
          pin_hash: updated.pin,
          store_name: updated.store_name,
          location: updated.location
        }).then(({ error }) => {
          if (error) console.warn('[Supabase Sync] Merchant update error:', error);
        });
      }
      return updated;
    }

    // -------------------------------------------------------------
    // Products
    // -------------------------------------------------------------
    getProducts() {
      return this._get('products') || [];
    }

    getProductById(id) {
      return this.getProducts().find((p) => p.id === id);
    }

    getProductByBarcode(barcode) {
      const clean = String(barcode).trim();
      return this.getProducts().find((p) => p.barcode === clean);
    }

    addProduct(prod) {
      const products = this.getProducts();
      const existing = products.find((p) => p.barcode === prod.barcode);
      if (existing) {
        Object.assign(existing, prod);
        this._set('products', products);
        this.notify('product_updated', existing);
        return existing;
      }
      const newProd = {
        id: prod.id || 'prod-' + Date.now(),
        barcode: prod.barcode,
        name: prod.name,
        category: prod.category || 'General',
        mrp: Number(prod.mrp) || 0,
        cost_price: Number(prod.cost_price) || 0,
        shelf_life_days: Number(prod.shelf_life_days) || 30,
        image_url: prod.image_url || 'assets/images/shelf_illustration.png',
        unit: prod.unit || 'units'
      };
      products.push(newProd);
      this._set('products', products);
      this.notify('product_added', newProd);

      if (this.supabaseClient) {
        this.supabaseClient.from('products').insert([newProd]).then(({ error }) => {
          if (error) console.warn('[Supabase Sync] Product insert error:', error);
        });
      }
      return newProd;
    }

    // -------------------------------------------------------------
    // Batches & FEFO Queue
    // -------------------------------------------------------------
    getBatches() {
      return this._get('batches') || [];
    }

    getFEFOQueue() {
      const batches = this.getBatches().filter((b) => b.quantity_on_hand > 0);
      const products = this.getProducts();
      const prodMap = new Map(products.map((p) => [p.id, p]));

      return batches
        .map((b) => {
          const product = prodMap.get(b.product_id) || {};
          return {
            ...b,
            product_name: product.name || 'Unknown Product',
            product_category: product.category || 'General',
            product_image: product.image_url || 'assets/images/shelf_illustration.png',
            mrp: product.mrp || 0,
            cost_price: product.cost_price || 0,
            unit: product.unit || 'units'
          };
        })
        .sort((a, b) => a.days_left - b.days_left);
    }

    addBatch(batchData) {
      const batches = this.getBatches();
      const id = batchData.id || 'batch-' + Date.now();
      const newBatch = {
        id,
        product_id: batchData.product_id,
        batch_code: batchData.batch_code || 'BT-' + Math.floor(1000 + Math.random() * 9000),
        expiry_date: batchData.expiry_date,
        days_left: batchData.days_left !== undefined ? batchData.days_left : 180,
        quantity_on_hand: Number(batchData.quantity_on_hand) || 1,
        status: batchData.days_left <= 3 ? 'critical' : batchData.days_left <= 7 ? 'warning' : 'healthy'
      };

      batches.push(newBatch);
      this._set('batches', batches);

      // Also generate a dynamic markdown suggestion if days_left <= 7
      if (newBatch.days_left <= 7) {
        this.generateMarkdownSuggestion(newBatch);
      }

      this.notify('batch_added', newBatch);

      if (this.supabaseClient) {
        this.supabaseClient.from('batches').insert([{
          id: newBatch.id,
          product_id: newBatch.product_id,
          batch_code: newBatch.batch_code,
          expiry_date: newBatch.expiry_date,
          quantity_on_hand: newBatch.quantity_on_hand
        }]).then(({ error }) => {
          if (error) console.warn('[Supabase Sync] Batch insert error:', error);
        });
      }

      return newBatch;
    }

    deductBatchStock(batchId, qty, type = 'sold', customSellingPrice = null) {
      const batches = this.getBatches();
      const batch = batches.find((b) => b.id === batchId);
      if (!batch) return null;

      const qtyDeducted = Math.min(qty, batch.quantity_on_hand);
      batch.quantity_on_hand -= qtyDeducted;
      this._set('batches', batches);

      const product = this.getProductById(batch.product_id) || {};
      const sellingPrice = customSellingPrice !== null ? customSellingPrice : (product.mrp || 0);

      // Record Sales adjustment
      const sales = this._get('sales') || [];
      const adjustment = {
        id: 'sale-' + Date.now(),
        batch_id: batchId,
        product_id: batch.product_id,
        product_name: product.name,
        quantity: qtyDeducted,
        type, // 'sold', 'discounted', 'removed'
        selling_price: sellingPrice,
        created_at: new Date().toISOString()
      };
      sales.push(adjustment);
      this._set('sales', sales);

      // Update Money Saved metric if FEFO rotated
      if (type === 'sold' || type === 'discounted') {
        const stats = this._get('stats') || { baseActiveSkus: 420, moneySaved: 2450 };
        const savedIncrement = Math.round(sellingPrice * qtyDeducted * 0.15); // Saved margin from avoidance of total spoilage
        stats.moneySaved += savedIncrement;
        this._set('stats', stats);
      }

      this.notify('stock_deducted', { batch, adjustment });

      if (this.supabaseClient) {
        this.supabaseClient.from('batches').update({
          quantity_on_hand: batch.quantity_on_hand
        }).eq('id', batchId).then(({ error }) => {
          if (error) console.warn('[Supabase Sync] Batch stock update error:', error);
        });

        this.supabaseClient.from('sales_adjustments').insert([{
          batch_id: batchId,
          quantity: qtyDeducted,
          type,
          selling_price: sellingPrice
        }]).then(({ error }) => {
          if (error) console.warn('[Supabase Sync] Sales adjustment insert error:', error);
        });
      }

      return { batch, adjustment };
    }

    // -------------------------------------------------------------
    // Markdown Engine (Margin Guard)
    // -------------------------------------------------------------
    getMarkdowns() {
      return (this._get('markdowns') || []).filter((m) => m.status === 'pending');
    }

    generateMarkdownSuggestion(batch) {
      const product = this.getProductById(batch.product_id);
      if (!product) return null;

      const cost = Number(product.cost_price) || 0;
      const mrp = Number(product.mrp) || 0;
      const days = batch.days_left;

      let discountPct = 15;
      if (days <= 2) discountPct = 30;
      else if (days <= 4) discountPct = 25;
      else if (days <= 7) discountPct = 20;

      // Apply Margin Guard Safety Rule: floor = cost * MARGIN_GUARD_FACTOR
      const marginGuardFloor = Math.ceil(cost * MARGIN_GUARD_FACTOR);
      let calculatedPrice = Math.round(mrp * (1 - discountPct / 100));

      if (calculatedPrice < marginGuardFloor) {
        calculatedPrice = marginGuardFloor;
        discountPct = Math.round(((mrp - calculatedPrice) / mrp) * 100);
      }

      const unitProfit = Math.max(0, calculatedPrice - cost);
      const totalProfit = unitProfit * batch.quantity_on_hand;

      const suggestion = {
        id: 'md-' + Date.now(),
        batch_id: batch.id,
        product_name: product.name,
        product_image: product.image_url,
        batch_code: batch.batch_code,
        units: batch.quantity_on_hand,
        cost_price: cost,
        mrp,
        days_left: days,
        discount_pct: discountPct,
        suggested_price: calculatedPrice,
        unit_profit: unitProfit,
        total_profit: totalProfit,
        status: 'pending'
      };

      const markdowns = this._get('markdowns') || [];
      markdowns.push(suggestion);
      this._set('markdowns', markdowns);
      this.notify('markdown_created', suggestion);
      return suggestion;
    }

    acceptMarkdown(id) {
      const markdowns = this._get('markdowns') || [];
      const item = markdowns.find((m) => m.id === id);
      if (!item) return null;
      item.status = 'accepted';
      this._set('markdowns', markdowns);

      // Record in sales adjustment as discounted
      this.deductBatchStock(item.batch_id, item.units, 'discounted', item.suggested_price);

      this.notify('markdown_accepted', item);

      if (this.supabaseClient) {
        this.supabaseClient.from('markdown_suggestions').update({
          status: 'accepted'
        }).eq('id', id).then(({ error }) => {
          if (error) console.warn('[Supabase Sync] Markdown update error:', error);
        });
      }
      return item;
    }

    dismissMarkdown(id) {
      const markdowns = this._get('markdowns') || [];
      const item = markdowns.find((m) => m.id === id);
      if (!item) return null;
      item.status = 'dismissed';
      this._set('markdowns', markdowns);
      this.notify('markdown_dismissed', item);

      if (this.supabaseClient) {
        this.supabaseClient.from('markdown_suggestions').update({
          status: 'dismissed'
        }).eq('id', id).then(({ error }) => {
          if (error) console.warn('[Supabase Sync] Markdown update error:', error);
        });
      }
      return item;
    }

    bulkAcceptAllMarkdowns() {
      const markdowns = this._get('markdowns') || [];
      const pending = markdowns.filter((m) => m.status === 'pending');
      pending.forEach((m) => {
        m.status = 'accepted';
        this.deductBatchStock(m.batch_id, m.units, 'discounted', m.suggested_price);
      });
      this._set('markdowns', markdowns);
      this.notify('markdowns_bulk_accepted', pending);
      return pending.length;
    }

    // -------------------------------------------------------------
    // Dashboard Bento Metrics
    // -------------------------------------------------------------
    getMetrics() {
      const batches = this.getBatches();
      const activeBatches = batches.filter((b) => b.quantity_on_hand > 0);
      const fefoAlerts = activeBatches.filter((b) => b.days_left <= 7);
      const stats = this._get('stats') || { baseActiveSkus: 420, moneySaved: 2450 };
      const markdowns = this.getMarkdowns();
      const profitRecovered = markdowns.reduce((sum, m) => sum + (m.total_profit || 0), 0);

      // Count active distinct SKUs
      const activeProducts = new Set(activeBatches.map((b) => b.product_id));
      const skuCount = stats.baseActiveSkus + Math.max(0, activeProducts.size - 4);

      return {
        activeSkus: skuCount,
        fefoCount: fefoAlerts.length,
        moneySaved: stats.moneySaved,
        queueCount: fefoAlerts.length,
        pendingMarkdowns: markdowns.length,
        profitRecovered
      };
    }

    // -------------------------------------------------------------
    // Demo Reset
    // -------------------------------------------------------------
    resetToDefaultData() {
      this._set('products', DEFAULT_PRODUCTS);
      this._set('batches', DEFAULT_BATCHES);
      this._set('markdowns', DEFAULT_MARKDOWNS);
      this._set('sales', []);
      this._set('merchant', DEFAULT_MERCHANT);
      this._set('stats', {
        baseActiveSkus: 420,
        moneySaved: 2450
      });
      this.notify('data_reset');
    }
  }

  // Attach singleton to window
  window.SkitDB = new SkitDatabase();
})(window);
