-- v2 -> v3：把「球拍」和「穿线」拆开
--
-- 做的事：
--   1. 建 string_jobs 表（每次穿线一条）
--   2. 把 rackets 上原有的 main_* / cross_* / strung_at 搬成该球的第一次穿线（is_current = 1）
--   3. usage_logs 加 string_job_id，并把历史记录回填到那一次穿线上
--   4. rackets 去掉线相关字段（球拍只留身份信息）
--
-- 顺序很重要：先搬数据，再删列。跑之前建议先导一份备份：
--   npx wrangler d1 export racket-logger --remote --output=backup-before-v3.sql
--
-- SQLite 的 DROP COLUMN 需要 3.35+，D1 已满足。若你的库报错，
-- 改用「新建 rackets_v3 → 复制 → 改名」的老办法即可，数据同样不丢。

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
  is_current    INTEGER NOT NULL DEFAULT 1,
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- 每支旧球拍 -> 一条穿线记录
INSERT INTO string_jobs (racket_id, main_brand, main_model, main_tension,
                         cross_brand, cross_model, cross_tension, strung_at, is_current, created_at)
SELECT r.id, r.main_brand, r.main_model, r.main_tension,
       r.cross_brand, r.cross_model, r.cross_tension, r.strung_at, 1, r.created_at
  FROM rackets r;

-- 历史使用记录挂到这一次穿线上
ALTER TABLE usage_logs ADD COLUMN string_job_id INTEGER REFERENCES string_jobs(id) ON DELETE SET NULL;

UPDATE usage_logs
   SET string_job_id = (
     SELECT sj.id
       FROM string_jobs sj
       JOIN rackets r ON r.id = sj.racket_id
      WHERE r.uuid = usage_logs.racket_uuid
      LIMIT 1
   )
 WHERE string_job_id IS NULL;

-- 球拍表只保留身份信息
ALTER TABLE rackets DROP COLUMN main_brand;
ALTER TABLE rackets DROP COLUMN main_model;
ALTER TABLE rackets DROP COLUMN main_tension;
ALTER TABLE rackets DROP COLUMN cross_brand;
ALTER TABLE rackets DROP COLUMN cross_model;
ALTER TABLE rackets DROP COLUMN cross_tension;
ALTER TABLE rackets DROP COLUMN strung_at;

CREATE INDEX IF NOT EXISTS idx_logs_job ON usage_logs(string_job_id);
CREATE INDEX IF NOT EXISTS idx_jobs_racket ON string_jobs(racket_id, strung_at DESC);
