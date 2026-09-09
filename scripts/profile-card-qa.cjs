const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const html = fs.readFileSync('public/index.html', 'utf8');
for (const file of ['public/index.html', 'public/admin.html']) {
    for (const m of fs.readFileSync(file, 'utf8').matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)) {
        if (!/src=|application\/ld\+json|importmap|type="module"/.test(m[1])) new vm.Script(m[2], { filename: file });
    }
}
const elements = {};
let logToday = false;
const ctx = {
    document: { getElementById: id => elements[id] ||= { style: {}, innerHTML: '', textContent: '', scrollIntoView() {} } },
    getBangkokDateTimeParts: () => ({ dateKey: '2026-09-10' }),
    _lastActivityDateKey: cache => cache[0]?.key,
    _combinedLogCache: () => [],
    _activityDoneToday: () => logToday,
    computeEngagementStreak: () => ({ streak: 3, doneToday: true }),
    myCheckin: { lastDate: '2026-09-10' },
    window: { myCasesCache: [] },
    CHECKIN_STREAK_BONUS_AMOUNT: 0.05,
    CHECKIN_STREAK_BONUS_EVERY: 7,
    schParseDay: v => v ? new Date(v + 'T00:00:00') : null,
    myOwnRow: () => ({}), SCH_MAX_SPAN_DAYS: 182,
    certRequiredForDays: () => 10, CERT_PACE_GRACE: 0.1,
};
vm.createContext(ctx);
function load(start, end) { vm.runInContext(html.slice(html.indexOf(start), html.indexOf(end, html.indexOf(start))), ctx); }
load('        const profileActivityState', '        // V95.88:');
load('        function renderDailyCheckinCard()', '        // V96.41:');
load('        function updateTimelineBar(', '        // V97.05: the single Schedule entry');
load('        function gotoLog()', '        function renderDailyCheckinCard()');
const caption = ctx._activityChipCaption;
assert.equal(caption([], ['loading']), 'กำลังโหลดประวัติ…');
assert.equal(caption([], ['ready', 'error']), 'โหลดประวัติไม่สำเร็จ');
assert.equal(caption([], ['ready']), 'ยังไม่เคยส่ง');
assert.match(caption([{key:'2026-06-16'}], ['ready']), /1 รายการ · ล่าสุด 86 วันก่อน/);
assert.match(caption([{key:'2026-09-10'}], ['ready']), /ล่าสุด วันนี้/);
assert.match(caption([{}], ['ready']), /ไม่ทราบวันที่/);
ctx.renderDailyCheckinCard();
assert.match(elements['daily-checkin-card'].innerHTML, /กำลังโหลดประวัติ/);
vm.runInContext("Object.keys(profileActivityState).forEach(k => profileActivityState[k] = 'ready')", ctx);
ctx.renderDailyCheckinCard();
assert.match(elements['daily-checkin-card'].innerHTML, /ยังไม่เคยส่ง/);
assert.match(elements['daily-checkin-card'].innerHTML, /อีก 4 วันถึงโบนัส/);
logToday = true; ctx.renderDailyCheckinCard();
assert.match(elements['daily-checkin-card'].innerHTML, /เขียน Log เพิ่มเติม · ส่งแล้ววันนี้/);
const timeline = ctx.updateTimelineBar;
for (const [start,end,profile,word] of [
    ['1988-11-08','2088-11-08',{notAnInternship:true},'ส่วนตัว'],
    ['1988-11-08','2088-11-08',{},'182'],
    ['','',{},'ตรวจสอบ'], ['2026-10-16','2026-09-07',{},'ตรวจสอบ'], ['bad','2026-09-07',{},'ตรวจสอบ']
]) {
    timeline(start,end,0,profile);
    assert.equal(elements['u-tl-progress'].style.display,'none');
    assert.ok(elements['u-period-status'].textContent.includes(word));
}
timeline('2026-09-07','2026-10-16',1,{});
assert.equal(elements['u-tl-progress'].style.display,'block');
assert.equal(elements['u-period-status'].style.display,'none');
timeline('2026-01-01','2026-02-01',20,{});
assert.equal(elements['u-tl-bar'].style.width,'100%');
let destination;
ctx.switchMissionTab = tab => destination = tab;
ctx.gotoLog(); assert.equal(destination,'reflection');
ctx.switchCaseTab = tab => destination = tab;
ctx.gotoCaseSubmit(); assert.equal(destination,'submit');
if (process.argv[2]) {
    logToday = false; ctx.renderDailyCheckinCard();
    let card = html.slice(html.indexOf('<div id="section-profile-combined"'));
    let depth=0, end=0;
    for(const m of card.matchAll(/<\/?div\b[^>]*>/g)) { depth += m[0].startsWith('</') ? -1 : 1; if(!depth){end=m.index+m[0].length;break;} }
    card = card.slice(0,end);
    const styles = [...html.matchAll(/<style[^>]*>[\s\S]*?<\/style>/g)].map(m=>m[0]).join('\n');
    const data = JSON.stringify(elements['daily-checkin-card'].innerHTML);
    fs.writeFileSync(process.argv[2], '<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'+styles+'<body>'+card+'<script>document.getElementById("daily-checkin-card").innerHTML='+data+';document.getElementById("u-name").textContent="ผู้ใช้ตัวอย่างชื่อยาวสำหรับตรวจการแสดงผลบนมือถือ";</script></body>');
}
console.log('PASS: both page scripts, activity states, timeline modes, and Log/Case destinations');

