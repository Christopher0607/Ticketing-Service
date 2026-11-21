ALTER TABLE users ADD COLUMN email_verified boolean NOT NULL DEFAULT false;
ALTER TABLE users ADD COLUMN stripe_ready boolean NOT NULL DEFAULT false;
UPDATE users SET email_verified=true WHERE role='admin';

CREATE TABLE email_tokens (
  token_hash text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  purpose text NOT NULL CHECK (purpose IN ('verify','reset')),
  expires_at timestamptz NOT NULL
);
CREATE INDEX email_tokens_user ON email_tokens (user_id, purpose);
