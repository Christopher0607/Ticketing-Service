CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  name text NOT NULL,
  password_hash text NOT NULL,
  role text NOT NULL DEFAULT 'buyer' CHECK (role IN ('buyer','seller','admin')),
  stripe_account text UNIQUE,
  seller_requested boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE sessions (
  token_hash text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL
);

CREATE TABLE auth_limits (
  key text PRIMARY KEY,
  window_start timestamptz NOT NULL DEFAULT now(),
  attempts integer NOT NULL
);

CREATE TABLE events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  title text NOT NULL,
  category text NOT NULL CHECK (category IN ('Concerts','Festivals','Sports','Arts & Theatre')),
  venue text NOT NULL,
  city text NOT NULL,
  starts_at timestamptz NOT NULL,
  description text NOT NULL,
  image text NOT NULL CHECK (image IN ('concert','festival','sports','theatre','hero')),
  transfer_policy_url text CHECK (transfer_policy_url LIKE 'https://%'),
  transfer_host text,
  featured boolean NOT NULL DEFAULT false,
  active boolean NOT NULL DEFAULT true
);

CREATE TABLE listings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES events(id),
  seller_id uuid NOT NULL REFERENCES users(id),
  section text NOT NULL,
  price integer NOT NULL CHECK (price BETWEEN 100 AND 2500000),
  quantity integer NOT NULL CHECK (quantity BETWEEN 1 AND 100),
  available integer NOT NULL CHECK (available BETWEEN 0 AND quantity),
  proof text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','active','rejected','paused')),
  paused_by_admin boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX listings_event_status ON listings (event_id, status);

CREATE TABLE fee_settings (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  buyer_bps integer NOT NULL DEFAULT 300 CHECK (buyer_bps BETWEEN 0 AND 3000),
  seller_bps integer NOT NULL DEFAULT 300 CHECK (seller_bps BETWEEN 0 AND 3000)
);
INSERT INTO fee_settings DEFAULT VALUES;

CREATE TABLE orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid NOT NULL REFERENCES listings(id),
  buyer_id uuid NOT NULL REFERENCES users(id),
  quantity integer NOT NULL CHECK (quantity BETWEEN 1 AND 10),
  subtotal integer NOT NULL CHECK (subtotal > 0),
  buyer_bps integer NOT NULL,
  seller_bps integer NOT NULL,
  buyer_fee integer NOT NULL CHECK (buyer_fee >= 0),
  seller_fee integer NOT NULL CHECK (seller_fee >= 0),
  payment_mode text NOT NULL CHECK (payment_mode IN ('stripe','demo')),
  status text NOT NULL DEFAULT 'reserved' CHECK (status IN (
    'reserved','expired','paid','delivered','confirmed','refund_requested','refund_pending','refunded','disputed'
  )),
  expires_at timestamptz NOT NULL,
  checkout_id text UNIQUE,
  checkout_attempted boolean NOT NULL DEFAULT false,
  payment_intent text UNIQUE,
  charge_id text UNIQUE,
  net_payment integer,
  paid_at timestamptz,
  delivered_at timestamptz,
  pre_dispute_status text,
  transfer_ref text,
  transfer_url text,
  refund_reason text,
  pre_refund_status text,
  refund_id text UNIQUE,
  refund_attempt integer NOT NULL DEFAULT 0,
  transfer_id text UNIQUE,
  settled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX orders_pending_expiry ON orders (expires_at) WHERE status = 'reserved';
CREATE INDEX orders_buyer ON orders (buyer_id, created_at DESC);

CREATE TABLE stripe_events (
  id text PRIMARY KEY,
  type text NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now()
);
