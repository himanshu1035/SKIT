-- Paste and run this SQL in your Supabase SQL Editor

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. Tables & Constraints
CREATE TABLE IF NOT EXISTS user_details (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  mobile TEXT UNIQUE NOT NULL CHECK (mobile ~ '^[0-9]{10}$'),
  shop_name TEXT NOT NULL CHECK (char_length(trim(shop_name)) >= 2),
  password TEXT NOT NULL,
  profile_icon TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE user_details ADD COLUMN IF NOT EXISTS profile_icon TEXT;

-- Migrate any existing plaintext passwords to bcrypt
UPDATE user_details
SET password = crypt(password, gen_salt('bf'))
WHERE password IS NOT NULL AND password NOT LIKE '$2%';

CREATE TABLE IF NOT EXISTS login_history (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  mobile TEXT NOT NULL,
  shop_name TEXT NOT NULL,
  session_token TEXT UNIQUE,
  is_logged_in BOOLEAN DEFAULT TRUE,
  login_time TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '7 days'),
  logout_time TIMESTAMP WITH TIME ZONE
);

ALTER TABLE login_history ADD COLUMN IF NOT EXISTS session_token TEXT;
ALTER TABLE login_history ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '7 days');

CREATE UNIQUE INDEX IF NOT EXISTS idx_login_history_session_token
ON login_history (session_token) WHERE session_token IS NOT NULL;

