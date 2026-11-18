# SKIT Supabase Relational Database Setup

This directory contains the database migration scripts and schema definitions for **SKIT (Smart Kariyana Inventory Technology)**.

## Schema Overview
- `merchants`: Stores mobile authentication, PIN hashes, and merchant store profile details.
- `products`: Product master catalog (barcode, name, category, mrp, cost_price, shelf_life_days, image_url).
- `batches`: Per-batch stock levels and expiry tracking for First-Expired, First-Out (FEFO) queue.
- `sales_adjustments`: Audit trail for stock sold, discounted, or removed via Return to Vendor (RTV).
- `alerts`: Proactive notifications triggered at 14, 7, 3, 2, or 1 days prior to batch expiration.
- `markdown_suggestions`: Margin Guard-compliant dynamic markdown pricing (minimum floor: cost + 5%).

## Quick Migration Steps

1. Create a new project in your [Supabase Dashboard](https://supabase.com).
2. Open the **SQL Editor** tab.
3. Paste the contents of `supabase/migrations/20261118_initial_schema.sql` and run it.
4. Copy your **Project URL** and **Anon Public Key** from **Settings > API**.
5. In the SKIT web app, navigate to **Settings** and enter your Supabase URL and Anon Key. The app will immediately link to your live Supabase backend and synchronize all operations in real-time.
