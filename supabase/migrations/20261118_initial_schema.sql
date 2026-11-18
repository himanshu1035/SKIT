-- ==============================================================================
-- SKIT: Smart Kariyana Inventory Technology
-- Supabase PostgreSQL Relational Database Production Schema
-- Target: Micro-Retailers & Kirana Stores (FEFO & Freshness Management)
-- ==============================================================================

-- Clean reset of existing tables to prevent "column does not exist" conflict
DROP TABLE IF EXISTS markdown_suggestions CASCADE;
DROP TABLE IF EXISTS alerts CASCADE;
DROP TABLE IF EXISTS sales_adjustments CASCADE;
DROP TABLE IF EXISTS batches CASCADE;
DROP TABLE IF EXISTS products CASCADE;
DROP TABLE IF EXISTS merchants CASCADE;

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ------------------------------------------------------------------------------
-- 1. Merchants & Stores Table
-- ------------------------------------------------------------------------------
CREATE TABLE merchants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    phone VARCHAR(15) UNIQUE NOT NULL,
    pin_hash VARCHAR(255) NOT NULL,
    store_name VARCHAR(255) NOT NULL,
    location VARCHAR(255) NOT NULL,
    otp_verified BOOLEAN NOT NULL DEFAULT false,
    currency VARCHAR(10) NOT NULL DEFAULT 'INR',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_merchants_phone ON merchants(phone);

-- ------------------------------------------------------------------------------
-- 2. Products Table (Scoped to Merchant)
-- ------------------------------------------------------------------------------
CREATE TABLE products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    merchant_id UUID REFERENCES merchants(id) ON DELETE CASCADE,
    barcode VARCHAR(64) NOT NULL,
    name VARCHAR(255) NOT NULL,
    category VARCHAR(100) NOT NULL DEFAULT 'General',
    mrp NUMERIC(10, 2) NOT NULL CHECK (mrp >= 0),
    cost_price NUMERIC(10, 2) NOT NULL CHECK (cost_price >= 0),
    shelf_life_days INTEGER NOT NULL DEFAULT 30 CHECK (shelf_life_days > 0),
    image_url TEXT,
    unit VARCHAR(32) DEFAULT 'units',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_products_merchant_id ON products(merchant_id);
CREATE INDEX idx_products_barcode ON products(barcode);
CREATE INDEX idx_products_category ON products(category);

-- ------------------------------------------------------------------------------
-- 3. Batches Table (FEFO Tracking Scoped to Merchant)
-- ------------------------------------------------------------------------------
CREATE TABLE batches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    merchant_id UUID REFERENCES merchants(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    batch_code VARCHAR(64) NOT NULL,
    expiry_date DATE NOT NULL,
    quantity_on_hand INTEGER NOT NULL DEFAULT 0 CHECK (quantity_on_hand >= 0),
    received_date TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_batches_merchant_id ON batches(merchant_id);
CREATE INDEX idx_batches_product_id ON batches(product_id);
CREATE INDEX idx_batches_expiry_date ON batches(expiry_date);
CREATE INDEX idx_batches_quantity ON batches(quantity_on_hand);

-- ------------------------------------------------------------------------------
-- 4. Sales Adjustments Table (Audit Trail)
-- ------------------------------------------------------------------------------
CREATE TABLE sales_adjustments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    merchant_id UUID REFERENCES merchants(id) ON DELETE CASCADE,
    batch_id UUID NOT NULL REFERENCES batches(id) ON DELETE CASCADE,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    type VARCHAR(32) NOT NULL CHECK (type IN ('sold', 'discounted', 'removed')),
    selling_price NUMERIC(10, 2) NOT NULL CHECK (selling_price >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_sales_adjustments_merchant ON sales_adjustments(merchant_id);
CREATE INDEX idx_sales_adjustments_batch_id ON sales_adjustments(batch_id);
CREATE INDEX idx_sales_adjustments_created_at ON sales_adjustments(created_at);

-- ------------------------------------------------------------------------------
-- 5. Alerts Table (FEFO Expiry Warnings: 14d, 7d, 3d, 2d, 1d)
-- ------------------------------------------------------------------------------
CREATE TABLE alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    merchant_id UUID REFERENCES merchants(id) ON DELETE CASCADE,
    batch_id UUID NOT NULL REFERENCES batches(id) ON DELETE CASCADE,
    trigger_days INTEGER NOT NULL CHECK (trigger_days IN (14, 7, 3, 2, 1)),
    status VARCHAR(32) NOT NULL DEFAULT 'sent' CHECK (status IN ('sent', 'seen', 'acted')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_alerts_merchant ON alerts(merchant_id);
CREATE INDEX idx_alerts_batch_id ON alerts(batch_id);
CREATE INDEX idx_alerts_status ON alerts(status);

-- ------------------------------------------------------------------------------
-- 6. Markdown Suggestions Table (Margin Guard Engine)
-- ------------------------------------------------------------------------------
CREATE TABLE markdown_suggestions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    merchant_id UUID REFERENCES merchants(id) ON DELETE CASCADE,
    batch_id UUID NOT NULL REFERENCES batches(id) ON DELETE CASCADE,
    days_left INTEGER NOT NULL,
    suggested_price NUMERIC(10, 2) NOT NULL CHECK (suggested_price > 0),
    status VARCHAR(32) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'dismissed')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_markdown_merchant ON markdown_suggestions(merchant_id);
CREATE INDEX idx_markdown_batch_id ON markdown_suggestions(batch_id);
CREATE INDEX idx_markdown_status ON markdown_suggestions(status);

-- ------------------------------------------------------------------------------
-- 7. Row Level Security (RLS) Configuration
-- ------------------------------------------------------------------------------
ALTER TABLE merchants ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_adjustments ENABLE ROW LEVEL SECURITY;
ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE markdown_suggestions ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
    DROP POLICY IF EXISTS "Public access for merchants" ON merchants;
    CREATE POLICY "Public access for merchants" ON merchants FOR ALL USING (true) WITH CHECK (true);

    DROP POLICY IF EXISTS "Public access for products" ON products;
    CREATE POLICY "Public access for products" ON products FOR ALL USING (true) WITH CHECK (true);

    DROP POLICY IF EXISTS "Public access for batches" ON batches;
    CREATE POLICY "Public access for batches" ON batches FOR ALL USING (true) WITH CHECK (true);

    DROP POLICY IF EXISTS "Public access for sales_adjustments" ON sales_adjustments;
    CREATE POLICY "Public access for sales_adjustments" ON sales_adjustments FOR ALL USING (true) WITH CHECK (true);

    DROP POLICY IF EXISTS "Public access for alerts" ON alerts;
    CREATE POLICY "Public access for alerts" ON alerts FOR ALL USING (true) WITH CHECK (true);

    DROP POLICY IF EXISTS "Public access for markdown_suggestions" ON markdown_suggestions;
    CREATE POLICY "Public access for markdown_suggestions" ON markdown_suggestions FOR ALL USING (true) WITH CHECK (true);
END $$;