CREATE TABLE IF NOT EXISTS auth_attempts (
  mobile TEXT PRIMARY KEY,
  failed_count INTEGER NOT NULL DEFAULT 0,
  locked_until TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS product_batches (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  shop_mobile TEXT NOT NULL,
  item_name TEXT NOT NULL CHECK (char_length(trim(item_name)) >= 1),
  quantity INTEGER NOT NULL CHECK (quantity >= 0),
  expiry_date DATE NOT NULL,
  description TEXT,
  image_data TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE product_batches ADD COLUMN IF NOT EXISTS image_data TEXT;
ALTER TABLE product_batches ADD COLUMN IF NOT EXISTS description TEXT;

CREATE TABLE IF NOT EXISTS product_history (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  shop_mobile TEXT NOT NULL,
  item_name TEXT NOT NULL,
  action_type TEXT NOT NULL CHECK (action_type IN ('added', 'sold')),
  quantity_changed INTEGER NOT NULL CHECK (quantity_changed > 0),
  image_data TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Lock Down Direct Table Access via RLS (All access goes through SECURITY DEFINER RPCs)
ALTER TABLE user_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE login_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE auth_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all operations on user_details" ON user_details;
DROP POLICY IF EXISTS "Allow all operations on login_history" ON login_history;
DROP POLICY IF EXISTS "Allow all operations on product_batches" ON product_batches;
DROP POLICY IF EXISTS "Allow all operations on product_history" ON product_history;

DROP POLICY IF EXISTS "Deny direct access on user_details" ON user_details;
CREATE POLICY "Deny direct access on user_details" ON user_details FOR ALL USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS "Deny direct access on login_history" ON login_history;
CREATE POLICY "Deny direct access on login_history" ON login_history FOR ALL USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS "Deny direct access on auth_attempts" ON auth_attempts;
CREATE POLICY "Deny direct access on auth_attempts" ON auth_attempts FOR ALL USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS "Deny direct access on product_batches" ON product_batches;
CREATE POLICY "Deny direct access on product_batches" ON product_batches FOR ALL USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS "Deny direct access on product_history" ON product_history;
CREATE POLICY "Deny direct access on product_history" ON product_history FOR ALL USING (false) WITH CHECK (false);

-- 3. Session Helper
CREATE OR REPLACE FUNCTION resolve_session_mobile(p_token TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_mobile TEXT;
BEGIN
  IF p_token IS NULL OR char_length(trim(p_token)) < 32 THEN
    RETURN NULL;
  END IF;

  SELECT mobile INTO v_mobile
  FROM login_history
  WHERE session_token = p_token
    AND is_logged_in = TRUE
    AND (expires_at IS NULL OR expires_at > NOW())
  LIMIT 1;

  RETURN v_mobile;
END;
$$;

-- 4. Auth RPCs
CREATE OR REPLACE FUNCTION auth_signup(p_mobile TEXT, p_shop_name TEXT, p_password TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_token TEXT;
  v_shop TEXT;
BEGIN
  IF p_mobile IS NULL OR p_mobile !~ '^[0-9]{10}$' THEN
    RAISE EXCEPTION 'Enter 10-digit mobile number';
  END IF;

  v_shop := trim(COALESCE(p_shop_name, ''));
  IF char_length(v_shop) < 2 THEN
    RAISE EXCEPTION 'Enter shop name';
  END IF;

  IF p_password IS NULL OR char_length(p_password) < 6 THEN
    RAISE EXCEPTION 'Minimum 6 characters required';
  END IF;

  IF EXISTS (SELECT 1 FROM user_details WHERE mobile = p_mobile) THEN
    RAISE EXCEPTION 'Mobile number already registered';
  END IF;

  INSERT INTO user_details (mobile, shop_name, password)
  VALUES (p_mobile, v_shop, crypt(p_password, gen_salt('bf')));

  v_token := encode(gen_random_bytes(32), 'hex');

  INSERT INTO login_history (mobile, shop_name, session_token, is_logged_in, expires_at)
  VALUES (p_mobile, v_shop, v_token, TRUE, NOW() + INTERVAL '7 days');

  RETURN jsonb_build_object(
    'mobile', p_mobile,
    'shop_name', v_shop,
    'profile_icon', '',
    'session_token', v_token
  );
END;
$$;

CREATE OR REPLACE FUNCTION auth_login(p_mobile TEXT, p_password TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_user RECORD;
  v_attempt RECORD;
  v_token TEXT;
BEGIN
  IF p_mobile IS NULL OR p_mobile !~ '^[0-9]{10}$' OR p_password IS NULL OR p_password = '' THEN
    RAISE EXCEPTION 'Wrong mobile number or password';
  END IF;

  SELECT * INTO v_attempt FROM auth_attempts WHERE mobile = p_mobile;
  IF FOUND AND v_attempt.locked_until IS NOT NULL AND v_attempt.locked_until > NOW() THEN
    RAISE EXCEPTION 'Too many failed attempts. Please try again in a few minutes';
  END IF;

  SELECT mobile, shop_name, password, COALESCE(profile_icon, '') AS profile_icon
  INTO v_user
  FROM user_details
  WHERE mobile = p_mobile;

  IF NOT FOUND OR v_user.password <> crypt(p_password, v_user.password) THEN
    INSERT INTO auth_attempts (mobile, failed_count, locked_until, updated_at)
    VALUES (p_mobile, 1, NULL, NOW())
    ON CONFLICT (mobile) DO UPDATE SET
      failed_count = CASE
        WHEN auth_attempts.updated_at < NOW() - INTERVAL '15 minutes' THEN 1
        ELSE auth_attempts.failed_count + 1
      END,
      locked_until = CASE
        WHEN (CASE WHEN auth_attempts.updated_at < NOW() - INTERVAL '15 minutes' THEN 1 ELSE auth_attempts.failed_count + 1 END) >= 5
        THEN NOW() + INTERVAL '5 minutes'
        ELSE NULL
      END,
      updated_at = NOW();

    RAISE EXCEPTION 'Wrong mobile number or password';
  END IF;

  DELETE FROM auth_attempts WHERE mobile = p_mobile;

  v_token := encode(gen_random_bytes(32), 'hex');

  INSERT INTO login_history (mobile, shop_name, session_token, is_logged_in, expires_at)
  VALUES (v_user.mobile, v_user.shop_name, v_token, TRUE, NOW() + INTERVAL '7 days');

  RETURN jsonb_build_object(
    'mobile', v_user.mobile,
    'shop_name', v_user.shop_name,
    'profile_icon', v_user.profile_icon,
    'session_token', v_token
  );
END;
$$;

CREATE OR REPLACE FUNCTION auth_logout(p_token TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  IF p_token IS NULL OR p_token = '' THEN
    RETURN;
  END IF;

  UPDATE login_history
  SET is_logged_in = FALSE,
      logout_time = NOW()
  WHERE session_token = p_token
    AND is_logged_in = TRUE;
END;
$$;

CREATE OR REPLACE FUNCTION auth_get_session(p_token TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_mobile TEXT;
  v_user RECORD;
BEGIN
  v_mobile := resolve_session_mobile(p_token);
  IF v_mobile IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT mobile, shop_name, COALESCE(profile_icon, '') AS profile_icon
  INTO v_user
  FROM user_details
  WHERE mobile = v_mobile;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  RETURN jsonb_build_object(
    'mobile', v_user.mobile,
    'shop_name', v_user.shop_name,
    'profile_icon', v_user.profile_icon
  );
END;
$$;

CREATE OR REPLACE FUNCTION auth_update_profile(
  p_token TEXT,
  p_shop_name TEXT,
  p_new_mobile TEXT,
  p_new_password TEXT,
  p_profile_icon TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_mobile TEXT;
  v_shop TEXT;
BEGIN
  v_mobile := resolve_session_mobile(p_token);
  IF v_mobile IS NULL THEN
    RAISE EXCEPTION 'Session expired';
  END IF;

  v_shop := trim(COALESCE(p_shop_name, ''));
  IF char_length(v_shop) < 2 THEN
    RAISE EXCEPTION 'Enter shop name';
  END IF;

  IF p_new_mobile IS NULL OR p_new_mobile !~ '^[0-9]{10}$' THEN
    RAISE EXCEPTION 'Enter 10-digit mobile number';
  END IF;

  IF p_new_password IS NOT NULL AND p_new_password <> '' AND char_length(p_new_password) < 6 THEN
    RAISE EXCEPTION 'Minimum 6 characters required';
  END IF;

  IF p_new_mobile <> v_mobile AND EXISTS (SELECT 1 FROM user_details WHERE mobile = p_new_mobile) THEN
    RAISE EXCEPTION 'Mobile number already registered';
  END IF;

  UPDATE user_details
  SET shop_name = v_shop,
      mobile = p_new_mobile,
      profile_icon = COALESCE(p_profile_icon, ''),
      password = CASE
        WHEN p_new_password IS NOT NULL AND p_new_password <> '' THEN crypt(p_new_password, gen_salt('bf'))
        ELSE password
      END
  WHERE mobile = v_mobile;

  UPDATE login_history
  SET mobile = p_new_mobile,
      shop_name = v_shop
  WHERE mobile = v_mobile AND is_logged_in = TRUE;

  IF p_new_mobile <> v_mobile THEN
    UPDATE product_batches SET shop_mobile = p_new_mobile WHERE shop_mobile = v_mobile;
    UPDATE product_history SET shop_mobile = p_new_mobile WHERE shop_mobile = v_mobile;
  END IF;

  RETURN jsonb_build_object(
    'mobile', p_new_mobile,
    'shop_name', v_shop,
    'profile_icon', COALESCE(p_profile_icon, '')
  );
END;
$$;

-- 5. Inventory & History RPCs (Scoped to authenticated session)
CREATE OR REPLACE FUNCTION get_batches(p_token TEXT)
RETURNS TABLE (
  id BIGINT,
  item_name TEXT,
  quantity INTEGER,
  expiry_date DATE,
  description TEXT,
  image_data TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_mobile TEXT;
BEGIN
  v_mobile := resolve_session_mobile(p_token);
  IF v_mobile IS NULL THEN
    RAISE EXCEPTION 'Session expired';
  END IF;

  RETURN QUERY
  SELECT pb.id, pb.item_name, pb.quantity, pb.expiry_date, pb.description, pb.image_data
  FROM product_batches pb
  WHERE pb.shop_mobile = v_mobile
  ORDER BY pb.expiry_date ASC;
END;
$$;

CREATE OR REPLACE FUNCTION add_batch(
  p_token TEXT,
  p_item_name TEXT,
  p_quantity INTEGER,
  p_expiry_date DATE,
  p_description TEXT,
  p_image_data TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_mobile TEXT;
  v_name TEXT;
BEGIN
  v_mobile := resolve_session_mobile(p_token);
  IF v_mobile IS NULL THEN
    RAISE EXCEPTION 'Session expired';
  END IF;

  v_name := trim(COALESCE(p_item_name, ''));
  IF v_name = '' THEN
    RAISE EXCEPTION 'Enter item name';
  END IF;

  IF p_quantity IS NULL OR p_quantity < 1 THEN
    RAISE EXCEPTION 'Enter valid quantity';
  END IF;

  IF p_expiry_date IS NULL THEN
    RAISE EXCEPTION 'Select expiry date';
  END IF;

  INSERT INTO product_batches (shop_mobile, item_name, quantity, expiry_date, description, image_data)
  VALUES (v_mobile, v_name, p_quantity, p_expiry_date, COALESCE(p_description, ''), COALESCE(p_image_data, ''));

  INSERT INTO product_history (shop_mobile, item_name, action_type, quantity_changed, image_data)
  VALUES (v_mobile, v_name, 'added', p_quantity, COALESCE(p_image_data, ''));
END;
$$;

CREATE OR REPLACE FUNCTION update_batch_qty(p_token TEXT, p_batch_id BIGINT, p_delta INTEGER)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_mobile TEXT;
  v_batch RECORD;
  v_new_qty INTEGER;
  v_diff INTEGER;
BEGIN
  v_mobile := resolve_session_mobile(p_token);
  IF v_mobile IS NULL THEN
    RAISE EXCEPTION 'Session expired';
  END IF;

  SELECT id, item_name, quantity, COALESCE(image_data, '') AS image_data
  INTO v_batch
  FROM product_batches
  WHERE id = p_batch_id AND shop_mobile = v_mobile;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Item not found';
  END IF;

  v_new_qty := GREATEST(0, v_batch.quantity + p_delta);
  v_diff := v_new_qty - v_batch.quantity;

  IF v_diff = 0 THEN
    RETURN v_new_qty;
  END IF;

  UPDATE product_batches
  SET quantity = v_new_qty
  WHERE id = p_batch_id AND shop_mobile = v_mobile;

  INSERT INTO product_history (shop_mobile, item_name, action_type, quantity_changed, image_data)
  VALUES (
    v_mobile,
    v_batch.item_name,
    CASE WHEN v_diff > 0 THEN 'added' ELSE 'sold' END,
    ABS(v_diff),
    v_batch.image_data
  );

  RETURN v_new_qty;
END;
$$;

CREATE OR REPLACE FUNCTION edit_batch(
  p_token TEXT,
  p_batch_id BIGINT,
  p_item_name TEXT,
  p_quantity INTEGER,
  p_expiry_date DATE,
  p_description TEXT,
  p_image_data TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_mobile TEXT;
  v_old RECORD;
  v_name TEXT;
  v_diff INTEGER;
BEGIN
  v_mobile := resolve_session_mobile(p_token);
  IF v_mobile IS NULL THEN
    RAISE EXCEPTION 'Session expired';
  END IF;

  v_name := trim(COALESCE(p_item_name, ''));
  IF v_name = '' OR p_quantity IS NULL OR p_quantity < 0 OR p_expiry_date IS NULL THEN
    RAISE EXCEPTION 'Invalid product details';
  END IF;

  SELECT id, quantity INTO v_old
  FROM product_batches
  WHERE id = p_batch_id AND shop_mobile = v_mobile;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Item not found';
  END IF;

  UPDATE product_batches
  SET item_name = v_name,
      quantity = p_quantity,
      expiry_date = p_expiry_date,
      description = COALESCE(p_description, ''),
      image_data = COALESCE(p_image_data, '')
  WHERE id = p_batch_id AND shop_mobile = v_mobile;

  v_diff := p_quantity - v_old.quantity;
  IF v_diff <> 0 THEN
    INSERT INTO product_history (shop_mobile, item_name, action_type, quantity_changed, image_data)
    VALUES (
      v_mobile,
      v_name,
      CASE WHEN v_diff > 0 THEN 'added' ELSE 'sold' END,
      ABS(v_diff),
      COALESCE(p_image_data, '')
    );
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION delete_batch(p_token TEXT, p_batch_id BIGINT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_mobile TEXT;
BEGIN
  v_mobile := resolve_session_mobile(p_token);
  IF v_mobile IS NULL THEN
    RAISE EXCEPTION 'Session expired';
  END IF;

  DELETE FROM product_batches
  WHERE id = p_batch_id AND shop_mobile = v_mobile;
END;
$$;

CREATE OR REPLACE FUNCTION get_history(p_token TEXT, p_limit INTEGER DEFAULT 100)
RETURNS TABLE (
  id BIGINT,
  item_name TEXT,
  action_type TEXT,
  quantity_changed INTEGER,
  image_data TEXT,
  created_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_mobile TEXT;
  v_limit INTEGER;
BEGIN
  v_mobile := resolve_session_mobile(p_token);
  IF v_mobile IS NULL THEN
    RAISE EXCEPTION 'Session expired';
  END IF;

  v_limit := LEAST(GREATEST(COALESCE(p_limit, 100), 1), 100);

  RETURN QUERY
  SELECT ph.id, ph.item_name, ph.action_type, ph.quantity_changed, ph.image_data, ph.created_at
  FROM product_history ph
  WHERE ph.shop_mobile = v_mobile
  ORDER BY ph.created_at DESC
  LIMIT v_limit;
END;
$$;

-- 6. Grant Execute on RPCs to anon/authenticated
REVOKE ALL ON FUNCTION resolve_session_mobile(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION auth_signup(TEXT, TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION auth_login(TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION auth_logout(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION auth_get_session(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION auth_update_profile(TEXT, TEXT, TEXT, TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_batches(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION add_batch(TEXT, TEXT, INTEGER, DATE, TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION update_batch_qty(TEXT, BIGINT, INTEGER) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION edit_batch(TEXT, BIGINT, TEXT, INTEGER, DATE, TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION delete_batch(TEXT, BIGINT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_history(TEXT, INTEGER) TO anon, authenticated;
