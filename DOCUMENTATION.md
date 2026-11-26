# SKIT Shop Mobile App — Documentation

This project is organized into clean folders (`css/`, `js/`, `pages/`) and uses simple HTML, CSS, JavaScript, and Supabase (no `localStorage`).

---

## 1. Folder & File Structure

```text
SKIT/
├── index.html              (Get Started page)
├── pages/
│   ├── login.html          (Login page)
│   ├── signup.html         (Sign Up page)
│   ├── home.html           (Main dashboard home screen)
│   ├── add.html            (+ button page - Add Product Batch)
│   ├── inventory.html      (Inventory page - lists all added products)
│   ├── sold.html           (Mark Sold page - search & deduct sold quantity)
│   └── profile.html        (Profile Settings page)
├── css/
│   └── style.css           (Simple mobile-sized CSS: 360px × 640px)
├── js/
│   └── app.js              (Form validation + Supabase connection)
├── database.sql            (SQL for "user_details", "login_history", and "product_batches")
├── .env.local              (Supabase URL and Anon Key)
└── .gitignore              (Keeps .env.local out of Git)
```

---

## 2. How Connections Work

1. **HTML ↔ CSS**:
   - `index.html` loads `css/style.css`.
   - `pages/login.html`, `pages/signup.html`, and `pages/coming-soon.html` load `../css/style.css`.
   - Every page uses `<div class="mobile-box">` to stay fixed at **360px × 640px**.
2. **HTML ↔ JS ↔ Supabase**:
   - `pages/login.html` and `pages/signup.html` load Supabase JS (`@supabase/supabase-js@2`) and `../js/app.js`.
   - `connectDatabase()` in `js/app.js` reads `../.env.local` and connects to Supabase using `SUPABASE_URL` and `SUPABASE_ANON_KEY`.
   - Nothing is stored in `localStorage`.

---

## 3. How Each Button & Click Works

### A. Get Started (`index.html`)
- **`Get Started` button**: Opens `pages/signup.html`.
- **`Login` button**: Opens `pages/login.html`.

### B. Login (`pages/login.html`)
- **`← Back` link**: Goes back to `../index.html`.
- **`Show` / `Hide` button**: Calls `togglePassword('login-password', this)` to show or hide the password.
- **`Login` button**: Calls `handleLogin(event)`:
  1. Checks 10-digit mobile number and non-empty password.
  2. Connects to Supabase and checks the `user_details` table.
  3. If wrong, shows `"Wrong mobile number or password"`.
  4. If correct, opens `coming-soon.html`.
- **`Sign Up` link**: Opens `signup.html`.

### C. Sign Up (`pages/signup.html`)
- **`← Back` link**: Goes back to `../index.html`.
- **`Show` / `Hide` buttons**: Toggle visibility for password and confirm password.
- **`Sign Up` button**: Calls `handleSignup(event)`:
  1. Checks 10-digit mobile number, shop name, 6+ char password, and matching confirm password.
  2. Checks if mobile number already exists in `user_details`.
  3. Inserts `{ mobile, shop_name, password }` into Supabase `user_details` table.
  4. Opens `coming-soon.html`.
- **`Login` link**: Opens `login.html`.

### D. Main Home Screen (`pages/home.html`), Add (`pages/add.html`), & Inventory (`pages/inventory.html`)
- **Top-left Hamburger Icon (`☰`)**: Calls `toggleMenu()` to open the side menu, which has the **Logout** button at the bottom.
- **Top-center Shop Name**: Displays the user's Shop Name between the hamburger icon and profile button.
- **Top-right Round Profile Icon**: Shows the first letter of the Shop Name and links to `profile.html`.
- **Profile Settings (`pages/profile.html`)**: Lets the user edit **Shop Name**, **Mobile Number**, and optional **New Password**, then saves changes to Supabase via `handleProfileSave(event)`.
- **Main Area (`home.html`)**: Displays 4 empty rectangle boxes in a 2×2 grid.
- **Bottom Navigation Bar**: 3 buttons at the bottom:
  1. **Home** (`home.html`) — Main dashboard screen.
  2. **`+`** (`add.html`) — **Add Product Batch** form (Item Name, Quantity, Expiry Date, Product Image) saved to `product_batches` in Supabase via `handleAddProduct(event)`.
  3. **Inventory** (`inventory.html`) — Shows **Coming Soon**.
- **`Logout` button (inside Hamburger Menu)**: Calls `handleLogout()`, updates `login_history` (`is_logged_in = false`, `logout_time = now`), clears the `loggedInMobile` cookie, and redirects to `login.html`.
