/**
 * 多语言：繁體中文（預設） / 简体中文 / English
 *
 * 用法：
 *   - 静态文案：给元素加 data-i18n="key"（或 data-i18n-ph="key" 用于 placeholder）
 *   - 动态文案：t('key', { n: 2 })
 *   - 服务端错误：errText(res.data)，按 error_code 翻译，未知 code 用服务端原文兜底
 *   - 语言选择保存在 localStorage + cookie；也可用 ?lang=en 临时覆盖
 */

const DEFAULT_LANG = 'zh-Hant';
const LANGS = ['zh-Hant', 'zh-Hans', 'en'];
const LANG_COOKIE = 'rl_lang';
const LANG_STORE = 'rl_lang';

// 客户反馈的按键顺序（文案在 DICT 的 fb.* 里）
const FEEDBACK_KEYS = [
  'comfort', 'stiff', 'soft', 'springy', 'dead', 'shock', 'muted',
  'control', 'spinGood', 'spinLow', 'spinHigh', 'powerLow', 'powerHigh',
  'tensionLoss', 'stringBreak', 'stringMove',
];

const DICT = {
  'zh-Hant': {
    'nav.desk': '穿線台',
    'nav.local': '本機球拍',
    'nav.my': '我的球拍',
    'nav.login': '登入',
    'nav.logout': '登出',

    'admin.title': '新穿一支拍子',
    'admin.lead': '輸入球拍資訊，產生專屬 QR Code。把碼貼在拍框或傳給客戶，對方一掃就能記錄使用情況。',
    'admin.token': '後台口令',
    'admin.tokenHint': '口令只保存在這台裝置上，關掉瀏覽器即失效。',
    'admin.brand': '球拍品牌',
    'admin.brandPh': '選擇或輸入品牌',
    'admin.brandOther': '其他品牌…',
    'admin.model': '球拍型號',
    'admin.modelPh': '例：EZONE 98',
    'admin.hybrid': '子母線（橫豎不同）',
    'admin.hybridHint': '不勾選時，橫豎用同一條線、同一磅數。',
    'admin.mainSection': '主線 · 豎線',
    'admin.crossSection': '橫線 · 子母線',
    'admin.brandLabel': '品牌',
    'admin.stringLabel': '線型號',
    'admin.stringPh': '例：ALU Power 1.25',
    'admin.tension': '磅數',
    'admin.tensionHint': '支援 0.5 步進，例如 47.5 / 48 / 52.5。',
    'admin.submit': '產生 QR Code',
    'admin.submitting': '產生中…',
    'msg.wait': '處理中…',
    'admin.resultTitle': '這支球拍已登記',
    'admin.scanUrl': '掃碼連結',
    'admin.uuid': '球拍編號（UUID）',
    'admin.copyLink': '複製連結',
    'admin.copyId': '複製編號',
    'admin.preview': '預覽頁面',
    'admin.recent': '本機剛產生的球拍',
    'admin.foot': '客戶掃碼後無需註冊即可記錄',
    'admin.open': '開啟 →',

    'r.loading': '正在讀取球拍資訊…',
    'r.noticeTitle': '不用註冊、不用登入。',
    'r.noticeBody': '選好時間、按提交就好。想認領球拍時才需要帳號。',
    'r.notFoundTitle': '沒有找到這支球拍',
    'r.notFoundBody': 'QR Code 可能對應一支已刪除的球拍，或者連結複製時漏了字元。可以請穿線師重新發一次連結。',
    'r.label.brand': '品牌',
    'r.label.main': '主線',
    'r.label.cross': '橫線',
    'r.label.strung': '穿線',
    'r.label.owner': '歸屬',
    'r.claimed': '已認領',
    'r.unclaimed': '尚未認領',
    'r.waiting': '待認領',
    'r.localHint': '這支球拍已記在你的瀏覽器裡，下次打開「本機球拍」就能直接找到。',
    'r.claim.title': '這是你的球拍嗎？',
    'r.claim.hint': '登入後可以把這支球拍歸到自己名下，之後在「我的球拍」看到累積使用時長。',
    'r.claim.hintMe': '目前登入：{email}',
    'r.claim.btnLogin': '登入並認領',
    'r.claim.btn': '認領這支球拍',
    'r.claim.btnBusy': '認領中…',
    'r.log.title': '記錄一次使用',
    'r.log.duration': '這次用了多久',
    'r.log.durationPh': '例：1.5',
    'r.log.feedback': '感受（可選）',
    'r.log.feedbackPh': '手感、彈力、掉磅情況…',
    'r.label.total': '累計使用',
    'r.label.logs': '條記錄',
    'r.log.unitPick': '大概用了多久？',
    'r.log.feedbackLabel': '手感怎樣？（可多選）',
    'r.log.less': '減半小時',
    'r.log.more': '加半小時',
    'fb.comfort': '舒適',
    'fb.stiff': '太硬',
    'fb.soft': '太軟',
    'fb.springy': '太彈',
    'fb.dead': '沒彈性',
    'fb.shock': '震手',
    'fb.muted': '偏悶',
    'fb.control': '控制好',
    'fb.spinGood': '旋轉夠',
    'fb.spinLow': '旋轉不足',
    'fb.spinHigh': '旋轉太多',
    'fb.powerLow': '力量不足',
    'fb.powerHigh': '力量太猛',
    'fb.tensionLoss': '掉磅快',
    'fb.stringBreak': '線易斷',
    'fb.stringMove': '走線',
    'r.log.geo': '會自動記一下當天氣溫；拒絕定位也能提交。',
    'r.log.submit': '提交記錄',
    'r.log.submitting': '提交中…',
    'r.logs.title': '使用記錄',
    'r.logs.empty': '還沒有記錄，第一條就交給你了。',
    'r.foot': '資料保存在這支球拍的檔案裡',
    'adv.title': '穿線建議',
    'adv.healthLabel': '線的狀態',
    'adv.tensionLabel': '下次磅數',
    'adv.level.good': '還很有活力',
    'adv.level.watch': '開始掉磅了',
    'adv.level.rest': '建議重穿',
    'adv.why.hours': '已打了 {h} 小時，{type}一般 {limit} 小時內最好打',
    'adv.why.days': '穿線 {d} 週了，{type}一般 {limit} 天內最好打',
    'adv.type.poly': '聚酯線',
    'adv.type.multi': '仿羊腸線',
    'adv.type.syn': '合成腸線',
    'adv.type.gut': '天然羊腸',
    'adv.reason.hot': '你打球時約 {t}°C，比 {ref}°C 熱，線床更彈 — 加一點磅數比較控得住',
    'adv.reason.cold': '你打球時約 {t}°C，比 {ref}°C 冷，線床偏硬 — 降一點磅數更好發力、也少震手',
    'adv.reason.noTemp': '沒有氣溫資料（客戶多數拒絕定位），這次只按手感給建議',
    'adv.reason.plus': '你回報「太彈 / 太軟 / 力量太猛」，加磅會更穩',
    'adv.reason.minus': '你回報「太硬 / 震手 / 沒力量」，降磅會更舒服',
    'adv.reason.move': '你回報「走線」，加一點磅數可以壓住線床',
    'adv.reason.weak': '你回報「線易斷」，先別加磅',
    'adv.reason.tensionLoss': '你回報「掉磅快」，換線比加磅更有效',
    'adv.reason.break': '你回報「線易斷」，也可以考慮換粗一點的線徑',
    'adv.tension.current': '目前 {v} 磅',
    'adv.tension.currentHybrid': '目前主線 {m} / 橫線 {c} 磅',
    'adv.tension.next': '下次建議 {v} 磅',
    'adv.tension.nextHybrid': '下次建議主線 {m} / 橫線 {c} 磅',
    'adv.tension.same': '維持現在磅數就好',
    'adv.noData': '多打幾次之後，這裡會給出線的健康度與磅數建議。',
    'adv.foot': '由用量、時間、手感與氣溫推算，實際以試打為準',
    'adv.crossNote': '先到期的是橫線',

    'auth.title': '登入或註冊',
    'auth.lead': '帳號只用來認領球拍、彙總自己的數據。記錄使用情況本來就不需要登入。',
    'auth.login': '登入',
    'auth.register': '註冊',
    'auth.btnLogin': '登入',
    'auth.btnRegister': '註冊並登入',
    'auth.email': '電子郵件',
    'auth.password': '密碼',
    'auth.passwordHint': '密碼至少 6 位。',
    'auth.back': '← 回穿線台',

    'my.title': '我的球拍',
    'my.leadLoading': '正在讀取…',
    'my.lead': '目前登入：{email}',
    'my.statCount': '球拍數量',
    'my.statHours': '累積使用',
    'my.statLogs': '記錄條數',
    'my.listTitle': '已認領的球拍',
    'my.emptyTitle': '還沒有認領任何球拍',
    'my.emptyBody': '打開穿線師給你的 QR Code 連結，在球拍頁面按「認領這支球拍」即可歸到這裡。',
    'my.localBtn': '看看本機掃過的球拍',
    'my.errorTitle': '暫時讀不到你的球拍',
    'my.errorBody': '請稍後重試。',
    'my.unitCount': '{n} 支',

    'local.title': '本機球拍',
    'local.lead': '這些是你在這台裝置上掃過或打開過的球拍。記錄存在你自己的瀏覽器裡，不需要帳號，也不會同步到別的裝置。',
    'local.emptyTitle': '這裡還是空的',
    'local.emptyBody': '掃一次球拍上的 QR Code，它就會自動出現在這裡。',
    'local.clear': '清空本機記錄',
    'local.clearConfirm': '清空這台瀏覽器上的球拍記錄？（不影響球拍本身的真實資料）',
    'local.gone': '這支球拍在服務端找不到了，可能已被刪除',
    'local.foot': '只影響這台瀏覽器，不影響球拍上的真實資料',
    'local.cloud': '登入後看雲端資料',
    'local.fallback': '球拍 {id}',

    'unit.hours': '{n} 小時',
    'unit.hourUnit': '小時',
    'unit.hoursShort': '{n} h',
    'unit.logs': '{n} 條記錄',
    'meta.line': '{string} · {tension} · {logs} · 穿線於 {date}',
    'meta.tension': '{n} 磅',
    'meta.mainCross': '{main} / {cross}',

    'msg.copied': '{label}已複製',
    'msg.copyFail': '複製失敗，請長按上面的文字手動複製',
    'msg.netError': '網路異常，請稍後重試',
    'msg.created': '已產生，把 QR Code 存下來或直接傳給客戶',
    'msg.logOkTemp': '記錄成功，已帶上當時溫度 {temp}°C',
    'msg.logOkNoTemp': '記錄成功（未取得溫度，不影響記錄）',
    'msg.claimOk': '認領成功，已加入「我的球拍」',
    'msg.needToken': '請先填寫後台口令',
    'msg.needModel': '請填寫球拍型號',
    'msg.needMainString': '請填寫主線型號',
    'msg.needMainTension': '請填寫主線磅數',
    'msg.needCrossString': '子母線需要填寫橫線型號',
    'msg.needCrossTension': '子母線需要填寫橫線磅數',
    'msg.needEmail': '請填寫電子郵件',
    'msg.needPassword': '請填寫密碼',
    'msg.passwordShort': '密碼至少 6 位',
    'msg.durationNeeded': '請填寫一個大於 0 的小時數',
    'msg.durationMax': '單次不能超過 24 小時',

    'err.TOKEN_INVALID': '後台口令錯誤',
    'err.RACKET_MODEL_REQUIRED': '球拍型號必須填寫',
    'err.MAIN_STRING_REQUIRED': '主（豎）線型號必須填寫',
    'err.MAIN_TENSION_REQUIRED': '主（豎）線磅數必須填寫',
    'err.MAIN_TENSION_INVALID': '主（豎）線磅數必須是 0-80 之間的數字',
    'err.CROSS_STRING_REQUIRED': '子母線需要填寫橫線型號',
    'err.CROSS_TENSION_REQUIRED': '子母線需要填寫橫線磅數',
    'err.CROSS_TENSION_INVALID': '橫線磅數必須是 0-80 之間的數字',
    'err.RACKET_NOT_FOUND': '球拍不存在',
    'err.DURATION_INVALID': '使用時長必須是大於 0 的數字',
    'err.DURATION_TOO_LONG': '單次使用時長不能超過 24 小時',
    'err.UNAUTHORIZED': '請先登入',
    'err.CLAIM_TAKEN': '這支球拍已被認領',
    'err.EMAIL_TAKEN': '該電子郵件已註冊',
    'err.BAD_CREDENTIALS': '電子郵件或密碼錯誤',
    'err.EMAIL_INVALID': '電子郵件格式不正確',
    'err.PASSWORD_SHORT': '密碼至少 6 位',
    'err.PASSWORD_LONG': '密碼過長',
    'err.CREDENTIALS_REQUIRED': '電子郵件和密碼都必須填寫',
    'err.INTERNAL': '伺服器內部錯誤',
    'err.NOT_FOUND': '介面不存在',
    'err.SERVER_MISCONFIGURED': '伺服器未設定完成',
    'err.UNKNOWN': '操作失敗，請重試',
  },

  'zh-Hans': {
    'nav.desk': '穿线台',
    'nav.local': '本机球拍',
    'nav.my': '我的球拍',
    'nav.login': '登录',
    'nav.logout': '登出',

    'admin.title': '新穿一支拍子',
    'admin.lead': '输入球拍信息，生成专属二维码。把码贴在拍框或发给客户，对方一扫就能记录使用情况。',
    'admin.token': '后台口令',
    'admin.tokenHint': '口令只保存在这台设备上，关掉浏览器即失效。',
    'admin.brand': '球拍品牌',
    'admin.brandPh': '选择或输入品牌',
    'admin.brandOther': '其他品牌…',
    'admin.model': '球拍型号',
    'admin.modelPh': '例：EZONE 98',
    'admin.hybrid': '子母线（横竖不同）',
    'admin.hybridHint': '不勾选时，横竖用同一根线、同一磅数。',
    'admin.mainSection': '主线 · 竖线',
    'admin.crossSection': '横线 · 子母线',
    'admin.brandLabel': '品牌',
    'admin.stringLabel': '线型号',
    'admin.stringPh': '例：ALU Power 1.25',
    'admin.tension': '磅数',
    'admin.tensionHint': '支持 0.5 步进，例如 47.5 / 48 / 52.5。',
    'admin.submit': '生成二维码',
    'admin.submitting': '生成中…',
    'msg.wait': '处理中…',
    'admin.resultTitle': '这支球拍已登记',
    'admin.scanUrl': '扫码链接',
    'admin.uuid': '球拍编号（UUID）',
    'admin.copyLink': '复制链接',
    'admin.copyId': '复制编号',
    'admin.preview': '预览页面',
    'admin.recent': '本机刚生成的球拍',
    'admin.foot': '客户扫码后无需注册即可记录',
    'admin.open': '打开 →',

    'r.loading': '正在读取球拍信息…',
    'r.noticeTitle': '不用注册、不用登录。',
    'r.noticeBody': '选好时间、点提交就好。想认领球拍时才需要账号。',
    'r.notFoundTitle': '没有找到这支球拍',
    'r.notFoundBody': '二维码可能对应一支已删除的球拍，或者链接复制时漏了字符。可以让穿线师重新发一次链接。',
    'r.label.brand': '品牌',
    'r.label.main': '主线',
    'r.label.cross': '横线',
    'r.label.strung': '穿线',
    'r.label.owner': '归属',
    'r.claimed': '已认领',
    'r.unclaimed': '尚未认领',
    'r.waiting': '待认领',
    'r.localHint': '这支球拍已记在你的浏览器里，下次打开「本机球拍」就能直接找到。',
    'r.claim.title': '这是你的球拍吗？',
    'r.claim.hint': '登录后可以把这支球拍归到自己名下，之后在「我的球拍」看到累计使用时长。',
    'r.claim.hintMe': '当前登录：{email}',
    'r.claim.btnLogin': '登录并认领',
    'r.claim.btn': '认领这支球拍',
    'r.claim.btnBusy': '认领中…',
    'r.log.title': '记录一次使用',
    'r.log.duration': '这次用了多久',
    'r.log.durationPh': '例：1.5',
    'r.log.feedback': '感受（可选）',
    'r.log.feedbackPh': '手感、弹力、掉磅情况…',
    'r.label.total': '累计使用',
    'r.label.logs': '条记录',
    'r.log.unitPick': '大概用了多久？',
    'r.log.feedbackLabel': '手感怎样？（可多选）',
    'r.log.less': '减半小时',
    'r.log.more': '加半小时',
    'fb.comfort': '舒适',
    'fb.stiff': '太硬',
    'fb.soft': '太软',
    'fb.springy': '太弹',
    'fb.dead': '没弹性',
    'fb.shock': '震手',
    'fb.muted': '偏闷',
    'fb.control': '控制好',
    'fb.spinGood': '旋转够',
    'fb.spinLow': '旋转不足',
    'fb.spinHigh': '旋转太多',
    'fb.powerLow': '力量不足',
    'fb.powerHigh': '力量太猛',
    'fb.tensionLoss': '掉磅快',
    'fb.stringBreak': '线易断',
    'fb.stringMove': '走线',
    'r.log.geo': '会自动记一下当天温度；拒绝定位也能提交。',
    'r.log.submit': '提交记录',
    'r.log.submitting': '提交中…',
    'r.logs.title': '使用记录',
    'r.logs.empty': '还没有记录，第一条就交给你了。',
    'r.foot': '数据保存在这支球拍的档案里',
    'adv.title': '穿线建议',
    'adv.healthLabel': '线的状态',
    'adv.tensionLabel': '下次磅数',
    'adv.level.good': '还很有活力',
    'adv.level.watch': '开始掉磅了',
    'adv.level.rest': '建议重穿',
    'adv.why.hours': '已经打了 {h} 小时，{type}一般 {limit} 小时内最好打',
    'adv.why.days': '穿线 {d} 周了，{type}一般 {limit} 天内最好打',
    'adv.type.poly': '聚酯线',
    'adv.type.multi': '仿羊肠线',
    'adv.type.syn': '合成肠线',
    'adv.type.gut': '天然羊肠',
    'adv.reason.hot': '你打球时约 {t}°C，比 {ref}°C 热，线床更弹 — 加一点磅数比较控得住',
    'adv.reason.cold': '你打球时约 {t}°C，比 {ref}°C 冷，线床偏硬 — 降一点磅数更好发力、也少震手',
    'adv.reason.noTemp': '没有气温数据（客户多数拒绝定位），这次只按手感给建议',
    'adv.reason.plus': '你回报“太弹 / 太软 / 力量太猛”，加磅会更稳',
    'adv.reason.minus': '你回报“太硬 / 震手 / 没力量”，降磅会更舒服',
    'adv.reason.move': '你回报“走线”，加一点磅数可以压住线床',
    'adv.reason.weak': '你回报“线易断”，先别加磅',
    'adv.reason.tensionLoss': '你回报“掉磅快”，换线比加磅更有效',
    'adv.reason.break': '你回报“线易断”，也可以考虑换粗一点的线径',
    'adv.tension.current': '目前 {v} 磅',
    'adv.tension.currentHybrid': '目前主线 {m} / 横线 {c} 磅',
    'adv.tension.next': '下次建议 {v} 磅',
    'adv.tension.nextHybrid': '下次建议主线 {m} / 横线 {c} 磅',
    'adv.tension.same': '维持现在磅数就好',
    'adv.noData': '多打几次之后，这里会给出线的健康度与磅数建议。',
    'adv.foot': '由用量、时间、手感与气温推算，实际以试打为准',
    'adv.crossNote': '先到期的是横线',

    'auth.title': '登录或注册',
    'auth.lead': '账号只用来认领球拍、汇总自己的数据。记录使用情况本来就不需要登录。',
    'auth.login': '登录',
    'auth.register': '注册',
    'auth.btnLogin': '登录',
    'auth.btnRegister': '注册并登录',
    'auth.email': '邮箱',
    'auth.password': '密码',
    'auth.passwordHint': '密码至少 6 位。',
    'auth.back': '← 回穿线台',

    'my.title': '我的球拍',
    'my.leadLoading': '正在读取…',
    'my.lead': '当前登录：{email}',
    'my.statCount': '球拍数量',
    'my.statHours': '累计使用',
    'my.statLogs': '记录条数',
    'my.listTitle': '已认领的球拍',
    'my.emptyTitle': '还没有认领任何球拍',
    'my.emptyBody': '打开穿线师给你的二维码链接，在球拍页面点「认领这支球拍」即可归到这里。',
    'my.localBtn': '看看本机扫过的球拍',
    'my.errorTitle': '暂时读不到你的球拍',
    'my.errorBody': '请稍后重试。',
    'my.unitCount': '{n} 支',

    'local.title': '本机球拍',
    'local.lead': '这些是你在这台设备上扫过或打开过的球拍。记录存在你自己的浏览器里，不需要账号，也不会同步到别的设备。',
    'local.emptyTitle': '这里还是空的',
    'local.emptyBody': '扫一次球拍上的二维码，它就会自动出现在这里。',
    'local.clear': '清空本机记录',
    'local.clearConfirm': '清空这台浏览器上的球拍记录？（不影响球拍本身的真实数据）',
    'local.gone': '这支球拍在服务端找不到了，可能已被删除',
    'local.foot': '只影响这台浏览器，不影响球拍上的真实数据',
    'local.cloud': '登录后看云端数据',
    'local.fallback': '球拍 {id}',

    'unit.hours': '{n} 小时',
    'unit.hourUnit': '小时',
    'unit.hoursShort': '{n} h',
    'unit.logs': '{n} 条记录',
    'meta.line': '{string} · {tension} · {logs} · 穿线于 {date}',
    'meta.tension': '{n} 磅',
    'meta.mainCross': '{main} / {cross}',

    'msg.copied': '{label}已复制',
    'msg.copyFail': '复制失败，请长按上面的文字手动复制',
    'msg.netError': '网络异常，请稍后重试',
    'msg.created': '已生成，把二维码存下来或直接发给客户',
    'msg.logOkTemp': '记录成功，已带上当时温度 {temp}°C',
    'msg.logOkNoTemp': '记录成功（未获取到温度，不影响记录）',
    'msg.claimOk': '认领成功，已加入「我的球拍」',
    'msg.needToken': '请先填写后台口令',
    'msg.needModel': '请填写球拍型号',
    'msg.needMainString': '请填写主线型号',
    'msg.needMainTension': '请填写主线磅数',
    'msg.needCrossString': '子母线需要填写横线型号',
    'msg.needCrossTension': '子母线需要填写横线磅数',
    'msg.needEmail': '请填写邮箱',
    'msg.needPassword': '请填写密码',
    'msg.passwordShort': '密码至少 6 位',
    'msg.durationNeeded': '请填写一个大于 0 的小时数',
    'msg.durationMax': '单次不能超过 24 小时',

    'err.TOKEN_INVALID': '后台口令错误',
    'err.RACKET_MODEL_REQUIRED': '球拍型号必须填写',
    'err.MAIN_STRING_REQUIRED': '主（竖）线型号必须填写',
    'err.MAIN_TENSION_REQUIRED': '主（竖）线磅数必须填写',
    'err.MAIN_TENSION_INVALID': '主（竖）线磅数必须是 0-80 之间的数字',
    'err.CROSS_STRING_REQUIRED': '子母线需要填写横线型号',
    'err.CROSS_TENSION_REQUIRED': '子母线需要填写横线磅数',
    'err.CROSS_TENSION_INVALID': '横线磅数必须是 0-80 之间的数字',
    'err.RACKET_NOT_FOUND': '球拍不存在',
    'err.DURATION_INVALID': '使用时长必须是大于 0 的数字',
    'err.DURATION_TOO_LONG': '单次使用时长不能超过 24 小时',
    'err.UNAUTHORIZED': '请先登录',
    'err.CLAIM_TAKEN': '这支球拍已被认领',
    'err.EMAIL_TAKEN': '该邮箱已注册',
    'err.BAD_CREDENTIALS': '邮箱或密码错误',
    'err.EMAIL_INVALID': '邮箱格式不正确',
    'err.PASSWORD_SHORT': '密码至少 6 位',
    'err.PASSWORD_LONG': '密码过长',
    'err.CREDENTIALS_REQUIRED': '邮箱和密码都必须填写',
    'err.INTERNAL': '服务器内部错误',
    'err.NOT_FOUND': '接口不存在',
    'err.SERVER_MISCONFIGURED': '服务器未配置完成',
    'err.UNKNOWN': '操作失败，请重试',
  },

  en: {
    'nav.desk': 'Stringing Desk',
    'nav.local': 'This Device',
    'nav.my': 'My Rackets',
    'nav.login': 'Sign in',
    'nav.logout': 'Sign out',

    'admin.title': 'String a new racket',
    'admin.lead': 'Enter the racket details to generate its QR code. Stick it on the frame or send it to your customer — they scan and log their usage.',
    'admin.token': 'Desk passcode',
    'admin.tokenHint': 'Kept on this device only; cleared when you close the browser.',
    'admin.brand': 'Racket brand',
    'admin.brandPh': 'Pick or type a brand',
    'admin.brandOther': 'Other brand…',
    'admin.model': 'Racket model',
    'admin.modelPh': 'e.g. EZONE 98',
    'admin.hybrid': 'Hybrid stringing (different main / cross)',
    'admin.hybridHint': 'When unchecked, mains and crosses use the same string at the same tension.',
    'admin.mainSection': 'Main · vertical',
    'admin.crossSection': 'Cross · hybrid',
    'admin.brandLabel': 'Brand',
    'admin.stringLabel': 'String',
    'admin.stringPh': 'e.g. ALU Power 1.25',
    'admin.tension': 'Tension',
    'admin.tensionHint': '0.5 steps supported, e.g. 47.5 / 48 / 52.5.',
    'admin.submit': 'Generate QR code',
    'admin.submitting': 'Generating…',
    'msg.wait': 'Working…',
    'admin.resultTitle': 'Racket registered',
    'admin.scanUrl': 'Scan link',
    'admin.uuid': 'Racket ID (UUID)',
    'admin.copyLink': 'Copy link',
    'admin.copyId': 'Copy ID',
    'admin.preview': 'Preview',
    'admin.recent': 'Recently created on this device',
    'admin.foot': 'Customers can log usage without signing up',
    'admin.open': 'Open →',

    'r.loading': 'Loading racket…',
    'r.noticeTitle': 'No sign-up, no sign-in.',
    'r.noticeBody': 'Pick the hours, submit, done. An account is only needed to claim the racket.',
    'r.notFoundTitle': 'Racket not found',
    'r.notFoundBody': 'This QR code may point to a deleted racket, or the link got cut off when copied. Ask your stringer to resend the link.',
    'r.label.brand': 'Brand',
    'r.label.main': 'Mains',
    'r.label.cross': 'Crosses',
    'r.label.strung': 'Strung',
    'r.label.owner': 'Owner',
    'r.claimed': 'Claimed',
    'r.unclaimed': 'Not claimed',
    'r.waiting': 'Unclaimed',
    'r.localHint': 'Saved on this device — find it later under "This Device".',
    'r.claim.title': 'Is this your racket?',
    'r.claim.hint': 'Sign in to claim it, then see your total hours under "My Rackets".',
    'r.claim.hintMe': 'Signed in as {email}',
    'r.claim.btnLogin': 'Sign in and claim',
    'r.claim.btn': 'Claim this racket',
    'r.claim.btnBusy': 'Claiming…',
    'r.log.title': 'Log a session',
    'r.log.duration': 'Time played',
    'r.log.durationPh': 'e.g. 1.5',
    'r.log.feedback': 'Notes (optional)',
    'r.log.feedbackPh': 'Feel, power, tension loss…',
    'r.label.total': 'Total hours',
    'r.label.logs': 'sessions',
    'r.log.unitPick': 'How long did you play?',
    'r.log.feedbackLabel': 'How did it feel? (pick any)',
    'r.log.less': 'Minus half an hour',
    'r.log.more': 'Plus half an hour',
    'fb.comfort': 'Comfortable',
    'fb.stiff': 'Too stiff',
    'fb.soft': 'Too soft',
    'fb.springy': 'Too springy',
    'fb.dead': 'Dead / no feel',
    'fb.shock': 'Harsh on the arm',
    'fb.muted': 'Muted',
    'fb.control': 'Good control',
    'fb.spinGood': 'Good spin',
    'fb.spinLow': 'Not enough spin',
    'fb.spinHigh': 'Too much spin',
    'fb.powerLow': 'Lacking power',
    'fb.powerHigh': 'Too powerful',
    'fb.tensionLoss': 'Loses tension fast',
    'fb.stringBreak': 'Breaks easily',
    'fb.stringMove': 'Strings move',
    'r.log.geo': 'We note today’s temperature; you can still submit if you decline.',
    'r.log.submit': 'Submit',
    'r.log.submitting': 'Submitting…',
    'r.logs.title': 'Usage history',
    'r.logs.empty': 'No entries yet — the first one is yours.',
    'r.foot': 'Data lives with this racket',
    'adv.title': 'Stringing advice',
    'adv.healthLabel': 'String condition',
    'adv.tensionLabel': 'Next tension',
    'adv.level.good': 'Still lively',
    'adv.level.watch': 'Starting to lose tension',
    'adv.level.rest': 'Time to restring',
    'adv.why.hours': '{h} hours played; {type} usually feels best within {limit} h',
    'adv.why.days': 'Strung {d} weeks ago; {type} usually stays good for about {limit} days',
    'adv.type.poly': 'poly',
    'adv.type.multi': 'multifilament',
    'adv.type.syn': 'synthetic gut',
    'adv.type.gut': 'natural gut',
    'adv.reason.hot': 'You play around {t}°C, hotter than {ref}°C — livelier bed, a bit more tension keeps control',
    'adv.reason.cold': 'You play around {t}°C, colder than {ref}°C — stiffer bed, slightly less tension helps power and comfort',
    'adv.reason.noTemp': 'No temperature data (most players decline location), so this is based on feel only',
    'adv.reason.plus': 'You reported too springy / too soft / too powerful — more tension will settle it',
    'adv.reason.minus': 'You reported too stiff / harsh / underpowered — less tension will feel better',
    'adv.reason.move': 'You reported strings moving — a touch more tension holds the bed',
    'adv.reason.weak': 'You reported breakage — do not go up in tension',
    'adv.reason.tensionLoss': 'You reported fast tension loss — changing the string beats adding tension',
    'adv.reason.break': 'You reported breakage — trying a thicker gauge is worth it too',
    'adv.tension.current': 'Now {v} lb',
    'adv.tension.currentHybrid': 'Now mains {m} / crosses {c} lb',
    'adv.tension.next': 'Next: {v} lb',
    'adv.tension.nextHybrid': 'Next: mains {m} / crosses {c} lb',
    'adv.tension.same': 'Keep the same tension',
    'adv.noData': 'After a few sessions this will show string health and a tension suggestion.',
    'adv.foot': 'Estimated from usage, time, feel and temperature — always confirm by hitting.',
    'adv.crossNote': 'The crosses will wear out first',

    'auth.title': 'Sign in or register',
    'auth.lead': 'An account is only for claiming rackets and seeing your totals. Logging usage never requires one.',
    'auth.login': 'Sign in',
    'auth.register': 'Register',
    'auth.btnLogin': 'Sign in',
    'auth.btnRegister': 'Register and sign in',
    'auth.email': 'Email',
    'auth.password': 'Password',
    'auth.passwordHint': 'At least 6 characters.',
    'auth.back': '← Back to desk',

    'my.title': 'My rackets',
    'my.leadLoading': 'Loading…',
    'my.lead': 'Signed in as {email}',
    'my.statCount': 'Rackets',
    'my.statHours': 'Total hours',
    'my.statLogs': 'Entries',
    'my.listTitle': 'Claimed rackets',
    'my.emptyTitle': 'No rackets claimed yet',
    'my.emptyBody': 'Open the QR link from your stringer and tap "Claim this racket".',
    'my.localBtn': 'See rackets scanned on this device',
    'my.errorTitle': 'Could not load your rackets',
    'my.errorBody': 'Please try again later.',
    'my.unitCount': '{n}',

    'local.title': 'Rackets on this device',
    'local.lead': 'Rackets you scanned or opened on this device. Stored in your own browser — no account needed, and not synced across devices.',
    'local.emptyTitle': 'Nothing here yet',
    'local.emptyBody': 'Scan a racket QR code and it will show up here.',
    'local.clear': 'Clear local list',
    'local.clearConfirm': 'Clear the racket list on this browser? (Your racket data on the server is untouched.)',
    'local.gone': 'No longer found on the server — it may have been deleted',
    'local.foot': 'Affects this browser only',
    'local.cloud': 'Sign in for cloud data',
    'local.fallback': 'Racket {id}',

    'unit.hours': '{n} h',
    'unit.hourUnit': 'h',
    'unit.hoursShort': '{n} h',
    'unit.logs': '{n} entries',
    'meta.line': '{string} · {tension} · {logs} · strung {date}',
    'meta.tension': '{n} lbs',
    'meta.mainCross': '{main} / {cross}',

    'msg.copied': '{label} copied',
    'msg.copyFail': 'Copy failed — long-press the text to copy manually',
    'msg.netError': 'Network error, please retry',
    'msg.created': 'Created — save the QR code or send it to your customer',
    'msg.logOkTemp': 'Logged, with a temperature of {temp}°C',
    'msg.logOkNoTemp': 'Logged (no temperature available — the entry is still saved)',
    'msg.claimOk': 'Claimed — added to My Rackets',
    'msg.needToken': 'Enter the desk passcode',
    'msg.needModel': 'Enter the racket model',
    'msg.needMainString': 'Enter the main string',
    'msg.needMainTension': 'Enter the main tension',
    'msg.needCrossString': 'Hybrid stringing needs a cross string',
    'msg.needCrossTension': 'Hybrid stringing needs a cross tension',
    'msg.needEmail': 'Enter your email',
    'msg.needPassword': 'Enter your password',
    'msg.passwordShort': 'Password must be at least 6 characters',
    'msg.durationNeeded': 'Enter a number of hours greater than 0',
    'msg.durationMax': 'A single session cannot exceed 24 hours',

    'err.TOKEN_INVALID': 'Wrong desk passcode',
    'err.RACKET_MODEL_REQUIRED': 'Racket model is required',
    'err.MAIN_STRING_REQUIRED': 'Main string is required',
    'err.MAIN_TENSION_REQUIRED': 'Main tension is required',
    'err.MAIN_TENSION_INVALID': 'Main tension must be a number between 0 and 80',
    'err.CROSS_STRING_REQUIRED': 'Hybrid stringing needs a cross string',
    'err.CROSS_TENSION_REQUIRED': 'Hybrid stringing needs a cross tension',
    'err.CROSS_TENSION_INVALID': 'Cross tension must be a number between 0 and 80',
    'err.RACKET_NOT_FOUND': 'Racket not found',
    'err.DURATION_INVALID': 'Duration must be a number greater than 0',
    'err.DURATION_TOO_LONG': 'A single session cannot exceed 24 hours',
    'err.UNAUTHORIZED': 'Please sign in first',
    'err.CLAIM_TAKEN': 'This racket has already been claimed',
    'err.EMAIL_TAKEN': 'That email is already registered',
    'err.BAD_CREDENTIALS': 'Wrong email or password',
    'err.EMAIL_INVALID': 'Invalid email address',
    'err.PASSWORD_SHORT': 'Password must be at least 6 characters',
    'err.PASSWORD_LONG': 'Password is too long',
    'err.CREDENTIALS_REQUIRED': 'Email and password are both required',
    'err.INTERNAL': 'Internal server error',
    'err.NOT_FOUND': 'Endpoint not found',
    'err.SERVER_MISCONFIGURED': 'Server is not configured',
    'err.UNKNOWN': 'Something went wrong, please retry',
  },
};

