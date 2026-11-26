-- Company details for the footer, About page and legal pages. Edited in the admin settings; while empty,
-- the site shows no company details and the legal pages use wording without them.
CREATE TABLE company_settings (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  name text,
  reg_no text,
  address text
);
INSERT INTO company_settings DEFAULT VALUES;
