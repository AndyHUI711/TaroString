-- 迁移 002：给已有的 v1 表加上「品牌 + 子母线」字段
--
-- 适用：你之前已经执行过 v1 的 schema.sql（本地或云端已有数据）。
-- 执行：
--   npx wrangler d1 execute racket-logger --local  --file=./migrations/002_hybrid_strings.sql
--   npx wrangler d1 execute racket-logger --remote --file=./migrations/002_hybrid_strings.sql
--
-- 旧的 string_model / tension 列保留不动（新代码不再读写它们），
-- 其值会被复制到 main_model / main_tension，历史记录不会丢。

ALTER TABLE rackets ADD COLUMN racket_brand TEXT;
ALTER TABLE rackets ADD COLUMN main_brand TEXT;
ALTER TABLE rackets ADD COLUMN main_model TEXT;
ALTER TABLE rackets ADD COLUMN main_tension REAL;
ALTER TABLE rackets ADD COLUMN cross_brand TEXT;
ALTER TABLE rackets ADD COLUMN cross_model TEXT;
ALTER TABLE rackets ADD COLUMN cross_tension REAL;

-- 把旧的单线数据搬进主线字段
UPDATE rackets
   SET main_model   = string_model,
       main_tension = tension
 WHERE main_model IS NULL;
