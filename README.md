# 穿线球拍记录（TARO 穿线台）

给个人穿线师用的小站：每支穿好的球拍生成唯一编号与二维码，客户扫码**不用注册**就能看球拍信息、记录这次用了几小时；穿线师和客户登录后可以把球拍认领到自己名下，看累计使用时长。

- 运行时：Cloudflare Worker（同时托管静态资源与 `/api/*`）
- 数据库：Cloudflare D1（SQLite）
- 认证：自建，PBKDF2-SHA256 + JWT，httpOnly cookie
- 天气：Open-Meteo（无需 Key）
- 多语言：繁體中文（默认）/ 简体中文 / English，切换即时生效
- 费用：Workers Free + D1 Free + 一个域名，月费 0

穿线师这边支持：**球拍品牌**、**球线品牌**下拉（最后一项「其他品牌…」可手输）、**主线 / 横线分别填写型号与磅数**（不勾「子母线」时横竖同线同磅）。

---

## 一、与原始需求文档的差异（都是 D1 / Workers 环境导致的，无法避免）

| 原始规格 | 本实现 | 原因 |
|---|---|---|
| Next.js 15 + Neon Postgres + Vercel | 单 Worker + D1 + Cloudflare | 你的部署方案定的 Cloudflare；D1 是 SQLite |
| `DEFAULT gen_random_uuid()` 数据库生成 UUID | Worker 里 `crypto.randomUUID()` 生成再入库 | SQLite 无 `gen_random_uuid()`。仍是**服务端**生成、仍不可枚举 |
| `TIMESTAMPTZ` | `TEXT` 存 ISO-8601（`strftime('%Y-%m-%dT%H:%M:%fZ','now')`） | SQLite 无时间类型 |
| `NUMERIC(4,1)` | `REAL` | SQLite 无定点decimal |
| bcryptjs（cost 10） | PBKDF2-SHA256，25000 轮 | 免费档每次请求仅 10ms CPU，bcryptjs 会超时导致登录失败 |
| `qrcode` npm 包 | `qrcode-generator`（纯 JS，输出 GIF DataURL） | `qrcode` 依赖 Node 的 fs/buffer，Worker 里跑不起来 |
| Tailwind CSS | 手写 CSS（`public/style.css`） | 不加构建步骤，部署链路最短、最不容易出错 |
| Neon tagged template | `db.prepare(...).bind(...)` | D1 的 API，同样**全部参数化**，无字符串拼接 |

> `schema.sql` 里保留了原规格的索引与级联删除语义：`usage_logs` 随球拍删除级联、`owner_id` 置空。

## 二、目录结构

```
racket-logger/
├─ src/index.js          # Worker：路由 + 接口 + 页面分发
├─ schema.sql            # D1 建表
├─ wrangler.toml         # 绑定 D1、静态资源、兼容日期
├─ public/
│  ├─ index.html         # /        穿线台（口令 + 表单 + 二维码；?racket= 为重穿预填）
│  ├─ list.html          # /list    穿线师总览：所有球拍 + 每支的穿线历史
│  ├─ r.html             # /r/{uuid} 客户扫码页（按球拍码，含穿线历史与建议）
│  ├─ login.html         # /login   登录 / 注册切换
│  ├─ my.html            # /my      我的球拍（云端数据）
│  ├─ local.html         # /local   本机球拍（浏览器留存）
│  ├─ client.js          # 接口封装、本机留存、定位、提示
│  ├─ i18n.js            # 繁體 / 简体 / English 字典 + 语言切换 + 日期磅数格式化
│  ├─ brands.js          # 球拍品牌、球线品牌、常用线型号清单 + 品牌下拉控件
│  ├─ health.js          # 穿线建议：健康度 + 温度/手感修正磅数（纯前端计算）
│  └─ style.css
├─ migrations/
│  ├─ 002_hybrid_strings.sql   # v1 -> v2：品牌 + 子母线
│  └─ 003_string_jobs.sql      # v2 -> v3：球拍 ID 与穿线 ID 拆成两层
└─ package.json
```

## 三、部署（约 10 分钟，不需要买域名）

```bash
npm install
npx wrangler login

# 1. 建库，记下返回的 database_id，填进 wrangler.toml（不填 deploy 会报错）
npx wrangler d1 create racket-logger

# 2. 建表 —— --remote 不能漏，漏了就是在本地库建表、云端还是空的
npx wrangler d1 execute racket-logger --remote --file=./schema.sql

# 3. 两个敏感配置（不要写进 wrangler.toml，也不要提交 git）
npx wrangler secret put SESSION_SECRET    # 至少 32 位随机串
npx wrangler secret put ADMIN_TOKEN       # 后台口令，建议 12 位以上

# 4. 发布
npx wrangler deploy
```

