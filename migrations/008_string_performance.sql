-- v8: 球线性能数据库（来自 String.csv）
-- 新增 string_performance 表，保存第三方实测数据与 5 星制主观评价。
-- 与 string_models（穿线师手填评分）解耦，避免字段冲突。
CREATE TABLE IF NOT EXISTS string_performance (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  material TEXT,
  gauge REAL,
  test_lbs REAL,
  stiffness REAL,
  comfort INTEGER,
  tension_loss REAL,
  tension_retention INTEGER,
  energy_return REAL,
  power INTEGER,
  spin_potential REAL,
  spin INTEGER,
  s2s_cof REAL,
  ss_cof_rating INTEGER,
  s2b_cof REAL,
  sb_cof_rating INTEGER,
  feel INTEGER,
  control_v2 INTEGER,
  overall INTEGER
);

CREATE INDEX IF NOT EXISTS idx_perf_name ON string_performance(name);