-- ============================================================
-- FILE: 20260817000005_add_paid_to_payment_status.sql
-- PURPOSE: Add 'paid' value to payment_status enum to align with
--          public invoice RPC queries and payment verification states.
-- ============================================================

ALTER TYPE payment_status ADD VALUE IF NOT EXISTS 'paid';
