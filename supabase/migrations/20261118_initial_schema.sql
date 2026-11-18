-- ==============================================================================
-- SKIT: Smart Kariyana Inventory Technology
-- Supabase PostgreSQL Relational Database Schema & Migrations
-- Target: Micro-Retailers & Kirana Stores (FEFO & Freshness Management)
-- ==============================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ------------------------------------------------------------------------------
-- 1. Merchants & Stores Table
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS merchants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    phone VARCHAR(15) UNIQUE NOT NULL,
    pin_hash VARCHAR(255) NOT NULL,
    store_name VARCHAR(255) NOT NULL DEFAULT 'Gupta General Store',
    location VARCHAR(255) NOT NULL DEFAULT 'Sector 14, Urban Estate',
    currency VARCHAR(10) NOT NULL DEFAULT 'INR',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 2. Products Table
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    barcode VARCHAR(64) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    category VARCHAR(100) NOT NULL DEFAULT 'General',
    mrp NUMERIC(10, 2) NOT NULL CHECK (mrp >= 0),
    cost_price NUMERIC(10, 2) NOT NULL CHECK (cost_price >= 0),
    shelf_life_days INTEGER NOT NULL DEFAULT 30 CHECK (shelf_life_days > 0),
    image_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);

-- ------------------------------------------------------------------------------
-- 3. Batches Table (FEFO Tracking)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS batches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    batch_code VARCHAR(64) NOT NULL,
    expiry_date DATE NOT NULL,
    quantity_on_hand INTEGER NOT NULL DEFAULT 0 CHECK (quantity_on_hand >= 0),
    received_date TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_batches_product_id ON batches(product_id);
CREATE INDEX IF NOT EXISTS idx_batches_expiry_date ON batches(expiry_date);
CREATE INDEX IF NOT EXISTS idx_batches_quantity ON batches(quantity_on_hand);