/* ------------------------------------------------------------------ */

function getLang() {
  const fromQuery = new URLSearchParams(location.search).get('lang');
  if (fromQuery && LANGS.includes(fromQuery)) return fromQuery;

  let stored = null;
  try {
    stored = localStorage.getItem(LANG_STORE);
  } catch {
    stored = null;
  }
  if (stored && LANGS.includes(stored)) return stored;

  const match = document.cookie.match(new RegExp(`(?:^|; )${LANG_COOKIE}=([^;]*)`));
  if (match && LANGS.includes(decodeURIComponent(match[1]))) return decodeURIComponent(match[1]);

  return DEFAULT_LANG; // 預設繁體
}

let CURRENT_LANG = null;

function lang() {
  if (!CURRENT_LANG) CURRENT_LANG = getLang();
  return CURRENT_LANG;
}

function setLang(next) {
  if (!LANGS.includes(next)) return;
  CURRENT_LANG = next;
  try {
    localStorage.setItem(LANG_STORE, next);
  } catch {
    /* 隐私模式下可能失败，cookie 兜底 */
  }
  document.cookie = `${LANG_COOKIE}=${next}; Path=/; Max-Age=${60 * 60 * 24 * 365}; SameSite=Lax`;
  // 用去掉了 lang 的地址重新载入，既避免 ?lang= 覆盖刚选的值，也保留 next= 之类的参数
  const params = new URLSearchParams(location.search);
  params.delete('lang');
  const query = params.toString();
  location.href = location.pathname + (query ? `?${query}` : '') + location.hash;
}

