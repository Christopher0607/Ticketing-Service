ALTER TABLE listings ADD COLUMN proof_file bytea;
ALTER TABLE listings ADD COLUMN proof_type text CHECK (proof_type IN ('application/pdf','image/jpeg','image/png'));
ALTER TABLE listings ADD CONSTRAINT listing_proof_file_check CHECK (
  (proof_file IS NULL AND proof_type IS NULL) OR
  (proof_file IS NOT NULL AND proof_type IS NOT NULL AND octet_length(proof_file) <= 2097152)
);
ALTER TABLE orders ADD COLUMN support_resolution text;
ALTER TABLE orders ADD COLUMN support_confirmed_by uuid REFERENCES users(id);
ALTER TABLE orders ADD COLUMN support_confirmed_at timestamptz;
ALTER TABLE orders ADD COLUMN reconciled_at timestamptz;
