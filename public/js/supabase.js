/**
 * SKIT: Smart Kariyana Inventory Technology
 * Production Supabase Client & Backend-Only Data Layer
 * 100% Scoped to Authenticated Merchant Store ID
 */

(function (window) {
  'use strict';

  const SESSION_KEY = 'skit_production_session';
  const LOCAL_CACHE_PREFIX = 'skit_store_';

  // Margin Guard minimum safety threshold: Cost + 5%
  const MARGIN_GUARD_FACTOR = 1.05;

  class SkitSupabaseService {
    constructor() {
      this.supabase = null;
      this.currentMerchant = null;
      this.listeners = [];
      this.configLoaded = false;
      this.initPromise = this.init();
    }

    async init() {
      // 1. Restore authenticated merchant session if exists
      this.restoreSession();

      // 2. Load Supabase configuration from build-time window.__SKIT_ENV__ or /api/config serverless endpoint
      let url = '';
      let key = '';

      if (window.__SKIT_ENV__ && window.__SKIT_ENV__.supabaseUrl && window.__SKIT_ENV__.supabaseAnonKey) {
        url = window.__SKIT_ENV__.supabaseUrl;
        key = window.__SKIT_ENV__.supabaseAnonKey;
      } else {
        try {
          const res = await fetch('/api/config', { cache: 'no-store' });
          if (res.ok) {
            const data = await res.json();
            url = data.supabaseUrl || '';
            key = data.supabaseAnonKey || '';
          }
        } catch (e) {
          console.warn('[SKIT Backend] /api/config fetch skipped or not available locally:', e);
        }
      }

      if (url && key && window.supabase) {
        try {
          this.supabase = window.supabase.createClient(url, key, {
            auth: { credentials: 'omit', persistSession: false }
          });
          console.log('[SKIT Production] Connected to Supabase Cloud Database:', url);
        } catch (err) {
          console.error('[SKIT Production] Supabase initialization failed:', err);
        }
      } else {
        console.warn('[SKIT Production] No backend Supabase credentials detected yet. Operating in local-scoped merchant storage.');
      }

      this.configLoaded = true;
      this.notify('ready', { connected: Boolean(this.supabase) });
      return Boolean(this.supabase);
    }

    restoreSession() {
      try {
        const raw = localStorage.getItem(SESSION_KEY);
        if (raw) {
          this.currentMerchant = JSON.parse(raw);
        }
      } catch (e) {
        this.currentMerchant = null;
      }
    }

    saveSession(merchant) {
      this.currentMerchant = merchant;
      if (merchant) {
        localStorage.setItem(SESSION_KEY, JSON.stringify(merchant));
      } else {
        localStorage.removeItem(SESSION_KEY);
      }
      this.notify('session_changed', merchant);
    }

    logout() {
      this.saveSession(null);
      this.notify('logged_out');
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
          console.error('[SKIT Event Error]', e);
        }
      });
    }

    // -------------------------------------------------------------
    // Local Scoped Fallback Helpers (Per-Merchant Isolation)
    // -------------------------------------------------------------
    _isValidUUID(id) {
      return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(id || ''));
    }

    async _ensureValidMerchant() {
      if (!this.currentMerchant) return null;
      if (this.supabase && !this._isValidUUID(this.currentMerchant.id)) {
        try {
          const { data: dbMerchant } = await this.supabase
            .from('merchants')
            .select('*')
            .eq('phone', this.currentMerchant.phone)
            .limit(1);

          if (dbMerchant && dbMerchant.length > 0) {
            this.saveSession(dbMerchant[0]);
            return dbMerchant[0];
          }

          const { data: created, error } = await this.supabase
            .from('merchants')
            .upsert([{
              phone: this.currentMerchant.phone || '9876543210',
              pin_hash: this.currentMerchant.pin_hash || '1111',
              store_name: this.currentMerchant.store_name || 'My Kirana Store',
              location: this.currentMerchant.location || 'Local Market',
              otp_verified: true,
              currency: 'INR'
            }], { onConflict: 'phone' })
            .select()
            .single();

          if (!error && created) {
            this.saveSession(created);
            return created;
          }
        } catch (e) {
          console.warn('[Merchant UUID self-heal warning]', e);
        }
      }
      return this.currentMerchant;
    }

    _getStoreKey(table) {
      const merchantId = this.currentMerchant ? this.currentMerchant.id : 'anonymous';
      return `${LOCAL_CACHE_PREFIX}${merchantId}_${table}`;
    }

    _getLocal(table) {
      try {
        const raw = localStorage.getItem(this._getStoreKey(table));
        return raw ? JSON.parse(raw) : [];
      } catch (e) {
        return [];
      }
    }

    _setLocal(table, data) {
      try {
        localStorage.setItem(this._getStoreKey(table), JSON.stringify(data));
      } catch (e) {
        console.warn('[Local Storage Quota Warning]', e);
      }
    }

    // -------------------------------------------------------------
    // Authentication & Merchant Registration (One-Time 1111 OTP)
    // -------------------------------------------------------------

    /**
     * One-time OTP bypass verification for launch phase.
     * Checks if mobile is already verified with a PIN; prevents re-registering.
     */
    async registerMerchantWithOTP(phone, otp, pin, storeName, location) {
      const cleanPhone = String(phone).replace(/\D/g, '').slice(-10);
      const cleanPin = String(pin).trim();
      const cleanStore = String(storeName).trim() || 'My Kirana Store';
      const cleanLoc = String(location).trim() || 'Local Market';

      if (!cleanPhone || cleanPhone.length !== 10) {
        throw new Error('Please enter a valid 10-digit mobile number.');
      }
      if (!cleanPin || cleanPin.length !== 4) {
        throw new Error('PIN must be exactly 4 digits.');
      }

      // TODO: Replace temporary 1111 OTP bypass with SMS gateway provider (e.g., MSG91 / Twilio / Supabase Phone Auth)
      if (otp !== '1111') {
        throw new Error('Invalid OTP. Use temporary launch code 1111.');
      }

      await this.initPromise;

      // 1. Check if merchant already exists in live Supabase database
      if (this.supabase) {
        const { data: existing, error: checkErr } = await this.supabase
          .from('merchants')
          .select('id, phone, otp_verified')
          .eq('phone', cleanPhone)
          .maybeSingle();

        if (checkErr && checkErr.code !== 'PGRST116') {
          console.warn('[Supabase Merchant Check Error]', checkErr);
        }

        if (existing && existing.otp_verified) {
          throw new Error('Mobile number already registered! Please log in with your 4-digit PIN.');
        }

        // 2. Insert new merchant record into Supabase
        const newMerchant = {
          phone: cleanPhone,
          pin_hash: cleanPin,
          store_name: cleanStore,
          location: cleanLoc,
          otp_verified: true,
          currency: 'INR'
        };

        const { data: created, error: insertErr } = await this.supabase
          .from('merchants')
          .upsert([newMerchant], { onConflict: 'phone' })
          .select()
          .single();

        if (insertErr) {
          throw new Error('Database registration error: ' + (insertErr.message || 'Unable to create store'));
        }

        this.saveSession(created);
        return created;
      }

      // Offline / Local storage fallback when Supabase credentials are not yet configured
      const localMerchants = JSON.parse(localStorage.getItem('skit_registered_merchants') || '[]');
      const alreadyRegistered = localMerchants.find((m) => m.phone === cleanPhone && m.otp_verified);
      if (alreadyRegistered) {
        throw new Error('Mobile number already registered! Please log in with your 4-digit PIN.');
      }

      const localMerchant = {
        id: 'merchant-' + Date.now(),
        phone: cleanPhone,
        pin_hash: cleanPin,
        store_name: cleanStore,
        location: cleanLoc,
        otp_verified: true,
        currency: 'INR',
        created_at: new Date().toISOString()
      };

      localMerchants.push(localMerchant);
      localStorage.setItem('skit_registered_merchants', JSON.stringify(localMerchants));
      this.saveSession(localMerchant);
      return localMerchant;
    }

    /**
     * Merchant Login with Mobile + 4-digit PIN
     */
    async loginMerchantWithPin(phone, pin) {
      const cleanPhone = String(phone).replace(/\D/g, '').slice(-10);
      const cleanPin = String(pin).trim();

      if (!cleanPhone || cleanPhone.length !== 10) {
        throw new Error('Please enter a valid 10-digit mobile number.');
      }
      if (!cleanPin || cleanPin.length !== 4) {
        throw new Error('Please enter your 4-digit PIN.');
      }

      await this.initPromise;

      if (this.supabase) {
        const { data: merchant, error } = await this.supabase
          .from('merchants')
          .select('*')
          .eq('phone', cleanPhone)
          .maybeSingle();

        if (error) {
          throw new Error('Database error during login: ' + error.message);
        }

        if (!merchant) {
          throw new Error('No account found for this mobile number. Please register your store first.');
        }

        if (merchant.pin_hash !== cleanPin) {
          throw new Error('Incorrect 4-digit PIN. Please try again or use Forgot PIN.');
        }

        this.saveSession(merchant);
        return merchant;
      }

      // Local storage fallback
      const localMerchants = JSON.parse(localStorage.getItem('skit_registered_merchants') || '[]');
      const merchant = localMerchants.find((m) => m.phone === cleanPhone);

      if (!merchant) {
        throw new Error('No account found for this mobile number. Please register your store first.');
      }

      if (merchant.pin_hash !== cleanPin) {
        throw new Error('Incorrect 4-digit PIN.');
      }

      this.saveSession(merchant);
      return merchant;
    }

    /**
     * Reset / Forgot PIN with temporary 1111 OTP bypass
     */
    async resetPinWithOTP(phone, otp, newPin) {
      const cleanPhone = String(phone).replace(/\D/g, '').slice(-10);
      const cleanPin = String(newPin).trim();

      // TODO: Replace temporary 1111 OTP bypass with SMS gateway provider (e.g., MSG91 / Twilio / Supabase Phone Auth)
      if (otp !== '1111') {
        throw new Error('Invalid OTP. Use launch code 1111.');
      }
      if (!cleanPin || cleanPin.length !== 4) {
        throw new Error('New PIN must be 4 digits.');
      }

      await this.initPromise;

      if (this.supabase) {
        const { data: updated, error } = await this.supabase
          .from('merchants')
          .update({ pin_hash: cleanPin })
          .eq('phone', cleanPhone)
          .select()
          .maybeSingle();

        if (error || !updated) {
          throw new Error('Failed to update PIN: ' + (error ? error.message : 'Phone not found'));
        }
        return updated;
      }

      const localMerchants = JSON.parse(localStorage.getItem('skit_registered_merchants') || '[]');
      const merchant = localMerchants.find((m) => m.phone === cleanPhone);
      if (!merchant) throw new Error('Phone number not found.');
      merchant.pin_hash = cleanPin;
      localStorage.setItem('skit_registered_merchants', JSON.stringify(localMerchants));
      return merchant;
    }

    // -------------------------------------------------------------
    // Live Merchant Profile
    // -------------------------------------------------------------
    getMerchant() {
      return this.currentMerchant;
    }

    async updateMerchantProfile(updates) {
      if (!this.currentMerchant) return null;
      const updated = { ...this.currentMerchant, ...updates, updated_at: new Date().toISOString() };

      if (this.supabase) {
        const { error } = await this.supabase
          .from('merchants')
          .update({
            store_name: updated.store_name,
            location: updated.location
          })
          .eq('id', updated.id);

        if (error) console.error('[Supabase Profile Update Error]', error);
      }

      this.saveSession(updated);
      return updated;
    }

    // -------------------------------------------------------------
    // Live Scoped Products
    // -------------------------------------------------------------
    async getProducts() {
      await this.initPromise;
      await this._ensureValidMerchant();
      if (!this.currentMerchant) return [];
      const merchantId = this.currentMerchant.id;

      if (this.supabase) {
        try {
          const { data, error } = await this.supabase
            .from('products')
            .select('*')
            .eq('merchant_id', merchantId)
            .order('name', { ascending: true });

          if (!error && data) {
            this._setLocal('products', data);
            return data;
          }
          if (error) console.warn('[Supabase getProducts warning]:', error);
        } catch (err) {
          console.warn('[Supabase getProducts exception]:', err);
        }
      }
      return this._getLocal('products');
    }

    async getProductByBarcode(barcode) {
      await this.initPromise;
      await this._ensureValidMerchant();
      if (!this.currentMerchant) return null;
      const clean = String(barcode).trim();
      const merchantId = this.currentMerchant.id;

      if (this.supabase) {
        try {
          const { data, error } = await this.supabase
            .from('products')
            .select('*')
            .eq('merchant_id', merchantId)
            .eq('barcode', clean)
            .limit(1);

          if (!error && data && data.length > 0) return data[0];
        } catch (err) {
          console.warn('[Supabase getProductByBarcode exception]:', err);
        }
      }

      const local = this._getLocal('products');
      return local.find((p) => p.barcode === clean) || null;
    }

    async addProduct(productData) {
      await this.initPromise;
      await this._ensureValidMerchant();
      if (!this.currentMerchant) throw new Error('Merchant session required');
      const merchantId = this.currentMerchant.id;

      const record = {
        merchant_id: merchantId,
        barcode: String(productData.barcode).trim(),
        name: String(productData.name).trim(),
        category: productData.category || 'General Grocery',
        mrp: Number(productData.mrp) || 0,
        cost_price: Number(productData.cost_price) || 0,
        shelf_life_days: Number(productData.shelf_life_days) || 30,
        image_url: productData.image_url || 'assets/images/shelf_illustration.png',
        unit: productData.unit || 'units'
      };

      if (this.supabase) {
        try {
          const { data, error } = await this.supabase
            .from('products')
            .insert([record])
            .select()
            .single();

          if (error) {
            console.error('[Supabase Add Product Error]', error);
            // Check if product already exists
            const existing = await this.getProductByBarcode(record.barcode);
            if (existing) return existing;
            throw new Error('Failed to save product to database: ' + error.message);
          }

          const local = this._getLocal('products');
          const existingIdx = local.findIndex((p) => p.id === data.id);
          if (existingIdx >= 0) local[existingIdx] = data;
          else local.push(data);
          this._setLocal('products', local);
          this.notify('products_updated');
          return data;
        } catch (err) {
          console.error('[Supabase addProduct exception]:', err);
          throw err;
        }
      }

      record.id = 'prod-' + Date.now();
      record.created_at = new Date().toISOString();
      const local = this._getLocal('products');
      local.push(record);
      this._setLocal('products', local);
      this.notify('products_updated');
      return record;
    }

    // -------------------------------------------------------------
    // Live Scoped Batches & FEFO Queue
    // -------------------------------------------------------------
    async getBatches() {
      await this.initPromise;
      await this._ensureValidMerchant();
      if (!this.currentMerchant) return [];
      const merchantId = this.currentMerchant.id;

      if (this.supabase) {
        try {
          let { data, error } = await this.supabase
            .from('batches')
            .select('*, products(*)')
            .eq('merchant_id', merchantId)
            .gt('quantity_on_hand', 0)
            .order('expiry_date', { ascending: true });

          if (error) {
            console.warn('[Supabase getBatches join warning, running resilient fallback query]:', error);
            const fallback = await this.supabase
              .from('batches')
              .select('*')
              .eq('merchant_id', merchantId)
              .gt('quantity_on_hand', 0)
              .order('expiry_date', { ascending: true });

            if (!fallback.error && fallback.data) {
              const products = await this.getProducts();
              const prodMap = new Map(products.map((p) => [String(p.id), p]));
              data = fallback.data.map((b) => ({
                ...b,
                products: prodMap.get(String(b.product_id)) || {}
              }));
              error = null;
            }
          }

          if (!error && data) {
            const formatted = data.map((b) => {
              const daysLeft = Math.ceil((new Date(b.expiry_date) - new Date()) / (1000 * 60 * 60 * 24));
              const prod = b.products || {};
              return {
                id: b.id,
                product_id: b.product_id,
                product_name: prod.name || b.product_name || 'Item',
                product_category: prod.category || 'General',
                product_image: prod.image_url || 'assets/images/shelf_illustration.png',
                mrp: prod.mrp || 0,
                cost_price: prod.cost_price || 0,
                unit: prod.unit || 'units',
                batch_code: b.batch_code,
                expiry_date: b.expiry_date,
                days_left: Math.max(0, daysLeft),
                quantity_on_hand: b.quantity_on_hand
              };
            });
            this._setLocal('batches', formatted);
            return formatted;
          }
        } catch (err) {
          console.warn('[Supabase getBatches exception]:', err);
        }
      }

      return this._getLocal('batches');
    }

    async addBatch(batchData) {
      await this.initPromise;
      await this._ensureValidMerchant();
      if (!this.currentMerchant) throw new Error('Merchant session required');
      const merchantId = this.currentMerchant.id;

      const record = {
        merchant_id: merchantId,
        product_id: batchData.product_id,
        batch_code: batchData.batch_code || 'BT-' + Math.floor(1000 + Math.random() * 9000),
        expiry_date: batchData.expiry_date,
        quantity_on_hand: Number(batchData.quantity_on_hand) || 1
      };

      if (this.supabase) {
        // Use select() without embedding on mutations (PostgREST requirement)
        const { data, error } = await this.supabase
          .from('batches')
          .insert([record])
          .select()
          .single();

        if (error) {
          console.error('[Supabase Add Batch Error]', error);
          throw new Error('Failed to log batch: ' + error.message);
        }

        const daysLeft = Math.ceil((new Date(record.expiry_date) - new Date()) / (1000 * 60 * 60 * 24));
        const formattedBatch = {
          id: data.id,
          product_id: record.product_id,
          product_name: batchData.product_name || 'Item',
          product_category: batchData.product_category || 'General',
          product_image: batchData.product_image || 'assets/images/shelf_illustration.png',
          mrp: batchData.mrp || 0,
          cost_price: batchData.cost_price || 0,
          unit: batchData.unit || 'units',
          batch_code: record.batch_code,
          expiry_date: record.expiry_date,
          days_left: Math.max(0, daysLeft),
          quantity_on_hand: record.quantity_on_hand
        };

        const localBatches = this._getLocal('batches');
        localBatches.push(formattedBatch);
        this._setLocal('batches', localBatches);

        this.notify('batch_added', formattedBatch);
        return formattedBatch;
      }

      // Local fallback
      const daysLeft = Math.ceil((new Date(record.expiry_date) - new Date()) / (1000 * 60 * 60 * 24));
      const localBatches = this._getLocal('batches');
      const localProducts = this._getLocal('products');
      const prod = localProducts.find((p) => String(p.id) === String(record.product_id)) || {};

      const newBatch = {
        id: 'batch-' + Date.now(),
        product_id: record.product_id,
        product_name: prod.name || batchData.product_name || 'Item',
        product_category: prod.category || 'General',
        product_image: prod.image_url || 'assets/images/shelf_illustration.png',
        mrp: prod.mrp || 0,
        cost_price: prod.cost_price || 0,
        unit: prod.unit || 'units',
        batch_code: record.batch_code,
        expiry_date: record.expiry_date,
        days_left: Math.max(0, daysLeft),
        quantity_on_hand: record.quantity_on_hand
      };

      localBatches.push(newBatch);
      this._setLocal('batches', localBatches);
      this.notify('batch_added', newBatch);
      return newBatch;
    }

    async deductBatchStock(batchId, quantity, type = 'sold', customPrice = null) {
      await this.initPromise;
      await this._ensureValidMerchant();
      if (!this.currentMerchant) return null;
      const merchantId = this.currentMerchant.id;
      const qty = Number(quantity);

      if (this.supabase) {
        // Fetch current batch
        const { data: batch } = await this.supabase
          .from('batches')
          .select('id, quantity_on_hand, product_id, products(mrp)')
          .eq('id', batchId)
          .eq('merchant_id', merchantId)
          .single();

        if (!batch) return null;

        const newQty = Math.max(0, batch.quantity_on_hand - qty);
        const sellingPrice = customPrice !== null ? customPrice : (batch.products ? batch.products.mrp : 0);

        // Update batch quantity
        await this.supabase
          .from('batches')
          .update({ quantity_on_hand: newQty })
          .eq('id', batchId);

        // Record adjustment
        await this.supabase.from('sales_adjustments').insert([{
          merchant_id: merchantId,
          batch_id: batchId,
          quantity: qty,
          type,
          selling_price: sellingPrice
        }]);

        // Keep local cache in sync
        const batches = this._getLocal('batches');
        const bIdx = batches.findIndex((b) => String(b.id) === String(batchId));
        if (bIdx >= 0) {
          batches[bIdx].quantity_on_hand = newQty;
          this._setLocal('batches', batches);
        }

        this.notify('stock_updated');
        return { batchId, remaining: newQty };
      }

      // Local fallback
      const batches = this._getLocal('batches');
      const batch = batches.find((b) => b.id === batchId);
      if (batch) {
        batch.quantity_on_hand = Math.max(0, batch.quantity_on_hand - qty);
        this._setLocal('batches', batches);

        const sales = this._getLocal('sales');
        sales.push({
          id: 'sale-' + Date.now(),
          batch_id: batchId,
          quantity: qty,
          type,
          selling_price: customPrice || batch.mrp,
          created_at: new Date().toISOString()
        });
        this._setLocal('sales', sales);
        this.notify('stock_updated');
      }
      return batch;
    }

    // -------------------------------------------------------------
    // Live Markdown Engine (Margin Guard: Minimum Floor = Cost + 5%)
    // -------------------------------------------------------------
    async getMarkdowns() {
      const batches = await this.getBatches();
      const markdowns = [];

      for (const batch of batches) {
        if (batch.quantity_on_hand <= 0) continue;
        const days = batch.days_left;

        // Trigger dynamic clearance rule only for near-expiry items (<= 7 days)
        if (days <= 7) {
          const cost = Number(batch.cost_price) || 0;
          const mrp = Number(batch.mrp) || 0;

          let discountPct = 15;
          if (days <= 2) discountPct = 30;
          else if (days <= 4) discountPct = 25;
          else if (days <= 7) discountPct = 20;

          // Margin Guard: Guaranteed price floor at Cost + 5%
          const marginGuardFloor = Math.ceil(cost * MARGIN_GUARD_FACTOR);
          let suggestedPrice = Math.round(mrp * (1 - discountPct / 100));

          if (suggestedPrice < marginGuardFloor) {
            suggestedPrice = marginGuardFloor;
            discountPct = Math.round(((mrp - suggestedPrice) / mrp) * 100);
          }

          const unitProfit = Math.max(0, suggestedPrice - cost);
          const totalProfit = unitProfit * batch.quantity_on_hand;

          markdowns.push({
            id: 'md-' + batch.id,
            batch_id: batch.id,
            product_name: batch.product_name,
            product_image: batch.product_image,
            batch_code: batch.batch_code,
            units: batch.quantity_on_hand,
            cost_price: cost,
            mrp,
            days_left: days,
            discount_pct: Math.max(5, discountPct),
            suggested_price: suggestedPrice,
            unit_profit: unitProfit,
            total_profit: totalProfit,
            status: 'pending'
          });
        }
      }

      return markdowns;
    }

    // -------------------------------------------------------------
    // Live Metrics Computation
    // -------------------------------------------------------------
    async getMetrics() {
      if (!this.currentMerchant) {
        return { activeSkus: 0, fefoCount: 0, moneySaved: 0, pendingMarkdowns: 0, profitRecovered: 0 };
      }

      const batches = await this.getBatches();
      const activeBatches = batches.filter((b) => b.quantity_on_hand > 0);
      const fefoAlerts = activeBatches.filter((b) => b.days_left <= 7);
      const uniqueSkus = new Set(activeBatches.map((b) => b.product_id)).size;

      let moneySaved = 0;
      if (this.supabase) {
        const { data: sales } = await this.supabase
          .from('sales_adjustments')
          .select('quantity, selling_price, type')
          .eq('merchant_id', this.currentMerchant.id);

        if (sales) {
          moneySaved = sales.reduce((sum, s) => {
            // Approx 15% estimated spoilage cost averted via proactive clearance/sale
            return sum + Math.round((Number(s.selling_price) || 0) * (Number(s.quantity) || 0) * 0.15);
          }, 0);
        }
      } else {
        const sales = this._getLocal('sales');
        moneySaved = sales.reduce((sum, s) => sum + Math.round(s.selling_price * s.quantity * 0.15), 0);
      }

      const markdowns = await this.getMarkdowns();
      const profitRecovered = markdowns.reduce((sum, m) => sum + m.total_profit, 0);

      return {
        activeSkus: uniqueSkus,
        fefoCount: fefoAlerts.length,
        moneySaved,
        pendingMarkdowns: markdowns.length,
        profitRecovered
      };
    }
  }

  // Attach singleton to window
  window.SkitDB = new SkitSupabaseService();
})(window);
