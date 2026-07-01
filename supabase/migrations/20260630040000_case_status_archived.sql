-- Add ARCHIVED to the case status lifecycle. MUST be applied alone: a newly
-- added enum value cannot be used in the same transaction it is created in.
ALTER TYPE case_status ADD VALUE IF NOT EXISTS 'ARCHIVED';
