---
name: Vital Stock
colors:
  surface: '#f8f9ff'
  surface-dim: '#d0dbed'
  surface-bright: '#f8f9ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#eff4ff'
  surface-container: '#e6eeff'
  surface-container-high: '#dee9fc'
  surface-container-highest: '#d9e3f6'
  on-surface: '#121c2a'
  on-surface-variant: '#3c4a42'
  inverse-surface: '#27313f'
  inverse-on-surface: '#eaf1ff'
  outline: '#6c7a71'
  outline-variant: '#bbcabf'
  surface-tint: '#006c49'
  primary: '#006c49'
  on-primary: '#ffffff'
  primary-container: '#10b981'
  on-primary-container: '#00422b'
  inverse-primary: '#4edea3'
  secondary: '#855300'
  on-secondary: '#ffffff'
  secondary-container: '#fea619'
  on-secondary-container: '#684000'
  tertiary: '#b91a24'
  on-tertiary: '#ffffff'
  tertiary-container: '#ff7a73'
  on-tertiary-container: '#79000e'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#6ffbbe'
  primary-fixed-dim: '#4edea3'
  on-primary-fixed: '#002113'
  on-primary-fixed-variant: '#005236'
  secondary-fixed: '#ffddb8'
  secondary-fixed-dim: '#ffb95f'
  on-secondary-fixed: '#2a1700'
  on-secondary-fixed-variant: '#653e00'
  tertiary-fixed: '#ffdad7'
  tertiary-fixed-dim: '#ffb3ad'
  on-tertiary-fixed: '#410004'
  on-tertiary-fixed-variant: '#930013'
  background: '#f8f9ff'
  on-background: '#121c2a'
  surface-variant: '#d9e3f6'
typography:
  display-lg:
    fontFamily: Inter
    fontSize: 36px
    fontWeight: '700'
    lineHeight: 44px
    letterSpacing: -0.02em
  display-lg-mobile:
    fontFamily: Inter
    fontSize: 28px
    fontWeight: '700'
    lineHeight: 36px
    letterSpacing: -0.01em
  headline-metric:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '700'
    lineHeight: 28px
    letterSpacing: -0.02em
  headline-title:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 24px
    letterSpacing: -0.01em
  body-default:
    fontFamily: Inter
    fontSize: 15px
    fontWeight: '400'
    lineHeight: 22px
    letterSpacing: 0em
  body-medium:
    fontFamily: Inter
    fontSize: 15px
    fontWeight: '500'
    lineHeight: 22px
    letterSpacing: 0em
  metadata-compact:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: '400'
    lineHeight: 18px
    letterSpacing: 0.01em
  label-badge:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.02em
  label-micro:
    fontFamily: Inter
    fontSize: 11px
    fontWeight: '700'
    lineHeight: 14px
    letterSpacing: 0.04em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  gutter: 1rem
  margin: 1rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.25rem
  space-xl: 1.5rem
---

## Brand & Style

The design system establishes a high-efficiency, glanceable visual language built strictly for fast-paced inventory control and perishable stock health monitoring. Adapting modern Android Native (Material Design 3) paradigms, the visual grammar prioritizes operational clarity, visual triage, and instant legibility under variable lighting conditions (e.g., stockrooms, retail floors, commercial kitchens).

### Emotional Dynamics & Visual Tone
- **Preserved & Fresh:** Conveys reassurance and proactive control through crisp emerald accents and immaculate whitespace.
- **Urgent without Chaos:** Employs precise, isolated chromatic flags (amber and red) strictly reserved for inventory depreciation thresholds, ensuring zero alert fatigue.
- **Utilitarian & Tactical:** Minimal decorative overhead; dense metadata is compressed into clean scannable badges, large numeric tickers, and clear physical thumbnail anchors.

### Design Movement
Modern Android Native / Material 3 Utility. Surfaces rely on tonal layer steps, soft tactile elevation, generous 48dp+ tap targets, and distinct pill-based state chips for near-zero cognitive load.

## Colors

