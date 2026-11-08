-- v3 -> v4：穿线师用账号代替口令 + 账号名称 + 每条穿线记录谁穿的
--
-- 做的事：
--   1. users 加 display_name（账号名称）与 is_stringer（是否穿线师）
--   2. string_jobs 加 stringer_id / stringer_name（当时穿的谁，名字做快照）
--
-- 老账号不受影响：display_name 为空时前端回落到邮箱前缀，is_stringer 默认 0，
-- 想要穿线师权限就到登录页重新勾一次「我是穿线师」并输口令。

ALTER TABLE users ADD COLUMN display_name TEXT;
ALTER TABLE users ADD COLUMN is_stringer INTEGER NOT NULL DEFAULT 0;

ALTER TABLE string_jobs ADD COLUMN stringer_id INTEGER REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE string_jobs ADD COLUMN stringer_name TEXT;