随机串生成方式：

- macOS / Linux：`openssl rand -hex 32`
- Windows PowerShell：`node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`

### 3.1 没有域名怎么办

**不用买。** Cloudflare 免费给 `workers.dev` 子子域，自带 HTTPS，这就是正式地址：

```
https://taro-stringing.<账号子域>.workers.dev
```

子域名可以在 Dashboard 里改成短名字（例如 `taro`），地址随之变成
`https://taro-stringing.rackets.workers.dev` —— 字符越少，二维码越稀、越容易扫。

以后真要买域名（`.com` 约 US$10/年，Cloudflare Registrar 按成本价、续费不加价）再绑：

> Dashboard → Workers & Pages → 该 Worker → Settings → Domains & Routes → Add Custom Domain。

**换域名或从 workers.dev 换成自有域名后，必须重新生成全部二维码** —— 二维码里的地址是按当前访问域名实时算的，旧码仍指向旧地址。

> ⚠️ `workers.dev` 域名在中国大陆访问不稳定（经常打不开）。客户主要在港澳/海外可以直接用；**如果客户在大陆，先让对方手机打开一次再印码**，码贴到拍框上就改不了了。

### 3.2 GitHub 仓库 + 自动部署（push 即上线）

GitHub 这套架构里的角色是**代码仓库 + 部署触发器**，不是主机 —— GitHub Pages 只能托管静态文件，跑不了登录校验、D1 写入、二维码生成。真正执行部署的是 Cloudflare。

**一、推代码到 GitHub**

```bash
git init
git add .
git status                 # 确认列表里没有 .dev.vars / node_modules / .wrangler
git commit -m "init: racket logger"
git branch -M main
git remote add origin git@github.com:<你的账号>/racket-logger.git
git push -u origin main
```

- `.gitignore` 已经排除了 `.dev.vars`、`.wrangler/`、`node_modules/`
- `wrangler.toml` **要提交**：里面的 `database_id` 不是密钥，构建时需要它
- 仓库可以私有，Cloudflare Builds 支持连私有库

**二、在 Cloudflare 连接仓库**

> Dashboard → Workers & Pages → 点进 `racket-logger` → Settings → Builds → Connect Git

填写：

| 项 | 值 |
|---|---|
| 仓库 / 分支 | `racket-logger` / `main` |
| Build command | `npm ci` |
| Deploy command | `npx wrangler deploy` |
| Root directory | 留空（仓库根目录就是项目根目录时） |

两个密钥**不需要**在这里再配一遍 —— 它们已经用 `wrangler secret put` 存在 Worker 上了。

**三、之后每次改动**

```bash
git add -A && git commit -m "改了什么" && git push
```

推送即构建，几十秒后生效。**不要在 CI 里跑 `d1 create` 或建表语句** —— 数据库只建一次，重复执行会出错。

### 3.3 本地开发（VS Code）

```bash
npm install
cp .dev.vars.example .dev.vars                       # 填 SESSION_SECRET / ADMIN_TOKEN
npx wrangler d1 execute racket-logger --local --file=./schema.sql   # 只做一次
npm run dev                                          # http://localhost:8787
```

`http://localhost:8787` 是穿线台，输入 `.dev.vars` 里的 `ADMIN_TOKEN` 就能生成二维码；点「预览页面」进 `/r/{uuid}` 看客户视角。

**手机真机扫码**：默认只监听本机，二维码里写的是 `127.0.0.1`，手机打不开。换成

```bash
npx wrangler dev --ip 0.0.0.0 --port 8787
```

然后用电脑局域网 IP 打开（`http://192.168.x.x:8787`），生成的二维码就是局域网地址，手机同一 Wi-Fi 可扫。

**本地会遇到的"看着像 bug 但正常"的现象：**

| 现象 | 原因 |
|---|---|
| 复制链接按钮提示失败 | `navigator.clipboard` 在 http 下被禁用，上线 https 后正常 |
| 第一次带定位提交，温度是空 | 本地首次出网偶发慢，撞上 4 秒超时；逻辑正确，再提交一次就有温度 |
| 定位弹窗被拒 | 拒绝不影响提交，只是不带温度 |

**查本地数据 / 重置：**

