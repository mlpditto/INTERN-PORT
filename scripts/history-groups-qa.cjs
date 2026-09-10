const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const html = fs.readFileSync('public/admin.html', 'utf8');
const ctx = {};
vm.createContext(ctx);
vm.runInContext(html.slice(html.indexOf('        function groupHubHistoryEvents('), html.indexOf('        window.renderHubHistoryPage')), ctx);
const events = [
    {taskKey:'quiz:1_u', type:'beri', beriAmount:5},
    {type:'quiz', text:'same title', score:0.7},
    {taskKey:'quiz:1_u', type:'quiz', score:0.7},
    {taskKey:'quiz:1_u', type:'beri', beriAmount:10},
    {type:'quiz', text:'same title', score:-1},
    {taskKey:'quiz:2_u', type:'quiz', score:1}
];
const groups = ctx.groupHubHistoryEvents(events);
assert.equal(groups.length,4);
assert.equal(groups[0].events.length,3);
assert.equal(groups[0].points,0.7);
assert.equal(groups[0].beri,15);
assert.equal(groups.flatMap(g=>g.events).length,events.length);
assert.equal(ctx.groupHubHistoryEvents(events.filter(e=>e.type==='beri'))[0].beri,15);
assert.equal(ctx.groupHubHistoryEvents([]).length,0);
console.log('PASS: stable IDs, separate currencies, legacy rows, filters and no lost events');
