ALTER TABLE orders DROP CONSTRAINT orders_status_check;
ALTER TABLE orders ADD CONSTRAINT orders_status_check CHECK (status IN (
  'reserved','expired','cancelled','paid','delivered','confirmed','refund_requested',
  'refund_pending','refunded','disputed'
));