```bash
npx wrangler d1 execute racket-logger --local --command "SELECT * FROM usage_logs ORDER BY id DESC LIMIT 10"
# 重置：停服务，删掉 .wrangler 文件夹，再执行一次 --local 建表
```

### 3.4 日常运维

```bash
npx wrangler deployments list    # 历史版本
npx wrangler rollback            # 出问题回滚到上一版
npx wrangler tail                # 实时看线上日志
npx wrangler d1 export racket-logger --remote --output=backup-2026-11-07.sql
```

**建议每月导出一份 SQL 备份存本地。** 这些数据是客户的穿线历史，丢了补不回来；免费档虽有 30 天时间旅行恢复能力，自己手里有一份更稳。

## 四、接口

| 方法 | 路径 | 鉴权 | 说明 |
|---|---|---|---|
| POST | `/api/rackets` | ADMIN_TOKEN | 建球拍，返回球拍码 `uuid` + 第一条穿线 `job_id`；口令错 401，字段缺 400（错误一律带 `error_code`） |
| POST | `/api/rackets/:uuid/jobs` | ADMIN_TOKEN | **同一支拍再穿一次**：球拍码不变，新增一条穿线并成为「现在这根」 |
| POST | `/api/rackets/list` | ADMIN_TOKEN | 穿线师总览：所有球拍 + 每支的穿线历史（`jobs_by_racket` 以球拍码为 key） |
| GET | `/api/rackets/:uuid` | 无 | 球拍详情（当前穿线平铺）+ `jobs` 全部穿线 + 记录（倒序）+ `current_job_id` + `scan_url` |
| POST | `/api/rackets/:uuid/logs` | **无（匿名核心）** | 提交时长，自动附温度；时长非法 400 |
| POST | `/api/rackets/:uuid/claim` | 登录 | 认领；未登录 401，已被认领 409 |
| GET | `/api/my` | 登录 | 名下球拍 + 累计时长 / 记录数 |
| POST | `/api/auth/register` / `login` / `logout` | 无 | 注册重复邮箱 409，登录失败 401 |
| GET | `/api/qrcode?uuid=` | 无 | `data_url`（GIF）+ `scan_url` |
| GET | `/api/me` | 无 | 当前是否登录（页面用来决定按钮文案） |
| POST | `/api/rackets/lookup` | 无 | 批量查摘要，供「本机球拍」页使用（≤20 个） |

## 五、两个刻意做的地方

**1. 匿名优先。** 扫码页顶部明确写「不用注册、不用登录」。`logs` 接口没有任何登录校验，UUID 就是凭证（不可枚举）。账号只用于「把球拍认领到自己名下」这一个动作。

**2. 本机球拍（cookie + localStorage）。** 客户扫过一次后，`client.js` 会把 uuid 记进浏览器的 localStorage，同时写一份 uuid 列表到 cookie（1 年，`SameSite=Lax`）作为 localStorage 被清掉时的兜底。于是客户下次打开站点、点「本机球拍」，就能直接找到自己的拍子 —— 不必保存二维码链接，也不需要账号。

- 只存 uuid，不存任何个人信息
- 换手机 / 清浏览器就没了，这是有意的：没有账号就没有跨设备同步的承诺
- 页面底部有「清空本机记录」，只清浏览器，不动服务端数据

## 六、后续接入 AI（已预留的位置）

现在的数据已经够喂给模型了：每支球拍的磅数、线型、每次使用时长、温度、客户手感反馈，都在 `usage_logs` 里。要加「AI 建议 / 网球分析」时，只需要：

1. 在 `wrangler.toml` 加 Workers AI 绑定：
   ```toml
   [ai]
   binding = "AI"
   ```
2. 在 `src/index.js` 加一个 `/api/rackets/:uuid/analysis` 路由，把该球拍最近 N 条记录拼成提示词，调 `env.AI.run(...)`，**仍然保持 GET 只读、不影响匿名提交路径**。
3. 前端只在球拍页加一个「查看分析」按钮，避免把 AI 调用塞进提交链路里拖慢记录写入。

这样做的原因是：匿名提交必须永远可用且快，AI 是增值功能，失败也不能影响记录。

## 七、免费档需要注意的边界

| 项目 | 免费额度 | 对你这套够不够 |
|---|---|---|
| Workers 请求 | 10 万/天 | 够（一天上千次都算多） |
| Workers CPU | **10ms/请求** | 够用；所以密码哈希只能用 PBKDF2 25k 轮。**升级 Paid 后建议把 `PBKDF2_ITERATIONS` 提到 100000+** |
| D1 写入 | 10 万行/天 | 够（一条记录 = 1 行） |
| D1 读取 | 500 万行/天 | 够 |
| D1 存储 | 5GB 总量 / **单库 500MB** | 纯文本记录，几十万条也到不了 |
| 出网流量 | 无限制 | — |

