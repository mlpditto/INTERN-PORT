const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const html = fs.readFileSync('public/admin.html', 'utf8');
// Profile/Group tabs were replaced by an always-visible profile plus an inline, collapsible group picker.
assert.match(html, /<div id="gs-pane-profile">/, 'profile pane is always visible (no tab hiding)');
assert.match(html, /<div id="gs-pane-group" hidden>/, 'group picker starts collapsed');
// V102.164: the toggle is the main-group chip itself (painted by gsPaintMainGroup), no "Change group" button and no label swap.
assert.doesNotMatch(html, /id="gs-group-toggle" aria-expanded="false" aria-controls="gs-pane-group" onclick="toggleGsGroups\(\)">/, 'no static Change group button');
assert.match(html, /attrs: `id="gs-group-toggle" aria-expanded="\$\{open\}" aria-controls="gs-pane-group" onclick="toggleGsGroups\(\)"`/, 'the chip carries the toggle');
assert.doesNotMatch(html, /gsText\('Change group'/, 'no Change group / Collapse wording left');
const nodes = {};
const context = { gsLanguage: 'en', gsMembMode: false, renderGsGroupList() {}, document: { getElementById: id => nodes[id] ||= { hidden: id === 'gs-pane-group', value: 'unsaved', setAttribute(k, v) { this[k] = v; } } } };
vm.createContext(context);
vm.runInContext(html.slice(html.indexOf('        function gsText('), html.indexOf('\n', html.indexOf('        function gsText('))), context);
vm.runInContext(html.slice(html.indexOf('        function toggleGsGroups('), html.indexOf('        function setUserGroup(')), context);
context.toggleGsGroups();
assert.equal(nodes['gs-pane-group'].hidden, false);
assert.equal(nodes['gs-group-toggle']['aria-expanded'], 'true');
context.toggleGsGroups();
assert.equal(nodes['gs-pane-group'].hidden, true);
assert.equal(nodes['gs-group-toggle']['aria-expanded'], 'false');
assert.equal(nodes['gs-group-toggle'].textContent, undefined, 'the chip text is never rewritten');
assert.equal(nodes['gs-pane-profile'], undefined, 'toggling groups never touches the profile pane');
assert.equal(nodes['gs-pane-group'].value, 'unsaved');
console.log('PASS: User Hub group picker toggles from the main-group chip without resetting panel state');
