# 🛒 SKIT: Smart Kariyana Inventory Technology

**SKIT (Smart Kariyana Inventory Technology)** is an automated, real-time localized inventory tracking and freshness management Progressive Web Application (PWA) built specifically for micro-retailers (Kirana stores) in India.

SKIT addresses the critical problem of perishable grocery depreciation and inventory loss through First-Expired, First-Out (FEFO) queuing, AI camera barcode and OCR expiry date auto-fill intake, and rule-based dynamic clearance markdown pricing governed by an uncompromising **Margin Guard** safety rule.

---

## 📱 Core Highlights & Features

1. **Material 3 / Android Native Design System:**
   - Unified from `stitch_skit_inventory_design_system` design tokens (`DESIGN.md`).
   - Tailwind CSS with Emerald `#006c49` / `#10B981` brand primary, Warning Amber `#F59E0B`, and Critical Red `#EF4444`.
   - Android touch ergonomics with minimum 48dp tap bounding targets and high-contrast tabular numeric typography (`Inter`).
   - PWA support with offline caching via Service Worker (`sw.js`) and Web App Manifest (`manifest.json`).

2. **Welcome & Onboarding Flow:**
   - Ambient lighting stage with authentic grocery shelf scanning illustration asset.
   - Smooth pathways for new merchant onboarding and existing store authentication.

3. **Merchant Authentication & Registration:**
   - Mobile number login (`+91` prefix) with secure 4-digit PIN, password visibility toggle, and one-tap demo credentials.
   - Merchant registration with interactive simulated OTP verification (`123456`), Store Name (`Gupta General Store`), and Location (`Sector 14, Urban Estate`).

4. **Main Store Dashboard & FEFO Action Queue:**
   - Real-time Store Context Ribbon with live health status triage.
   - **Bento Operational Metrics Ticker:**
     - **Active SKUs Live** count (e.g. 420).
     - **FEFO Alert** count ($\le 7$ days to expiry).
     - **Loss Averted / Money Saved** in ₹ with +14% FEFO efficiency.
   - **FEFO Sequence Action Queue:**
     - Critical expiry triage tags (e.g. *Expires Tomorrow*, *Expires in 2 Days*, *Expires in 3 Days*).
     - Interactive **"Item Sold"** Bottom Sheet deduction modal with stepper incrementer (`+`/`–`) and quick-quantity chips (`1`, `2`, `5`, `All`).
     - Percentage markdown shortcuts (`20% Off`, `30% Off`).
     - **Return-to-Vendor (RTV)** trigger logging.

5. **Live Scanner & Auto-Fill Intake (M1 Module):**
   - Immersive camera viewfinder simulation with animated laser sweep (`@keyframes scanSweep`) and reticle corner accents.
   - Dual floating AR tags for **Barcode Target Locked** and **OCR Date Extraction** (`EXP: DD/MM/YYYY`).
   - Support for live camera feed (`navigator.mediaDevices.getUserMedia`) with high-res camera POV backdrop fallback.
   - Tactical Kirana intake stepper (`+`/`–`) and manual fallback modal for sub-5 second item intake.
   - Cycle between preset Kirana items (Amul Butter 500g, Amul Taaza Milk 500ml, Britannia Brown Bread) or custom barcodes.

6. **Clearance & Freshness Markdown Engine (M4 Module):**
   - Rule-based dynamic clearance pricing:
     - $\le 2$ days: 30% Off
     - $\le 4$ days: 25% Off
     - $\le 7$ days: 15–20% Off
   - **Margin Guard Safety Rule:** Mathematical floor guaranteeing items are never discounted below purchase cost:
     $$\text{Floor Price} = \lceil \text{Cost Price} \times 1.05 \rceil$$
   - Live profit recovery estimate (`+₹X/unit profit`).
   - Individual Accept/Dismiss actions with smooth exit animations.
   - Bulk POS synchronization (**"Accept All"**) pushing all markdowns to the checkout system simultaneously.

7. **Inventory Catalog & Store Settings:**
   - Real-time instant search by product name and barcode with category filtering (Dairy, Bakery, Gourmet).
   - Live configuration for **Supabase Cloud Database** with instant connection testing and offline local-mode fallback.
   - One-tap demo data reset.

---

## 🗄️ Supabase Relational Database Schema

All SQL schema definitions, foreign key constraints, indexes, RLS policies, and Kirana seed data are located in:
`supabase/migrations/20261118_initial_schema.sql`

### Tables:
- **`merchants`**: Store profile, mobile number, 4-digit PIN hash, store name, and location.
- **`products`**: Catalog table (`id`, `barcode`, `name`, `category`, `mrp`, `cost_price`, `shelf_life_days`, `image_url`).
- **`batches`**: Per-batch stock levels and expiry tracking for FEFO priority (`id`, `product_id`, `batch_code`, `expiry_date`, `quantity_on_hand`, `received_date`).
- **`sales_adjustments`**: Audit log for sales, discounts, and RTV removals (`id`, `batch_id`, `quantity`, `type`, `selling_price`, `created_at`).
- **`alerts`**: Proactive expiry notification triggers at 14, 7, 3, 2, or 1 days (`id`, `batch_id`, `trigger_days`, `status`).
- **`markdown_suggestions`**: Margin Guard dynamic pricing recommendations (`id`, `batch_id`, `days_left`, `suggested_price`, `status`).

---

## 📁 Directory Structure

```
SKIT/
├── index.html                     # Unified mobile PWA entrypoint & client router
├── manifest.json                  # Web App Manifest (PWA standalone, icons, theme)
├── sw.js                          # Service Worker for offline caching & network fallback
├── vercel.json                    # Continuous deployment configuration for Vercel
├── package.json                   # Project scripts and dependencies
├── README.md                      # Documentation & architecture guide
├── assets/
│   ├── icons/                     # PWA icons (icon-192, icon-512, favicon, svg)
│   └── images/                    # Local product and UI imagery
├── js/
│   ├── supabase.js                # Supabase client connector + SkitDB offline repository
│   └── app.js                     # Router, UI rendering, modals, and scanner state
├── supabase/
│   ├── README.md                  # Supabase database setup instructions
│   └── migrations/
│       └── 20261118_initial_schema.sql # Complete PostgreSQL DDL & Kirana seed data
└── stitch_skit_inventory_design_system/ # Modular reference UI screens & DESIGN.md
```

---

## 🚀 Local Development & Deployment

### Run Locally:
```bash
# Using Python
python3 -m http.server 3000

# Or using Node
npm start
```
Then visit `http://localhost:3000` on your mobile browser or desktop with mobile emulation.

### Deploy to Vercel:
The project is pre-configured with `vercel.json` for static PWA routing. Simply import the repository in [Vercel](https://vercel.com) and deploy with zero configuration!