## 八、验收自测（本地已跑通）

- [x] 错误口令 → 401；正确口令 → 返回 UUID
- [x] 二维码：272×272 GIF DataURL，`scan_url` = 当前域名 + `/r/{uuid}`
- [x] 未登录访问球拍页 → 200，能看到型号 / 线型 / 磅数 / 穿线时间 / 未认领状态
- [x] 未登录提交记录 → 成功入库，列表倒序显示
- [x] 有定位 → 记录带温度（实测 26.5°C）；无定位 / 天气失败 → `temperature_c = NULL`，记录照样成功
- [x] 未登录点认领 → 401；页面引导去登录
- [x] 注册后认领 → 成功，状态变为「已认领 ta***」
- [x] 第二个用户认领同一支 → 409「这支球拍已被认领」
- [x] `/api/my` 未登录 401，登录后返回累计 3.5 小时 / 2 条记录
- [x] 登出后再访问 `/api/my` → 401
- [x] `/`、`/login`、`/my`、`/local`、`/r/{uuid}` 均返回 200 HTML
- [x] 注册重复邮箱 → 409；时长 0 → 400

## 九、上线前请自己再做一次

- [ ] 手机扫码，确认二维码能被微信 / 相机扫出（屏幕和打印都比一遍）
- [ ] 拒绝定位后提交一次，确认页面提示「未获取到温度，不影响记录」
- [ ] 用另一个邮箱认领同一支，确认 409 的提示文案客户能看懂
- [ ] 绑定自有域名后重新生成二维码，把旧码全部作废

## 十、v2 更新：品牌 / 子母线 / 多语言

### 10.1 球拍品牌与球线品牌

- 前端的候选项都在 `public/brands.js` 里：`RACKET_BRANDS`、`STRING_BRANDS`、`STRING_MODELS`。
- 品牌控件是「下拉 + 其他品牌手输」：下拉最后一项是「其他品牌…」，选中后旁边出现输入框，想加新品牌可以不改代码直接手输。
- 线型号输入框都挂了 `datalist`（`STRING_MODELS`），常用型号可以直接选，也可以手打新型号。清单只是**建议值**，后端不做白名单校验 —— 以后出了新线不用发版。
- 想扩自己的常用清单，直接编辑 `brands.js` 里那三个数组，刷新页面即生效（没有构建步骤）。

### 10.2 子母线（横竖不同线、不同磅数）

穿线台勾上「子母线」后会多出一组横线字段（横线品牌 / 横线型号 / 横线磅数）。数据层是这样处理的：

| 情况 | 存库 | 页面显示 |
|---|---|---|
| 不勾子母线 | `main_brand` / `main_model` / `main_tension` 有值，`cross_*` 全部 NULL | 一行「主线」 |
| 勾了子母线 | 主线、横线两组都有值 | 「主线」「横线」各一行 |

- 校验：勾了子母线但横线型号或横线磅数没填 → 400 `CROSS_MODEL_REQUIRED` / `CROSS_TENSION_REQUIRED`。
- 兼容旧字段：调用 `/api/rackets` 时如果传的是老字段名 `string_model` / `tension`，会被当成主线读入，不会报错。

### 10.3 多语言（繁體 / 简体 / English，默认繁體）

- **默认就是繁體**，不需要任何配置：`getLang()` 依次看 `?lang=` → localStorage `rl_lang` → cookie `rl_lang` → 落到 `zh-Hant`。
- 顶栏右侧有下拉（繁 / 简 / EN），选中后写 localStorage + cookie 并重载当前页；重载会保留 `next=` 之类的参数，只去掉 `lang=`。
- 页面文案统一用 `data-i18n`、`placeholder` 用 `data-i18n-ph`，JS 里用 `t(key, vars)`。
- **接口报错也做了本地化**：后端统一返回 `{ error_code, error }`，前端 `errText(data)` 用 `error_code` 查字典（`err.TOKEN_INVALID` 之类），查不到才用后端的中文兜底。这样改文案不会前后端两头改。
- 日期统一 `YYYY/MM/DD HH:mm`，三种语言都用同一套数字格式（避免 11/08 与 08/11 的歧义）；磅数在 EN 下显示 `lbs`，中文下显示「磅」。

