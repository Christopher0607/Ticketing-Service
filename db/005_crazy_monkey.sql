-- Crazy Monkey: manual DuitNow / bank-transfer payments, event posters,
-- face-value pricing, seller payout details and contact numbers.

-- Public images (event posters, DuitNow QR). Served from /media/<id> with a long cache.
CREATE TABLE media (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  data bytea NOT NULL CHECK (octet_length(data) <= 3145728),
  mime text NOT NULL CHECK (mime IN ('image/webp','image/png','image/jpeg')),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE events ADD COLUMN poster_id uuid REFERENCES media(id) ON DELETE SET NULL;

-- Original price printed on the ticket, shown to buyers next to the resale price.
ALTER TABLE listings ADD COLUMN face_value integer CHECK (face_value IS NULL OR face_value BETWEEN 100 AND 2500000);

-- Optional platform-wide cap on resale price above face value (NULL = no cap).
ALTER TABLE fee_settings ADD COLUMN max_markup_bps integer CHECK (max_markup_bps IS NULL OR max_markup_bps BETWEEN 0 AND 100000);

ALTER TABLE users ADD COLUMN phone text CHECK (phone IS NULL OR phone ~ '^\+?[0-9]{8,15}$');
ALTER TABLE users ADD COLUMN payout_bank text;
ALTER TABLE users ADD COLUMN payout_name text;
ALTER TABLE users ADD COLUMN payout_account text;

ALTER TABLE orders DROP CONSTRAINT orders_payment_mode_check;
ALTER TABLE orders ADD CONSTRAINT orders_payment_mode_check CHECK (payment_mode IN ('stripe','demo','manual'));
ALTER TABLE orders DROP CONSTRAINT orders_status_check;
ALTER TABLE orders ADD CONSTRAINT orders_status_check CHECK (status IN (
  'reserved','verifying','expired','cancelled','paid','delivered','confirmed','refund_requested',
  'refund_pending','refunded','disputed'
));

-- Manual payment evidence and references recorded by the operator.
ALTER TABLE orders ADD COLUMN receipt_file bytea CHECK (receipt_file IS NULL OR octet_length(receipt_file) <= 3145728);
ALTER TABLE orders ADD COLUMN receipt_at timestamptz;
ALTER TABLE orders ADD COLUMN payment_ref text;
ALTER TABLE orders ADD COLUMN reject_reason text;
ALTER TABLE orders ADD COLUMN refund_account text;
ALTER TABLE orders ADD COLUMN refund_ref text;
ALTER TABLE orders ADD COLUMN payout_ref text;
CREATE INDEX orders_verifying ON orders (receipt_at) WHERE status = 'verifying';

-- Where buyers send manual payments. Edited from the admin settings tab.
CREATE TABLE payment_settings (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  bank_name text,
  account_name text,
  account_number text,
  duitnow_id text,
  qr_id uuid REFERENCES media(id) ON DELETE SET NULL,
  note text
);
INSERT INTO payment_settings DEFAULT VALUES;
