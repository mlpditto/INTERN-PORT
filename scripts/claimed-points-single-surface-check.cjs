// V102.497: "Points Claimed" has ONE surface — the Dashboard table (#pointsClaimedTable). The Kanban "Review" column no longer draws a duplicate card
// (same call as V96.77 for pending quizzes and V102.322 for access requests). Source check on public/admin.html.
const assert = require('assert');
const fs = require('fs');
const src = fs.readFileSync('public/admin.html', 'utf8').replace(/\r\n/g, '\n');

const kb = src.slice(src.indexOf('function drawKanban()'), src.indexOf('function drawKanban()') + 30000);
const kbEnd = kb.indexOf('\n        }\n\n');
const draw = kbEnd > 0 ? kb.slice(0, kbEnd) : kb;
assert(draw.length > 1000, 'drawKanban found');
assert(!draw.includes('pointsClaimedCache'), 'drawKanban no longer reads pointsClaimedCache');
assert(!src.includes('claimed-card'), 'the Kanban claimed card is gone');
assert(!src.includes('Bonus already claimed'), 'its text is gone');

// the table is untouched: rows, edit score, Got it, archive, and the shared empty-state still watches its section
assert(src.includes('id="pointsClaimedTable"') && src.includes('id="points-claimed-section"'), 'the Dashboard table stays');
const listener = src.slice(src.indexOf('function loadPointsClaimedNotifications()'), src.indexOf('async function acknowledgeClaimedPoints'));
assert(listener.includes("acknowledgeClaimedPoints('${doc.id}')") && listener.includes('editScoreAdjustment('), 'table rows keep Got it + edit score');
assert(!/drawKanban\(\)/.test(listener), 'the listener no longer re-draws the Kanban for a card that is not there');
assert(listener.split('updateReviewQueueEmptyState();').length - 1 === 2, 'the shared "nothing to review" state is still updated by the table');
assert(src.includes("'points-claimed-section'"), 'updateReviewQueueEmptyState still counts the table');
console.log('claimed-points-single-surface-check: PASS');
