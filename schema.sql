-- 穿线球拍使用记录 · D1 (SQLite) 表结构 · v2
--
-- D1（SQLite）与 Postgres 的固有差异：
--   * UUID 不能由数据库生成（无 gen_random_uuid），由 Worker 用 crypto.randomUUID()
--   * TIMESTAMPTZ -> TEXT，存 ISO-8601（strftime('%Y-%m-%dT%H:%M:%fZ','now')）
--   * NUMERIC(4,1) -> REAL
--
-- v2 变更（品牌 + 子母线）：
--   * rackets 增加品牌字段 racket_brand / main_brand / cross_brand
--   * 主线、横线拆成两组独立字段：main_* 与 cross_*
--   * 不使用子母线时 cross_* 全为 NULL（不用空字符串，便于判断）
--   * 保留 string_model / tension 作为 v1 兼容镜像，由 Worker 与主线字段同步写入
--
-- 若你已经用 v1 建过表，不要重跑本文件，执行 migrations/002_hybrid_strings.sql。

CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS rackets (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  uuid          TEXT NOT NULL UNIQUE,
  racket_brand  TEXT,
  racket_model  TEXT NOT NULL,
  main_brand    TEXT,
  main_model    TEXT NOT NULL,
  main_tension  REAL NOT NULL,
  cross_brand   TEXT,
  cross_model   TEXT,
  cross_tension REAL,
  string_model  TEXT NOT NULL, -- v1 compatibility mirror of main_model
  tension       REAL NOT NULL, -- v1 compatibility mirror of main_tension
  strung_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  owner_id      INTEGER REFERENCES users(id) ON DELETE SET NULL,
  claimed_at    TEXT,
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS usage_logs (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  racket_uuid    TEXT NOT NULL REFERENCES rackets(uuid) ON DELETE CASCADE,
  duration_hours REAL NOT NULL,
  feedback       TEXT,
  temperature_c  REAL,
  logged_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_logs_uuid ON usage_logs(racket_uuid);
CREATE INDEX IF NOT EXISTS idx_rackets_owner ON rackets(owner_id);
