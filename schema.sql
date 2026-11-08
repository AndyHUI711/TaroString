-- 穿线球拍记录 · D1 (SQLite) 表结构 · v4
--
-- v3 核心变化：把「球拍」和「穿线」拆成两层
--   rackets      放长期不变的球拍信息与球拍码（uuid）。这个码贴在拍框上，重穿也不换。
--   string_jobs  一次穿线一条记录（线、磅数、穿线时间）。重穿 = 给同一支拍加一条 job。
--   usage_logs   每条使用记录挂到当时的 job 上，所以「这一次穿线用了多久」能单独统计。
--
-- D1（SQLite）与 Postgres 的固有差异（v1 起就存在，无法避免）：
--   * UUID 不能由数据库生成（无 gen_random_uuid），由 Worker 用 crypto.randomUUID()
--   * TIMESTAMPTZ -> TEXT，存 ISO-8601
--   * NUMERIC(4,1) -> REAL
--
-- 若你已经建过 v1 / v2 的表，不要重跑本文件，执行对应迁移：
--   v1 -> v2：migrations/002_hybrid_strings.sql
--   v2 -> v3：migrations/003_string_jobs.sql
--   v3 -> v4：migrations/004_stringer_accounts.sql

CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  display_name  TEXT,                 -- 账号名称（穿线师显示给客户看）
  is_stringer   INTEGER NOT NULL DEFAULT 0,  -- 1 = 穿线师（注册时勾选 + 输入口令）
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- 球拍：一支拍只有一条，重穿不改这里（uuid 就是这个拍的永久编号）
CREATE TABLE IF NOT EXISTS rackets (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  uuid          TEXT NOT NULL UNIQUE,
  racket_brand  TEXT,
  racket_model  TEXT NOT NULL,
  owner_id      INTEGER REFERENCES users(id) ON DELETE SET NULL,
  claimed_at    TEXT,
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- 穿线：一次穿线一条。is_current = 1 表示现在拍上这一根线
CREATE TABLE IF NOT EXISTS string_jobs (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  racket_id     INTEGER NOT NULL REFERENCES rackets(id) ON DELETE CASCADE,
  main_brand    TEXT,
  main_model    TEXT NOT NULL,
  main_tension  REAL NOT NULL,
  cross_brand   TEXT,
  cross_model   TEXT,
  cross_tension REAL,
  strung_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  stringer_id   INTEGER REFERENCES users(id) ON DELETE SET NULL,
  stringer_name TEXT,                 -- 当时穿的谁（快照，账号改名不影响历史）
  is_current    INTEGER NOT NULL DEFAULT 1,
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS usage_logs (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  racket_uuid    TEXT NOT NULL REFERENCES rackets(uuid) ON DELETE CASCADE,
  string_job_id  INTEGER REFERENCES string_jobs(id) ON DELETE SET NULL,
  duration_hours REAL NOT NULL,
  feedback       TEXT,
  temperature_c  REAL,
  logged_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_logs_uuid ON usage_logs(racket_uuid);
CREATE INDEX IF NOT EXISTS idx_logs_job ON usage_logs(string_job_id);
CREATE INDEX IF NOT EXISTS idx_rackets_owner ON rackets(owner_id);
CREATE INDEX IF NOT EXISTS idx_jobs_racket ON string_jobs(racket_id, strung_at DESC);
