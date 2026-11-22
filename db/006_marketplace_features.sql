-- Supabase Storage support, favourites, seller reviews, listing management,
-- venue details and account moderation.

-- Files can live in Supabase Storage (remote) instead of the database.
ALTER TABLE media ALTER COLUMN data DROP NOT NULL;
ALTER TABLE media ADD COLUMN remote boolean NOT NULL DEFAULT false;
ALTER TABLE media ADD CONSTRAINT media_payload CHECK (remote OR data IS NOT NULL);
ALTER TABLE orders ADD COLUMN receipt_path text;
ALTER TABLE listings ADD COLUMN proof_path text;
ALTER TABLE listings DROP CONSTRAINT listing_proof_file_check;
ALTER TABLE listings ADD CONSTRAINT listing_proof_file_check CHECK (
  (proof_file IS NULL AND proof_path IS NULL AND proof_type IS NULL) OR
  (proof_type IS NOT NULL AND (proof_file IS NOT NULL OR proof_path IS NOT NULL)
    AND (proof_file IS NULL OR octet_length(proof_file) <= 2097152))
);

-- Sellers can close a listing for good.
ALTER TABLE listings DROP CONSTRAINT listings_status_check;
ALTER TABLE listings ADD CONSTRAINT listings_status_check CHECK (status IN ('pending','active','rejected','paused','closed'));
ALTER TABLE listings ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();
CREATE INDEX listings_active_recent ON listings (created_at DESC) WHERE status = 'active';

ALTER TABLE events ADD COLUMN venue_address text;
ALTER TABLE events ADD COLUMN seatmap_id uuid REFERENCES media(id) ON DELETE SET NULL;
ALTER TABLE events ADD COLUMN created_at timestamptz NOT NULL DEFAULT now();
CREATE INDEX events_upcoming ON events (starts_at) WHERE active;

ALTER TABLE users ADD COLUMN banned_at timestamptz;
ALTER TABLE users ADD COLUMN terms_accepted_at timestamptz;

CREATE TABLE favorites (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_id uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  notified_at timestamptz,
  PRIMARY KEY (user_id, event_id)
);
CREATE INDEX favorites_event ON favorites (event_id);

CREATE TABLE reviews (
  order_id uuid PRIMARY KEY REFERENCES orders(id) ON DELETE CASCADE,
  seller_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  buyer_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rating smallint NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment text CHECK (comment IS NULL OR length(comment) <= 500),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX reviews_seller ON reviews (seller_id, created_at DESC);