-- ------------------------------------------------------------------------------
-- 4. Sales Adjustments Table
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sales_adjustments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    batch_id UUID NOT NULL REFERENCES batches(id) ON DELETE CASCADE,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    type VARCHAR(32) NOT NULL CHECK (type IN ('sold', 'discounted', 'removed')),
    selling_price NUMERIC(10, 2) NOT NULL CHECK (selling_price >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sales_adjustments_batch_id ON sales_adjustments(batch_id);
CREATE INDEX IF NOT EXISTS idx_sales_adjustments_created_at ON sales_adjustments(created_at);

-- ------------------------------------------------------------------------------
-- 5. Alerts Table (FEFO Expiry Warnings: 14d, 7d, 3d)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    batch_id UUID NOT NULL REFERENCES batches(id) ON DELETE CASCADE,
    trigger_days INTEGER NOT NULL CHECK (trigger_days IN (14, 7, 3, 2, 1)),
    status VARCHAR(32) NOT NULL DEFAULT 'sent' CHECK (status IN ('sent', 'seen', 'acted')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_alerts_batch_id ON alerts(batch_id);
CREATE INDEX IF NOT EXISTS idx_alerts_status ON alerts(status);

-- ------------------------------------------------------------------------------
-- 6. Markdown Suggestions Table (Margin Guard Engine)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS markdown_suggestions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    batch_id UUID NOT NULL REFERENCES batches(id) ON DELETE CASCADE,
    days_left INTEGER NOT NULL,
    suggested_price NUMERIC(10, 2) NOT NULL CHECK (suggested_price > 0),
    status VARCHAR(32) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'dismissed')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_markdown_batch_id ON markdown_suggestions(batch_id);
CREATE INDEX IF NOT EXISTS idx_markdown_status ON markdown_suggestions(status);

-- ------------------------------------------------------------------------------
-- 7. Row Level Security (RLS) Configuration
-- Enable public / anon access for authenticated client apps or open demo
-- ------------------------------------------------------------------------------
ALTER TABLE merchants ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_adjustments ENABLE ROW LEVEL SECURITY;
ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE markdown_suggestions ENABLE ROW LEVEL SECURITY;

-- Allow read & write access for application operations
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

-- ------------------------------------------------------------------------------
-- 8. Seed Initial Data for Kirana Store (FEFO Showcase)
-- ------------------------------------------------------------------------------
INSERT INTO merchants (id, phone, pin_hash, store_name, location)
VALUES 
    ('00000000-0000-0000-0000-000000000001', '9876543210', '1234', 'Gupta General Store', 'Sector 14, Urban Estate')
ON CONFLICT (phone) DO UPDATE 
SET store_name = EXCLUDED.store_name, location = EXCLUDED.location;

-- Insert Products
INSERT INTO products (id, barcode, name, category, mrp, cost_price, shelf_life_days, image_url)
VALUES
    ('11111111-1111-1111-1111-111111111101', '8901260012345', 'Amul Butter 500g', 'Dairy / Spreads', 285.00, 230.00, 180, 'assets/images/amul_butter_500g.png'),
    ('11111111-1111-1111-1111-111111111102', '8901262010012', 'Amul Taaza Milk 500ml', 'Dairy / Fresh Milk', 27.00, 22.00, 4, 'https://lh3.googleusercontent.com/aida-public/AB6AXuAn9wUU-e6prC4R6B19O3pnoRSSqQMq-lPTYeMWrZUx39lRiQsddMk7IGYpjWFEPU-VsmuwUhqi31VxWWrfvy2IJdIZXAUjsuCyn1TlaWfmYg2wmj9ghznhb8797e6h5nLR5-FqXvHdkiJVTLVFuVzd0wzC7viBRRWzYYAxYmS95Nrt_89EUWe2ENT2rlYzwPmlK8tJLTkU-a_Q3_ULvjG5mqWzM3xiuPCSwKikSbA'),
    ('11111111-1111-1111-1111-111111111103', '8901063142104', 'Britannia Brown Bread', 'Bakery / Bread', 50.00, 28.00, 6, 'https://lh3.googleusercontent.com/aida-public/AB6AXuAmsSPfMkd0UUg7g3qacMaDxmrvuxTPGJp1pQv-6BJg4b0e-qLcdFyEU3ycEaLQhhSB9Rm_O5nwVNv_DWWfm_NjWNnDa5NliJTRFdjOphAAt6ni0iPp5PADYUlaqOrfkXI0lZBNmxuJzyvMI_ef6YOG8bL5KjA_xkq8I1Gjb6KYoLTGmkt67Qq37-RHKsEXY7aJzgrHwbAjT3yuJpkicJQgW16YeAGg04ppD3YpJMg'),
    ('11111111-1111-1111-1111-111111111104', '8901030773010', 'Mother Dairy Dahi 400g', 'Dairy / Yogurt', 35.00, 26.00, 10, 'https://lh3.googleusercontent.com/aida-public/AB6AXuCxxJ3soEYmoJeGOEjPBcgIYUBKEYbX51uIC6vVG-a_ma9om4vrja43Za4jW-sRjj31R1SPpfgvcl7vl_GPRCIV1inFtofCsiReaDd3nKyOBeGkK0bfsQdc3_bh1kidfAl4xKeqQOkqLMmMVrnOzuU3HVghRpUo1VPiiFVib-XkSMiJcWK-qA6116GBfvZeQZjeeRFoMqyMFKtdIgOorT3UAJjv_PUJheidh-mvtSA'),
    ('11111111-1111-1111-1111-111111111105', '8904018300215', 'Fresh Malai Paneer 200g', 'Dairy / Fresh', 95.00, 72.00, 5, 'https://lh3.googleusercontent.com/aida-public/AB6AXuBbXrmFf07AoObIpuJV9T8gQYRY1jyhHY8ilVi127f6JmIZkWKwJDMGd4VGmJvHYIhXv_o8vqYCnPB0OJOsAswqv1aaN54FgZO-xFWw4x1FPbLjrUJuI9y8_rQBA1_8wOyPTAfjqrhgWJTBTJe3-4hSmderl-doQ2Dp1CAyiM14ScMuqKwsQaQGaE0VgqAaikxzbQwNFj_hAGU7F1cOuLuOZsvRTrwvld6dQJjPOzA'),
    ('11111111-1111-1111-1111-111111111106', '8901058852204', 'Nestle Milk Pack 1L', 'Dairy / Tetra Pak', 60.00, 42.00, 90, 'https://lh3.googleusercontent.com/aida-public/AB6AXuDdce9kFVmXPWA24hQuDbwBrcPD0-Xw_nSnen1iNqJ9TajgLnwwiQ5wgFiRz6dPEEHKJypCYyEziQzpNnKQxAdCoFOK20cujGatg4LJEGq4_qqqKEpGBXG07Xzo2xCECBp3xUk31TH-_VKzIudAds_uVUx_HaVqo4Oh-D34cMh6uT-wHnGLPJix_z3JA1f6VGSXdNayvaBAthF6uSd6cd5Fp4cJfQitnhlRF6jR01A'),
    ('11111111-1111-1111-1111-111111111107', '8906073120019', 'Epigamia Greek Yogurt Strawberry', 'Dairy / Gourmet', 60.00, 35.00, 15, 'https://lh3.googleusercontent.com/aida-public/AB6AXuD1iI15DrdxKXE43A8cMJY6RWOH-YtGXUzPWZG6KXvHwk2AoY9yhrnIjSMjt06ufmSl2lVjmjmuZUIzrFhepH4ZgDBdOzGRX8L_9MOIfw_wOlvDsKH89hvt4rJt8yeMl1Z6puWYmivtoS3c1O2tlWRF3beVbBoWECvcxbp8Y88hN2PzeAENZOyPWbJrlUVyFiCcKNqd8gF2bNyM0laCwpAT4HdTbzf4t7Iv4m9Nblk')
ON CONFLICT (barcode) DO UPDATE 
SET name = EXCLUDED.name, mrp = EXCLUDED.mrp, cost_price = EXCLUDED.cost_price;

-- Insert Batches
INSERT INTO batches (id, product_id, batch_code, expiry_date, quantity_on_hand, received_date)
VALUES
    ('22222222-2222-2222-2222-222222222201', '11111111-1111-1111-1111-111111111102', 'BT-8821', CURRENT_DATE + INTERVAL '3 days', 8, NOW() - INTERVAL '1 day'),
    ('22222222-2222-2222-2222-222222222202', '11111111-1111-1111-1111-111111111103', 'BT-8904', CURRENT_DATE + INTERVAL '2 days', 5, NOW() - INTERVAL '2 days'),
    ('22222222-2222-2222-2222-222222222203', '11111111-1111-1111-1111-111111111104', 'BT-9042', CURRENT_DATE + INTERVAL '7 days', 14, NOW() - INTERVAL '1 day'),
    ('22222222-2222-2222-2222-222222222204', '11111111-1111-1111-1111-111111111105', 'BT-9118', CURRENT_DATE + INTERVAL '1 day', 4, NOW() - INTERVAL '3 days'),
    ('22222222-2222-2222-2222-222222222205', '11111111-1111-1111-1111-111111111101', 'BT-4092', CURRENT_DATE + INTERVAL '3 days', 12, NOW() - INTERVAL '10 days'),
    ('22222222-2222-2222-2222-222222222206', '11111111-1111-1111-1111-111111111106', 'NM-104', CURRENT_DATE + INTERVAL '5 days', 18, NOW() - INTERVAL '15 days'),
    ('22222222-2222-2222-2222-222222222207', '11111111-1111-1111-1111-111111111107', 'EG-550', CURRENT_DATE + INTERVAL '4 days', 15, NOW() - INTERVAL '5 days')
ON CONFLICT (id) DO NOTHING;

-- Insert Alerts
INSERT INTO alerts (batch_id, trigger_days, status)
VALUES
    ('22222222-2222-2222-2222-222222222201', 3, 'sent'),
    ('22222222-2222-2222-2222-222222222202', 2, 'sent'),
    ('22222222-2222-2222-2222-222222222203', 7, 'seen'),
    ('22222222-2222-2222-2222-222222222204', 1, 'sent'),
    ('22222222-2222-2222-2222-222222222205', 3, 'sent')
ON CONFLICT DO NOTHING;

-- Insert Markdown Suggestions (governed by Margin Guard floor: cost * 1.05)
INSERT INTO markdown_suggestions (batch_id, days_left, suggested_price, status)
VALUES
    ('22222222-2222-2222-2222-222222222205', 3, 242.00, 'pending'),
    ('22222222-2222-2222-2222-222222222206', 5, 48.00, 'pending'),
    ('22222222-2222-2222-2222-222222222202', 2, 35.00, 'pending'),
    ('22222222-2222-2222-2222-222222222207', 4, 45.00, 'pending')
ON CONFLICT DO NOTHING;