### 10.4 数据库升级（已经上线过的库必须执行一次）

全新的库直接 `schema.sql` 建表即可，不用迁移。**如果之前已经跑过 v1 的 `schema.sql`**（表里只有 `string_model` / `tension`），执行迁移：

```bash
# 本地库
npx wrangler d1 execute racket-logger --local --file=./migrations/002_hybrid_strings.sql

# 线上库
npx wrangler d1 execute racket-logger --remote --file=./migrations/002_hybrid_strings.sql
```

迁移做的事：`ALTER TABLE` 补上 `racket_brand`、`main_*`、`cross_*` 七列，并把旧的 `string_model` / `tension` 搬到 `main_model` / `main_tension` —— **历史球拍和记录都不会丢**，改造后照样打得开。已在临时 v1 库上验证过：迁移后 `main_model = 'ALU Power'`、`main_tension = 47.5`、`cross_model = NULL`，新列齐全。

### 10.5 这一版的验收（本地已跑通）

- [x] 不勾子母线建拍 → `cross_*` 全部 NULL，球拍页只显示一行主线
- [x] 勾子母线建拍（Luxilon ALU Power 48 / Babolat Xcel 46）→ 球拍页显示「主線」「橫線」两行，`/api/my` 也带上横线字段
- [x] 勾子母线但漏填横线磅数 → 400 `CROSS_TENSION_REQUIRED`（前端翻成对应语言）
- [x] 传老字段 `string_model` / `tension` → 正常建拍，落库到 `main_*`
- [x] `?lang=en` 打开球拍页 → 全英文（Main (vertical) / Cross (hybrid) / 48 lbs）
- [x] 默认不带 lang → 繁體；顶栏语言下拉可切换并持久
- [x] 五个页面 + `i18n.js`、`brands.js`、`client.js`、`style.css` 全部 200
- [x] 118 个界面文案键在繁 / 简 / EN 三份字典里全部有对应，无漏译（脚本扫过）

### 10.6 客戶掃碼頁：簡化 + 按鈕化（`public/r.html`）

客戶端只保留三件事：**看到球拍、按兩下記錄、看到累計**。所以這一版做了這些改動：

| 改動 | 做法 |
|---|---|
| 累計使用時長放在最上方 | 標題下面一排「累計使用 / 條記錄」大字塊，用的是該球拍全部記錄的總和；提交完立刻更新 |
| 時長不用自己打字 | 預設 **1 小時**，只留「− / ＋」兩個按鈕，每次 **0.5 小時**，範圍 0.5–12 小時；到頭時按鈕自動變灰 |
| 反饋改成按鍵多選 | 16 個標籤，可任意多選（也允許全不選）：「舒適、太硬、太軟、太彈、沒彈性、震手、偏悶、控制好、旋轉夠、旋轉不足、旋轉太多、力量不足、力量太猛、掉磅快、線易斷、走線」 |
| 頁面變短 | 去掉自由文本框、去掉定位說明塊、去掉「本機已記住」卡片，認領收成一條底欄 |

**反饋怎麼存**：後端 `feedback` 還是同一個 TEXT 欄位，沒有改表。前端把選中的標籤用 `|` 連起來，例如 `comfort|spinLow|tensionLoss`。這樣做的好處是——

- 客戶之後切成英文，記錄裡的標籤會跟著顯示成英文（存的是 key，不是中文句子）
- 舊的自由文字記錄也照樣顯示（不含 `|` 就當成一整段文字）
- 遇到不認識的 key 原樣顯示，不會變空白

**要加標籤**只改兩個地方：`public/i18n.js` 裡的 `FEEDBACK_KEYS`（決定按鈕順序）與三份字典裡的 `fb.xxx`（決定各語言文案）。不用動後端，也不用改 `r.html`。

### 10.7 這一版的驗收（本地已跑通）

- [x] 新建球拍後打開掃碼頁：預設 1 小時、16 個標籤按鈕齊全、累計與條數顯示正確
- [x] 提交 `comfort|spinLow|tensionLoss` → 入庫原樣保存，記錄列表回顯成三個小標籤
- [x] 累計時長 = 全部記錄相加（實測 0.5 + 1 + 2 = 3.5 小時 / 3 條）
- [x] 繁體 / 简体 / English 三語的標籤與說明全部正常，無漏譯（腳本掃 130 個鍵、三份字典各 169 條）
- [x] 手機寬度（約 375–430）下標籤自動換行，頂欄換行不裁切，無橫向溢出
- [x] 五個頁面全部 200

