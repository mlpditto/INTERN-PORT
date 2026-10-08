// functions/flood-tier.js + its wiring in checkFloodAlerts: tiers 1-4 from the nearest canal gauge, planned around a ~6 h lead time.
// Base case = the real gauge next to the training site (ค.จั่น ถ.โยธินพัฒนา, 0.5 km): warn 0.30, crit 0.40, reading -0.05 (35 cm to warn).
// No network: readings and history are injected.
const fs = require('node:fs');
const assert = require('node:assert/strict');
const { floodTier, gaugeRate, pushReading, LEAD_H, KEEP_H } = require('../functions/flood-tier.js');

const H = 3600e3, now = Date.UTC(2026, 9, 8, 6, 0, 0);
const canal = (o) => ({ name: 'ค.จั่น', km: 0.5, wl: -0.05, warn: 0.30, crit: 0.40, level: 'ok', trend: 'up', deltaCm: 2, dayCm: 10, ...o });
const site = (c, extra) => ({ risk: 'low', pop: { canals: [c] }, road: null, ...extra });
const hist = (...pairs) => pairs.map(([agoH, wl]) => ({ t: now - agoH * H, wl }));   // [hoursAgo, level]
const T = (c, h, extra) => floodTier(site(c, extra), h, now);

assert.deepEqual(LEAD_H, { 1: 12, 2: 6 }, 'lead times: 12 h heads-up, 6 h prepare');

// ---- rate of rise ----
assert.deepEqual(gaugeRate(canal({}), hist([3, -0.20]), now), { rate: 5, basis: '3 h' }, '15 cm in 3 h = 5 cm/h');
assert.equal(gaugeRate(canal({}), hist([1, -0.10], [3.2, -0.20], [4, -0.30]), now).basis, '3.2 h', 'the reading closest to 3 h wins; the 1 h one is too short');
assert.deepEqual(gaugeRate(canal({ deltaCm: 4 }), hist([1, -0.09]), now), { rate: 4, basis: '1 h' }, 'no 3 h reading yet: the gauge own 1 h change');
assert.equal(gaugeRate(canal({ deltaCm: null }), [], now).rate, null);

// ---- tiers 0-2: from the ETA to the watch mark ----
assert.equal(T(canal({}), hist([3, -0.05])).tier, 0, 'flat: nothing');
assert.equal(T(canal({}), hist([3, -0.08])).tier, 0, '1 cm/h with 35 cm left -> 35 h: too far to matter');
assert.equal(T(canal({}), hist([3, -0.14])).tier, 1, '3 cm/h -> 11.7 h: heads-up');
assert.equal(T(canal({}), hist([3, -0.20])).tier, 1, '5 cm/h -> 7 h: heads-up');
assert.equal(T(canal({}), hist([3, -0.20])).etaH, 7);
assert.equal(T(canal({}), hist([3, -0.38])).tier, 2, '11 cm/h -> 3.2 h: prepare');
assert.equal(T(canal({}), hist([3, -0.50])).tier, 2, '15 cm/h -> 2.3 h: prepare');
assert.equal(T(canal({ deltaCm: 6 }), []).tier, 2, 'no history yet: 6 cm/h from the 1 h change -> 5.8 h: prepare');
assert.equal(T(canal({ deltaCm: 3 }), []).tier, 1);
assert.equal(T(canal({ deltaCm: 2 }), []).tier, 0, '2 cm/h -> 17.5 h');
assert.equal(T(canal({ deltaCm: -1 }), hist([3, -0.50])).tier, 0, 'fell in the last hour: not rising, whatever the 3 h average says');
const noise = T(canal({}), hist([3, -0.071]));
assert.equal(noise.tier, 0); assert.equal(noise.etaH, null, '0.7 cm/h is below the 1 cm/h noise guard');

// ---- tiers 3-4 ----
assert.equal(T(canal({ wl: 0.31, level: 'warn' }), []).tier, 3, 'at the watch mark');
assert.equal(T(canal({ wl: 0.30 }), []).tier, 3, 'exactly on the mark even if the gauge level flag lags');
assert.equal(T(canal({ wl: 0.41, level: 'crit' }), []).tier, 4, 'critical mark');
assert.equal(T(canal({}), [], { road: { nearest: { m: 200, closed: true } } }).tier, 4, 'road within 500 m closed');
assert.equal(T(canal({}), [], { road: { nearest: { m: 200, depthCm: 30 } } }).tier, 4, 'road within 500 m, 30 cm');
assert.equal(T(canal({}), [], { road: { nearest: { m: 200, depthCm: 29 } } }).tier, 0, '29 cm is not enough');
assert.equal(T(canal({}), [], { road: { nearest: { m: 600, depthCm: 50 } } }).tier, 0, 'too far away');
assert.equal(T(canal({}), [], { risk: 'high' }).tier, 4, 'FloodWatch High');

