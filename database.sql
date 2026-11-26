-- Paste and run this SQL in your Supabase SQL Editor

CREATE TABLE IF NOT EXISTS user_details (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  mobile TEXT UNIQUE NOT NULL,
  shop_name TEXT NOT NULL,
  password TEXT NOT NULL,
  profile_icon TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE user_details ADD COLUMN IF NOT EXISTS profile_icon TEXT;

-- Stores login history and whether each user is currently logged in
CREATE TABLE IF NOT EXISTS login_history (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  mobile TEXT NOT NULL,
  shop_name TEXT NOT NULL,
  is_logged_in BOOLEAN DEFAULT TRUE,
  login_time TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  logout_time TIMESTAMP WITH TIME ZONE
);

-- Stores product batches added by each store owner
CREATE TABLE IF NOT EXISTS product_batches (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  shop_mobile TEXT NOT NULL,
  item_name TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  expiry_date DATE NOT NULL,
  description TEXT,
  image_data TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Make sure image_data and description columns exist even if table was created earlier
ALTER TABLE product_batches ADD COLUMN IF NOT EXISTS image_data TEXT;
ALTER TABLE product_batches ADD COLUMN IF NOT EXISTS description TEXT;

-- Stores history of recently added or sold items
CREATE TABLE IF NOT EXISTS product_history (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  shop_mobile TEXT NOT NULL,
  item_name TEXT NOT NULL,
  action_type TEXT NOT NULL,
  quantity_changed INTEGER NOT NULL,
  image_data TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Allow the website (anon key) to save and read all tables
ALTER TABLE user_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE login_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all operations on user_details" ON user_details;
CREATE POLICY "Allow all operations on user_details"
ON user_details FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all operations on login_history" ON login_history;
CREATE POLICY "Allow all operations on login_history"
ON login_history FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all operations on product_batches" ON product_batches;
CREATE POLICY "Allow all operations on product_batches"
ON product_batches FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all operations on product_history" ON product_history;
CREATE POLICY "Allow all operations on product_history"
ON product_history FOR ALL USING (true) WITH CHECK (true);
