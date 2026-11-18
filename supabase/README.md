# SKIT Supabase Production Database Setup

This directory contains the production database migration script for **SKIT (Smart Kariyana Inventory Technology)**.

## Production Schema Overview

All inventory, batches, alerts, and markdown suggestions are 100% isolated and scoped per merchant store (`merchant_id`).

- `merchants`: Stores mobile authentication, 4-digit PIN hash, store name, location, and `otp_verified` flag.
- `products`: Product master catalog scoped to merchant (`merchant_id`, `barcode`, `name`, `category`, `mrp`, `cost_price`, `shelf_life_days`, `image_url`, `unit`).
- `batches`: Per-batch stock levels and expiry tracking for First-Expired, First-Out (FEFO) queuing.
- `sales_adjustments`: Audit trail for stock sold, discounted, or removed via Return to Vendor (RTV).
- `alerts`: Proactive notifications triggered at 14, 7, 3, 2, or 1 days prior to batch expiration.
- `markdown_suggestions`: Dynamic clearance recommendations governed by Margin Guard (minimum price floor: cost + 5%).

## Migration Instructions

1. Open your [Supabase Dashboard](https://supabase.com).
2. Go to the **SQL Editor** tab.
3. Paste the contents of `supabase/migrations/20261118_initial_schema.sql` and run it.
4. Copy your **Project URL** and **Anon Public Key** from **Settings > API**.
5. Add them to your **Vercel Project Settings** under **Environment Variables**:
   - `SUPABASE_URL` = `https://your-project.supabase.co`
   - `SUPABASE_ANON_KEY` = `eyJhbGciOi...`
6. Once configured in Vercel, SKIT connects automatically with zero client configuration required!