function t(key, vars) {
  const table = DICT[lang()] || DICT[DEFAULT_LANG];
  let text = table[key];
  if (text === undefined) {
    text = DICT[DEFAULT_LANG][key];
  }
  if (text === undefined) return key;
  if (!vars) return text;
  return text.replace(/\{(\w+)\}/g, (match, name) => (vars[name] === undefined || vars[name] === null ? '' : String(vars[name])));
}

/** 服务端错误 -> 本地化文案；未知 code 用服务端返回的中文兜底 */
function errText(data) {
  const code = data && data.error_code;
  if (code && DICT[lang()] && DICT[lang()][`err.${code}`]) return t(`err.${code}`);
  return (data && data.error) || t('err.UNKNOWN');
}

/** 把 data-i18n / data-i18n-ph / data-i18n-aria 全部套上当前语言 */
function applyI18n(root) {
  const scope = root || document;
  scope.querySelectorAll('[data-i18n]').forEach((el) => {
    el.textContent = t(el.dataset.i18n);
  });
  scope.querySelectorAll('[data-i18n-ph]').forEach((el) => {
    el.setAttribute('placeholder', t(el.dataset.i18nPh));
  });
  scope.querySelectorAll('[data-i18n-aria]').forEach((el) => {
    el.setAttribute('aria-label', t(el.dataset.i18nAria));
  });
  document.documentElement.lang = lang();
}