// ---- no usable gauge ----
assert.equal(T(canal({ km: 5, wl: 0.5, level: 'crit' }), []).tier, 0, 'a gauge > 3 km away says nothing about the site');
assert.equal(T(canal({ level: 'unk' }), hist([3, -0.5])).tier, 0, 'offline gauge');
assert.equal(T(canal({ wl: null }), []).tier, 0);
assert.equal(floodTier({ risk: 'low', pop: null, road: null }, [], now).tier, 0, 'POPNIX down');
assert.equal(floodTier({ risk: 'high', pop: null, road: null }, [], now).tier, 4, 'POPNIX down but FloodWatch High still counts');

// ---- readings kept hour by hour ----
let h = pushReading(undefined, now - 13 * H, -0.5);
h = pushReading(h, now - 2 * H, -0.123);
assert.equal(h.length, 2);
h = pushReading(h, now, -0.05);
assert.deepEqual(h.map(x => x.wl), [-0.12, -0.05], 'older than ' + KEEP_H + ' h dropped, rounded to 2 dp');
assert.equal(pushReading(h, now + H, null).length, 2, 'no reading: nothing added');
assert.equal(pushReading([{ t: now + H, wl: 1 }, null, { t: 'x', wl: 1 }], now, 0.1).length, 1, 'junk and future entries dropped');

// ---- wiring in functions/index.js ----
const src = fs.readFileSync('functions/index.js', 'utf8').replace(/\r\n/g, '\n');
const job = src.slice(src.indexOf('exports.checkFloodAlerts'), src.indexOf('Quiz feedback triage'));
assert.ok(!/lastEmailSlot|floodEarlyWarning/.test(src), 'the old 08:00 / 16:00 rule is gone');
assert.ok(job.includes("floodTier(s, prev.gauge, now)") && job.includes('pushReading(prev.gauge, now'), 'rate comes from the stored readings, current reading excluded');
assert.ok(job.includes("if (docId === '_site') {") && job.includes('const base = prev.tierDay === today ? (prev.tierSent || 0) : 0;') && job.includes('if (w.tier > base) {'), 'site only; fires on escalation, once per tier per day');
assert.ok(job.includes('if (w.tier >= 3 && !rosePushed && target && target.to)'), 'LINE from tier 3, never twice in one run');
assert.ok(job.includes("update.tierSent = w.tier") && job.includes('if (sent)'), 'a failed send is retried next hour');
assert.ok(job.includes("db.collection('flood_gauge_log').doc(today)"), 'calibration log, one field an hour');
assert.ok(!/flood_gauge_log/.test(fs.readFileSync('firestore.rules', 'utf8')), 'log has no client rule (closed, admin SDK only)');

// ---- the mail renders for every tier, with and without a gauge ----
const mailSrc = src.slice(src.indexOf('const FLOOD_TIER_ICON'), src.indexOf('async function sendFloodMail'));
const mail = new Function('FLOOD_SITE', 'floodMapUrl', 'POPNIX_CREDIT', mailSrc + '\nreturn floodEarlyMail;')({ label: 'SITE' }, () => 'https://map', 'credit');
const w2 = T(canal({}), hist([3, -0.50]));
const m2 = mail(w2, site(canal({})), 13.8, 100.6, null, null);
assert.ok(m2.subject.startsWith('🟠 น้ำระดับ 2: ค.จั่น -0.05 ม.') && m2.subject.includes('~2.3 ชม.'), m2.subject);
assert.ok(m2.text.includes('ระดับ 2 เตรียมตัว') && m2.text.includes('เหลืออีก 35 ซม.') && m2.text.includes('ขึ้น +15 ซม./ชม. (เฉลี่ย 3 h)') && m2.text.includes('~2.3 ชม.'));
const w3 = T(canal({ wl: 0.31, level: 'warn', deltaCm: 1 }), []);
const m3 = mail(w3, site(canal({ wl: 0.31 })), 13.8, 100.6, null, null);
assert.ok(m3.subject.startsWith('🔴 น้ำระดับ 3') && m3.text.includes('เกินเกณฑ์เฝ้าระวังแล้ว 1 ซม.'));
const w4 = floodTier({ risk: 'high', pop: null, road: null }, [], now);
const m4 = mail(w4, { risk: 'high', pop: null, road: null }, 13.8, 100.6, null, null);
assert.ok(m4.subject.startsWith('🚨 น้ำระดับ 4') && m4.text.includes('พิจารณาอพยพ') && m4.text.includes('credit'), 'no gauge, no POPNIX: still renders');

console.log('PASS: flood tiers — ETA-to-watch 12 h / 6 h, at-mark, critical / road cut / High; noise + falling + far-gauge guards; hourly readings; escalation-only email, LINE from tier 3; mail renders for every tier');
