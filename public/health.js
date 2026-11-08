/**
 * 穿线建议：线床健康度 + 下次磅数建议
 *
 * 纯函数，只用已有数据算（strung_at、每条记录的时长 / 温度 / 反馈标签），
 * 不写库、不调接口。前端拿来直接渲染即可。
 *
 * 判定思路：
 *   1. 健康度看「离该换线还有多远」，用 用量 与 摆着的时间 两条线里更累的那条，
 *      因为聚酯线即使打得少，放两三个月也会自己掉磅。
 *   2. 磅数建议分两类信号：一类是线老化（掉磅/走线/断线），一类是配磅不合适
 *      （太硬/太软/太弹/没力量）—— 后者不该扣健康度，只影响磅数。
 *   3. 温度也进磅数公式：热天线床更弹、球飞更远，需要加一点磅数控住；
 *      冷天线床偏硬、球「死」，降一点磅数更好发力。经验值约每 5°C ≈ 1 磅。
 *
 * CONFIG 下面是经验值，不是物理常数。穿线师应按自己的客户群改，
 * 改完刷新页面即生效（没有构建步骤）。
 */

/* ---------------------------- 可调参数 ---------------------------- */

const TEMP_REFERENCE_C = 22; // 以 22°C 作为「不用补偿」的基准
const TEMP_LBS_PER_DEGREE = 1 / 5; // 每 5°C 感受上约差 1 磅
const TEMP_DELTA_CAP = 2; // 温度最多修正 ±2 磅，避免算出离谱数字
const TENSION_DELTA_CAP = 3; // 所有理由加起来最多调 ±3 磅
const TENSION_FLOOR = 30; // 再低就不是穿线建议，是另一个运动了
const TENSION_CEIL = 70;

// 各线种的寿命基准：hours = 打球小时，days = 穿线后还能算「好打」的天数
const LINE_LIFE = {
  poly: { hours: 12, days: 60 },
  multi: { hours: 16, days: 90 },
  syn: { hours: 20, days: 100 },
  gut: { hours: 25, days: 120 },
};

// 反馈标签的权重：老化类扣健康度，配磅类只进磅数建议
const WEAR_PENALTY = {
  tensionLoss: 18, // 掉磅快
  dead: 15, // 没弹性
  stringBreak: 22, // 线易断
  stringMove: 10, // 走线
  muted: 6, // 偏闷
};

const PLUS_TENSION_TAGS = ['springy', 'soft', 'powerHigh', 'spinHigh']; // 该加磅
const MINUS_TENSION_TAGS = ['stiff', 'shock', 'powerLow', 'spinLow']; // 该降磅

/* ---------------------------- 线种推断 ---------------------------- */

const STRING_TYPE_HINTS = {
  multi: [
    'x-one', 'nxt', 'nrg2', 'xcel', 'multifeel', 'biphase', 'velocity', 'sensation',
    'rexis', 'addiction', 'quasi gut', 'tnt', 'multisensation', 'hd',
  ],
  gut: ['natural gut', 'vs touch', 'vs team', 'klip', 'legend', 'tough gut'],
  syn: ['synthetic gut', 'syn gut', 'pps', 'super fine play', 'tournament nylon', 'syn-gut'],
  poly: [
    'alu power', '4g', 'element', 'rpm', 'tour bite', 'hyper-g', 'confidential',
    'super smash', 'poly tour', 'black code', 'cyclone', 'max power', 'pro line',
    'focus hex', 'poly plasma', 'v-torque', 'lynx', 'savage', 'firestorm', 'alu soft',
    'poly', 'co-poly',
  ],
};

/**
 * 从线型号猜线种。猜不准时按 poly 处理（现代线里聚酯占多数）。
 * 想更准的话，以后在建拍时加一个「线种」下拉，把这个函数换掉即可。
 */
function guessStringType(model) {
  const text = String(model || '').toLowerCase();
  if (!text) return 'poly';
  // 先判多丝/羊肠/合成肠，最后才落到 poly（poly 关键词最宽）
  for (const type of ['gut', 'multi', 'syn']) {
    if (STRING_TYPE_HINTS[type].some((hint) => text.includes(hint))) return type;
  }
  return 'poly';
}

/* ---------------------------- 主逻辑 ---------------------------- */

function clampNumber(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

/** 数字显示：整数不带小数点，小数最多留一位 */
function num(value, decimals = 1) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '0';
  return n % 1 === 0 ? String(n) : n.toFixed(decimals);
}

/** 去重收集反馈标签（客户可能每次点同一批） */
function collectTags(logs) {
  const tags = new Set();
  logs.forEach((log) => {
    if (!log || !log.feedback) return;
    String(log.feedback).split('|').forEach((tag) => {
      if (tag.trim()) tags.add(tag.trim());
    });
  });
  return tags;
}

/** 有温度记录时取最近几条的平均，样本太少就不给温度建议 */
function averageTemperature(logs) {
  const temps = logs
    .filter((log) => log.temperature_c !== null && log.temperature_c !== undefined)
    .slice(0, 5)
    .map((log) => Number(log.temperature_c))
    .filter((value) => Number.isFinite(value));
  if (temps.length < 2) return null;
  return temps.reduce((sum, value) => sum + value, 0) / temps.length;
}