The palette establishes strict semantic intent across the full lifecycle of managed items. Backgrounds and surfaces remain quiet to prioritize real-time status recognition.

### Palette Roles & Application
- **Primary Emerald (`#10B981`):** Represents optimal shelf-life, active verified stock, confirmed counts, and primary creation actions.
- **Secondary Warning Amber (`#F59E0B`):** Flags items within the 7–14 day consumption/rotation window. Used strictly for mid-priority badges, filter tabs, and proactive warning indicators.
- **Tertiary Critical Red (`#EF4444`):** Flags critical expiration status (<3 days or past due), stock depletion, and destructive batch removals.
- **Neutral Dark Charcoal (`#1F2937`):** Primary text and prominent numeric readouts. Ensures high-contrast readability against crisp backgrounds.
- **Neutral Muted Slate (`#6B7280`):** Secondary metadata, timestamps, SKUs, and category tags.
- **Surface & Canvas:**
  - Base App Canvas: Clean Off-White (`#F8F9FA`).
  - Elevated Container: Pure White (`#FFFFFF`).
  - Structural Ghost Stroke: Soft Slate (`#E5E7EB`).

### Chromatic Triage Rules
- Amber and red must never be used decoratively. They are functional status signifiers reserved for stock health indicators.
- High-contrast alert badges pair tinted background fills (e.g., `#FEF2F2` for critical alert, `#FFFBEB` for warning) with solid saturated text and glyphs to optimize glanceability.

## Typography

Inter powers the entire interface, chosen for its neutral grotesque proportions, open aperture, and tabular numeric capabilities (`tnum`).

### Numeric Hierarchy & Triage
- **Countdown Tickers (`headline-metric`):** Days remaining, remaining batch quantity, and shelf-life counts are formatted in bold high-contrast tabular figures. They sit alongside cards as the primary visual anchor before textual titles.
- **Labels & Badges (`label-badge`, `label-micro`):** Uppercase or sentence-case chips use bold weights with slight positive letter spacing to maintain visual structure at low pixel densities.
- **Metadata (`metadata-compact`):** SKU codes, location shelf IDs, and batch numbers maintain subdued visual weight to prevent competing with item names and expiration metrics.

## Layout & Spacing

The layout model adopts Android Native fluid column behavior governed by Material 3 baseline grids and dynamic device margins.

### Breakpoints & Layout Adaptations
- **Compact (Mobile <600dp):** Single-column layout. Canvas margin fixed to `1rem` (16dp). Cards span full width between margins with internal padding of `space-md` (16dp). Top-level operational metrics run in a horizontal scroll rail or 2x2 summary grid.
- **Medium (Tablet / Foldables 600–839dp):** Dual-column fluid grid. Gutter fixed to `1rem` (16dp), margin expanded to `1.5rem` (24dp). Product feeds support side-by-side card arrangements with sticky category/batch filtering.
- **Expanded (Desktop / Workstation 840dp+):** Multi-column structure constrained to a maximum content width of 1280dp. Left-hand persistent navigation rail; right-hand item inspection panel alongside a 3-column product card stream.

### Ergonomics
All interactive items maintain a minimum touch bounding box of 48x48dp, even when visual badge presentation is compact.

## Elevation & Depth

Visual hierarchy leverages Material 3 tonal layering combined with subtle, high-diffusion ambient shadows. This prevents heavy dark drop shadows while making interactive surfaces float cleanly above the `#F8F9FA` canvas.