### 10.8 穿線建議：線的健康度 + 下次磅數（`public/health.js`）

掃碼頁底部多了一張「穿線建議」卡片，兩塊內容：**線的狀態**（進度條 + 三檔評語 + 為什麼）與**下次磅數**（建議數字 + 為什麼）。全部由 `public/health.js` 的純函式算，**不寫庫、不新增接口**，資料就是球拍詳情裡已有的 `strung_at`、每條記錄的時長 / 溫度 / 反饋。

**健康度**

```
用量進度 = 累計小時 / 該線種壽命小時
時間進度 = 穿線天數 / 該線種保質天數
磨損     = max(兩者)          ← 取更累的那條
基礎分   = 100 - 100 × 磨損
健康度   = clamp(基礎分 - 老化扣分, 0, 100)
```

取最大值而不是平均：聚酯線打得少也會自己掉磅，打得多時間短也照樣疲勞，兩者不會互相抵消。子母線取主線、橫線裡分數低的那條（哪條先到期，整支拍就先廢），並在理由裡注明「先到期的是橫線」。

| 線種 | 壽命小時 | 保質天數 |
|---|---|---|
| 聚酯 / co-poly | 12 h | 60 天 |
| 仿羊腸 multifilament | 16 h | 90 天 |
| 合成腸 synthetic gut | 20 h | 100 天 |
| 天然羊腸 | 25 h | 120 天 |

**反饋分成兩類，這是這套邏輯最關鍵的地方**

- **線老化（扣健康度）**：掉磅快 −18、沒彈性 −15、線易斷 −22、走線 −10、偏悶 −6
- **配磅不合適（不扣健康度，只影響磅數）**：太硬、太軟、太彈、沒力量、力量太猛、旋轉不足、震手

「太硬」不是線壞了，是磅數配錯了 —— 扣健康度會誤導客戶以為該換線。同一標籤無論客戶點幾次只扣一次。

**評語三檔**：≥60 還很有活力、30–59 開始掉磅了、<30 建議重穿（用狀態詞而不是百分比，客戶看得懂）。

**磅數建議**

```
下次磅數 = 目前磅數 + 溫度修正 + 手感修正（總和夾在 ±3 磅，範圍 30–70）
```

- **溫度修正**：以 22°C 為基準，每 5°C 約差 1 磅，最多 ±2 磅。熱於基準 → **加**磅（線床更彈、球飛更遠，加磅才控得住）；冷於基準 → **降**磅（線床偏硬、球「死」，降磅更好發力、也少震手）。氣溫取最近 5 條**有溫度記錄**的平均，樣本少於 2 條就不給溫度建議，並明說「沒有氣溫資料，這次只按手感」。
- **手感修正**：太彈 / 太軟 / 力量太猛 → +2；太硬 / 震手 / 沒力量 → −2；走線 → +1；線易斷 → −1。同一組只算一次，避免客戶點三個「太彈」就要加 6 磅。
- **掉磅快不靠加磅解決**：文案會直接說「換線比加磅更有效」。

**參數都在 `public/health.js` 頂部**：`LINE_LIFE`、`WEAR_PENALTY`、`TEMP_REFERENCE_C`、`TEMP_LBS_PER_DEGREE`、`TENSION_DELTA_CAP`。這些是經驗值不是物理常數，你按香港客戶的節奏改數字即可，改完刷新就生效。

**已知限制**：線種目前靠線型號關鍵詞推斷（`guessStringType`，涵蓋 ALU Power、RPM Blast、Tour Bite、X-One、NXT、Synthetic Gut 等常見型號，猜不到按聚酯處理）。要更準就在建拍時加一個「線種」下拉落庫，把這個函式換掉。

### 10.9 這一版的驗收（本地已跑通）

- [x] 剛穿好、只有 1 條記錄 → 顯示「多打幾次之後…」，不給沒意義的高分
- [x] 聚酯線穿 8 週 / 打了 10 小時 / 熱天 30°C / 客戶點「太彈」→ 健康度 7%（建議重穿），磅數 48 → 51（熱 +2、太彈 +2，夾到 +3）
- [x] 子母線（X-One 52 / ALU 48）穿 4 週 / 4.5 小時 / 冷天 15°C / 「太硬、震手、掉磅快」→ 健康度 32%（開始掉磅），並注明「先到期的是橫線」；磅數建議主線 49 / 橫線 45（冷 −2、太硬 −2，夾到 −3）
- [x] 線種推斷：VS Touch → natural gut、X-One → multifilament、Synthetic Gut PPS → synthetic gut、未知型號 → poly
- [x] 沒有溫度記錄時只給手感建議，並顯示「沒有氣溫資料」
- [x] 繁體 / 简体 / English 全部正常（腳本掃 157 個用到的鍵、三份字典各 198 條，零漏譯）