/** 顶栏语言切换：繁 / 简 / EN */
function mountLangSwitch() {
  const host = document.getElementById('lang-switch');
  if (!host) return;

  const select = document.createElement('select');
  select.className = 'lang-select';
  select.setAttribute('aria-label', 'Language');
  [['zh-Hant', '繁體'], ['zh-Hans', '简体'], ['en', 'EN']].forEach(([code, label]) => {
    const option = document.createElement('option');
    option.value = code;
    option.textContent = label;
    if (code === lang()) option.selected = true;
    select.appendChild(option);
  });

  select.addEventListener('change', () => setLang(select.value));
  host.appendChild(select);
}

/** 页面上显示的年月日，三语都走同一套数字格式，避免歧义 */
function fmtDate(iso) {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}/${pad(date.getMonth() + 1)}/${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function fmtDateShort(iso) {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}/${pad(date.getMonth() + 1)}/${pad(date.getDate())}`;
}

function fmtHours(value) {
  const num = Number(value) || 0;
  const shown = num === 0 ? '0' : num % 1 === 0 ? num.toFixed(0) : num.toFixed(1);
  return t('unit.hours', { n: shown });
}

function fmtTension(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '—';
  const num = Number(value);
  return t('meta.tension', { n: num % 1 === 0 ? num.toFixed(0) : num.toFixed(1) });
}

/** 一条线（主线或横线）的描述：品牌 + 型号 + 磅数 */
function lineText(line) {
  if (!line) return '—';
  const parts = [];
  const name = [line.brand, line.model].filter(Boolean).join(' ');
  parts.push(name);
  parts.push(fmtTension(line.tension));
  return parts.filter((item) => item && item !== '—').join(' · ');
}

function escapeHtml(text) {
  return String(text).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}

document.addEventListener('DOMContentLoaded', () => {
  applyI18n();
  mountLangSwitch();
});
