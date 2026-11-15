-- Remove v1 string columns left behind when v2 -> v3 migrated data to string_jobs.
--
-- Prerequisite: migrations/003_string_jobs.sql has run and copied each racket's
-- string details into string_jobs. The Worker no longer reads or writes these
-- legacy columns; keeping them NOT NULL prevents new racket inserts.

ALTER TABLE rackets DROP COLUMN string_model;
ALTER TABLE rackets DROP COLUMN tension;