## 十一、v3 更新：球拍 ID 与穿线 ID 拆成两层

### 11.1 为什么要拆

v2 的一支拍只有一个 `uuid`，它同时是「球拍编号」和「这次穿线的编号」。结果就是：每重穿一次就得生成一个新码、重新打印、重新贴上拍框 —— 客户手机里存的还是旧码，旧码指向的是一次已经废掉的穿线。

v3 拆开：

| 概念 | 存哪 | 变不变 | 谁在用 |
|---|---|---|---|
| **球拍 ID**（球拍码 `uuid`） | `rackets.uuid` | **一辈子不变** | 贴在拍框上的二维码、客户存的链接 |
| **穿线 ID**（`string_jobs.id`） | `string_jobs.id` | 每次重穿 +1 条 | 后台区分「这是第几次穿的线」、健康度只看这一次 |

所以二维码永远指向 `/r/{球拍码}`。重穿不换码，贴纸不用动。

### 11.2 表结构（v3）

```sql
rackets(id, uuid, racket_brand, racket_model, owner_id, claimed_at, created_at)

string_jobs(id, racket_id, main_brand, main_model, main_tension,
            cross_brand, cross_model, cross_tension,
            strung_at, is_current, created_at)   -- is_current=1 是现在拍上这一根

usage_logs(id, racket_uuid, string_job_id, duration_hours, feedback, temperature_c, logged_at)
```

- 线、磅数、穿线时间这些「每次会变的东西」全在 `string_jobs`，`rackets` 只剩身份信息。
- `usage_logs` 同时保留 `racket_uuid`（按拍查全部记录）和 `string_job_id`（按这一次穿线查）。
- 新记录自动挂到 `is_current = 1` 的那条穿线上，所以换了线以后，「这一次穿线用了多久」是干净的，健康度不会被上一根线的用量拖累。

### 11.3 从 v2 升上来（已经上线过就必须跑一次）

```bash
npx wrangler d1 export racket-logger --remote --output=backup-before-v3.sql   # 先备份
npx wrangler d1 execute racket-logger --remote --file=./migrations/003_string_jobs.sql
```

`003` 做四件事：建 `string_jobs`、把每支旧球拍现有的线/磅数/穿线时间搬成它的第一条穿线（`is_current=1`）、给 `usage_logs` 加 `string_job_id` 并回填到那条穿线上、把 `rackets` 里的线字段删掉（SQLite `DROP COLUMN`，D1 支持）。

已在 v2 测试库上跑过：迁移后 `main_model='ALU Power'`、`main_tension=47.5`、子母线那支 `cross_model='ALU Power'` / `cross_tension=48`；历史两条记录都挂到了正确的那条穿线上，一条没丢。

**旧的二维码还能用。** 迁移后旧的每个 uuid 变成一个球拍（里面装着它当时那一次穿线），扫旧码照常打开、照常记录。只是如果 v2 时期同一支拍穿过两次、印过两张码，它们在库里是两支「球拍」——想让它们合并成一支，只能手工把 `usage_logs.racket_uuid` 改到留下的那个码上，再删掉多余那支。要不要做，看你手上的旧码有多少。

### 11.4 穿线师的两个新入口

**① 扫上一次的码，直接预填重穿**（`/?racket=<球拍码>`）

穿线师用手机扫客户拍框上的码（或客户发来的链接），页面上有一个「再穿一次」按钮 → 跳到穿线台，并且：

- 球拍品牌、型号已经填好并锁起来（这两项不该跟着线变）
- **主线 / 横线 / 磅数全部带出上一次的值**，子母线会自动勾上
- 只需要改要改的数字，按「新增這次穿線」提交

提交走 `POST /api/rackets/:uuid/jobs`：球拍码不变，`string_jobs` 加一条，旧的 `is_current` 归零。结果页显示的仍然是同一张二维码（同一个链接），所以不用重新打印贴纸。

> 「再穿一次」按钮只在**存过后台口令的那台装置**上出现（`sessionStorage`），客户手机上看不到。

**② `/list` 所有球拍（穿线师的档案室）**