/** 一条线（主线或横线）的健康度 */
function lineHealth(line, logs, now) {
  const model = line.model;
  const type = guessStringType(model);
  const life = LINE_LIFE[type];
  const totalHours = logs.reduce((sum, log) => sum + Number(log.duration_hours || 0), 0);
  const days = Math.max(0, (now - new Date(line.strungAt).getTime()) / 86400000);

  const hoursProgress = totalHours / life.hours;
  const daysProgress = days / life.days;
  const wear = Math.max(hoursProgress, daysProgress);
  const base = 100 - 100 * wear;

  const tags = collectTags(logs);
  const penalty = [...tags].reduce((sum, tag) => sum + (WEAR_PENALTY[tag] || 0), 0);
  const score = clampNumber(Math.round(base - penalty), 0, 100);

  return {
    type,
    score,
    totalHours,
    days,
    limitHours: life.hours,
    limitDays: life.days,
    dominant: hoursProgress >= daysProgress ? 'hours' : 'days',
  };
}

function healthLevel(score) {
  if (score >= 60) return 'good';
  if (score >= 30) return 'watch';
  return 'rest';
}

/**
 * 总入口：给一支球拍和它的记录，算健康度与下次磅数。
 * 返回的都是「键 + 变量」，文案交给 i18n 渲染，方便三语。
 */
function evaluateAdvice(racket, logs) {
  const now = Date.now();
  const list = logs || [];
  const tags = collectTags(list);

  const main = lineHealth(
    { model: racket.main_model, strungAt: racket.strung_at },
    list,
    now,
  );
  const cross = racket.cross_model
    ? lineHealth({ model: racket.cross_model, strungAt: racket.strung_at }, list, now)
    : null;

  // 子母线取两条线里更差的那条：哪条先死，整支拍就先废
  const worst = cross && cross.score < main.score ? cross : main;
  const score = worst.score;
  const level = healthLevel(score);

  const reasons = [];
  if (worst.dominant === 'hours') {
    reasons.push({
      key: 'adv.why.hours',
      vars: { h: num(worst.totalHours), limit: worst.limitHours, type: `adv.type.${worst.type}` },
    });
  } else {
    reasons.push({
      key: 'adv.why.days',
      vars: {
        d: Math.round(worst.days / 7),
        limit: worst.limitDays,
        type: `adv.type.${worst.type}`,
      },
    });
  }
  if (tags.has('tensionLoss')) reasons.push({ key: 'adv.reason.tensionLoss', vars: {} });
  if (tags.has('stringBreak')) reasons.push({ key: 'adv.reason.break', vars: {} });

  /* ---------------- 磅数建议 ---------------- */

  const currentMain = Number(racket.main_tension);
  const currentCross = racket.cross_tension === null || racket.cross_tension === undefined
    ? null
    : Number(racket.cross_tension);

  let delta = 0;
  const tensionReasons = [];

  const avgTemp = averageTemperature(list);
  if (avgTemp !== null) {
    const gap = avgTemp - TEMP_REFERENCE_C;
    if (Math.abs(gap) >= 5) {
      const tempDelta = clampNumber(Math.round(gap * TEMP_LBS_PER_DEGREE), -TEMP_DELTA_CAP, TEMP_DELTA_CAP);
      delta += tempDelta;
      tensionReasons.push({
        key: gap > 0 ? 'adv.reason.hot' : 'adv.reason.cold',
        vars: { t: Math.round(avgTemp), ref: TEMP_REFERENCE_C },
      });
    }
  } else {
    tensionReasons.push({ key: 'adv.reason.noTemp', vars: {} });
  }

  const plus = PLUS_TENSION_TAGS.filter((tag) => tags.has(tag));
  const minus = MINUS_TENSION_TAGS.filter((tag) => tags.has(tag));

  // 同一组信号只算一次：客户点三个「太弹」不等于要加 6 磅
  if (plus.length) {
    delta += 2;
    tensionReasons.push({ key: 'adv.reason.plus', vars: {} });
  }
  if (minus.length) {
    delta -= 2;
    tensionReasons.push({ key: 'adv.reason.minus', vars: {} });
  }
  if (tags.has('stringMove')) {
    delta += 1;
    tensionReasons.push({ key: 'adv.reason.move', vars: {} });
  }
  if (tags.has('stringBreak')) {
    delta -= 1;
    tensionReasons.push({ key: 'adv.reason.weak', vars: {} });
  }

  delta = clampNumber(Math.round(delta), -TENSION_DELTA_CAP, TENSION_DELTA_CAP);

  const suggestTension = (current) => {
    if (!Number.isFinite(current)) return null;
    return clampNumber(Math.round((current + delta) * 2) / 2, TENSION_FLOOR, TENSION_CEIL);
  };

  return {
    health: {
      score,
      level,
      which: cross && cross.score < main.score ? 'cross' : 'main',
      reasons: reasons.slice(0, 3),
    },
    tension: {
      currentMain: Number.isFinite(currentMain) ? currentMain : null,
      currentCross: Number.isFinite(currentCross) ? currentCross : null,
      nextMain: suggestTension(currentMain),
      nextCross: currentCross === null ? null : suggestTension(currentCross),
      delta,
      reasons: tensionReasons.slice(0, 3),
    },
    // 记录太少时不给分数，免得显示一个没意义的高分
    enoughData: list.length >= 2 && list.some((log) => Number(log.duration_hours) >= 1),
  };
}