### Elevation Levels
- **Level 0 (Canvas):** `#F8F9FA` — Inactive base layer.
- **Level 1 (Default Cards & Input Fields):** Surface `#FFFFFF`, bound by a crisp hairline border (`1px solid #E5E7EB`) and ambient shadow: `box-shadow: 0 1px 3px rgba(31, 41, 55, 0.04), 0 4px 12px rgba(31, 41, 55, 0.03)`.
- **Level 2 (Hover / Active Drag / Focused Cards):** Surface `#FFFFFF`, elevation rises to `box-shadow: 0 4px 6px rgba(31, 41, 55, 0.05), 0 10px 24px rgba(31, 41, 55, 0.06)`, border subtly transitions to `#D1D5DB`.
- **Level 3 (Modals, Bottom Sheets, Scanners):** Surface `#FFFFFF`, deep contextual shadow: `box-shadow: 0 20px 25px -5px rgba(31, 41, 55, 0.1), 0 8px 10px -6px rgba(31, 41, 55, 0.05)`.
- **Level 4 (Floating Action Button):** Saturated Primary (`#10B981`), `box-shadow: 0 6px 16px rgba(16, 185, 129, 0.35)`.

## Shapes

The design uses a rounded geometry (`roundedness: 2`, matching `rounded-2xl` / 16px on structural product cards).

### Shape Tokens & Components
- **Product Cards & Modal Containers:** `1rem` (16px / `rounded-2xl`). Delivers friendly, approachable containment and distinct visual separation against the canvas.
- **Thumbnails & Product Imagery:** `0.75rem` (12px / `rounded-xl`). Nests comfortably inside the 16px card radius while maintaining uniform padding.
- **Status Badges, Filter Chips, Action Buttons:** Full pill geometry (`9999px` / `rounded-full`). Distinct pill silhouettes ensure badges are read as self-contained operational states rather than clickable content containers.
- **Inputs & Text Fields:** `0.75rem` (12px / `rounded-xl`).

## Components

### 1. Stock Product Cards
- **Geometry & Background:** Elevated `#FFFFFF` card, `16px` border-radius, `1px solid #E5E7EB` outline, `16px` internal padding.
- **Layout Architecture:**
  - **Left Anchor:** 64x64dp rounded thumbnail (`12px` corner radius) with neutral `#F3F4F6` fallback housing product imagery or categorical iconography.
  - **Center Column:** Primary item title (`headline-title`), SKU/Location subtitle (`metadata-compact` in `#6B7280`), and total stock counter.
  - **Right Anchor:** Large bold expiration countdown (`headline-metric`), stacked above an urgent status chip.

### 2. Status Pills & Badges
- **Shape:** Pill-shaped (`rounded-full`), height: 24dp, horizontal padding: 8dp.
- **Variants:**
  - **Optimal (>14 days):** Tinted fill `#ECFDF5`, text and icon `#059669`.
  - **Expiring Soon (7–14 days):** Tinted fill `#FFFBEB`, text and icon `#D97706`.
  - **Critical (<3 days / Expired):** Tinted fill `#FEF2F2`, text and icon `#DC2626`.
- Typography: `label-badge` (12px semi-bold).

### 3. Buttons & Floating Actions
- **Primary FAB:** 56x56dp circular or extended pill container in `#10B981` with white icon/label. Positioned bottom-right with 16dp margin.
- **Secondary / Ghost Buttons:** Transparent fill, `1px solid #E5E7EB`, text `#1F2937`, `12px` border-radius.
- **Destructive Button:** Tinted `#FEE2E2` fill with `#EF4444` label for batch disposal workflows.

### 4. Input Fields & Quick Scanners
- **Inputs:** Height: 48dp, `#FFFFFF` fill, `1px solid #E5E7EB` stroke, `12px` border-radius. Focused state transitions stroke to `#10B981` with 2px width.
- **Integrated Action:** Suffix area dedicated to a barcode/QR scan icon trigger to support swift physical audit.

### 5. Selection Controls (Checkboxes & Radios)
- **Checkboxes:** 20x20dp with 6px border-radius. Unchecked: `1.5px solid #D1D5DB`. Checked: Solid `#10B981` fill with white checkmark.
- **Touch Target:** Centered in a 48x48dp unpadded touch area.

### 6. Filter Chips
- **State:** Inactive chip uses `#FFFFFF` fill with `1px solid #E5E7EB`. Active chip uses `#1F2937` dark charcoal background with `#FFFFFF` text, or tinted semantic color when filtering exclusively by urgency (e.g., active "Critical" filter chips turn `#EF4444` with white text).