输入口令后列出所有穿过的球拍，每支显示：当前线/磅数、穿过几次、累计小时、记录条数、最近穿线日期、谁认领的。点开一支拍，展开它的每一次穿线（第几次、日期、当时的线、这一次用掉多少小时多少条记录），并给出两个按钮：查看客户页 / 再穿一次。

数据来自 `POST /api/rackets/list`，一次返回列表 + 全部穿线（按球拍码分组），个人用量下几百条以内很快。

### 11.5 客户页有什么变化

`/r/{球拍码}` 现在：

- 顶部仍是「累计使用 / 条记录」，信息卡多了「第幾次」——客户会知道自己手上是第几根线
- 多一张「這支拍穿過幾次」卡（穿过 2 次以上才显示），每次一行：第几次、日期、当时的线、这次用了多久；当前那根有「現在這根」标记
- 使用记录里，**不属于当前这次穿线的旧记录会带一个「第 N 次」小标签**，不会跟现在这根混在一起
- 穿线建议只算当前这次穿线的记录（换线后从头算，这符合直觉）

### 11.6 这一版的验收（本地已跑通）

- [x] 建新拍 → `uuid` + `job_id=1`，`GET` 返回 `job_count=1`、`current_job_id=1`
- [x] 重穿一次 → `job_id=2`、`job_index=2`，`uuid` 不变；旧穿线 `is_current=0`
- [x] 客户页「第幾次」显示「第 2 次」，穿线历史两条都正确（第 1 次 2 小时/1 条，第 2 次还没记录）
- [x] 旧穿线的记录带「第 1 次」标签，新提交的记录落到 job 2（`string_job_id=2`）
- [x] 换线后穿线建议只算当前这根（没有记录时显示「多打幾次之後…」，不继承上一根的分数）
- [x] `/?racket=<uuid>` 带出上次主线/横线/磅数与子母线勾选状态，提交后码不变
- [x] `/list` 输口令后列出球拍，点开能看到每次穿线；口令错 401 并清掉本地口令
- [x] v2 测试库跑 `003` 迁移：穿线记录、历史使用记录、子母线字段全部正确
- [x] 繁體 / 简体 / English 正常（187 个用到的键，三份字典各 228 条，零漏译）
- [x] 五个页面 + 三个静态 JS 全部 200

### 11.7 穿線日期可以回填

穿線台多了一個「穿線日期」，預設今天。隔幾天補記、或替客戶補一筆舊帳，直接把日期往前選就行。

- 前端送的是**當地中午**的時間（`new Date(y, m-1, d, 12, 0)` 轉 ISO），避免時區把日期挪到前一天或後一天。
- 後端也接受 `YYYY-MM-DD`，會存成 `04:00Z`（香港正午）。完整 ISO 照原樣收。
- 只擋兩種不合理：2005 年以前、以及未來超過一天 → 400 `STRUNG_AT_INVALID`。
- 客戶頁的「穿線」只顯示**日期**，不顯示幾點（回填的日期不該冒出一個假的 12:00）。
- 清單頁、穿線歷史的排序都按日期，所以補記的舊穿線會自動排到正確的位置，「第幾次」也按日期算，不是按你輸入的先後。

**補記舊日期不會蓋掉現在那根線**

如果補的日期比「現在拍上這一根」更早，這條會被標成歷史（`is_current = 0`），現在那根不動，回傳 `is_current: false`，頁面會提示「已補記為第 N 次（日期比現在那根更早，不會蓋掉它）」。不然補一筆去年的帳，客戶手上那根線就被頂掉了。

### 11.8 這一版的補充驗收

- [x] 建拍帶 `strung_at: "2026-10-01"` → 存成 `2026-10-01T04:00:00.000Z`，客戶頁顯示 `2026/10/01`
- [x] 補記 `2026-09-15`（早於當前）→ `is_current: false`、`job_index: 1`（按日期算），當前那根不動
- [x] 再補一筆 `2026-08-20` → `job_index: 1`，四個日期排序 `11-08 > 10-01 > 09-15 > 08-20` 正確
- [x] 選今天 → 成為「現在這根」，舊的退成歷史
- [x] `2027-01-01` → 400 `STRUNG_AT_INVALID`（不能是未来）
- [x] `昨天` → 400 `STRUNG_AT_INVALID`（看不懂的日期）
- [x] 順手修掉一個樣式 bug：`.notice` 的 `display` 蓋掉 `hidden`，導致重穿提示條在新建模式下也顯示 → 全域加 `[hidden] { display: none !important }`
