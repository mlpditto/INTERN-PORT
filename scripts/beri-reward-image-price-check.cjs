// V102.121 / V101.66: Beri Reward image + full price. Source guards on admin.html / index.html, then the REAL card and row
// templates (sliced out of renderBeriShop / renderBeriRewardsAdmin) run on sample data — no browser.
const fs = require('node:fs');
const assert = require('node:assert/strict');

const admin = fs.readFileSync('public/admin.html', 'utf8').replace(/\r\n/g, '\n');
const index = fs.readFileSync('public/index.html', 'utf8').replace(/\r\n/g, '\n');
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const slice = (src, a, b) => { const i = src.indexOf(a), j = src.indexOf(b, i); assert(i >= 0 && j > i, 'marker ' + a.slice(0, 50)); return src.slice(i + a.length, j); };

// ---- admin: modal fields, save, upload path ----
for (const id of ['br-pic', 'br-pic-x', 'br-file', 'br-name', 'br-desc', 'br-cost', 'br-list', 'br-stock', 'br-active', 'br-off']) assert.ok(admin.includes(`id="${id}"`), id);
assert.ok(admin.includes('accept="image/jpeg,image/png,image/webp"'), 'file input limited to the Storage rule types');
const save = slice(admin, 'async function saveBeriReward() {', 'async function toggleBeriRewardActive');
assert.ok(save.includes("const listCost = listRaw === '' ? null : (parseInt(listRaw, 10) || 0);"), 'blank full price → null');
assert.ok(save.includes('if (listCost != null && listCost < beriCost)'), 'full price below the cost is refused');
assert.ok(save.includes('resizeAdminProductPhoto(brPendingFile)') && save.includes('uploadAdminProductPhoto(blob)'), 'image goes through the Product photo resize (<=1280 px JPEG) + product-images/<sha256>.jpg upload');
assert.ok(save.includes('name, description, beriCost, listCost, stock, imageUrl,'), 'doc carries listCost + imageUrl');
assert.ok(/const path = `product-images\/\$\{hash\}\.jpg`;/.test(admin), 'upload helper still targets product-images/ (admin may write there — no Storage rules deploy)');
const open = slice(admin, 'function openBeriRewardModal(id = null) {', 'async function saveBeriReward');
assert.ok(open.includes("document.getElementById('br-list').value = (r && r.listCost != null) ? r.listCost : '';") && open.includes('brShowImage(brImageUrl)'), 'edit restores full price + image');
// redeem path untouched: the intern transaction still debits beriCost
assert.ok(index.includes('async function redeemBeriReward(rewardId)') && !/redeemBeriReward[\s\S]{0,3000}listCost/.test(index.slice(index.indexOf('async function redeemBeriReward'))), 'redeem never reads listCost');

// ---- admin: lean + inline modal (V102.122, owner pick "B") ----
const modal = slice(admin, '<div id="beriRewardModal" class="modal"', '\n            </div>\n        </div>\n');
assert.ok(!/<label/.test(modal), 'no labels — icons + placeholders + titles');
assert.ok(!/Cancel|Active \(visible/.test(modal), 'no Cancel button, no checkbox text');
assert.ok(modal.includes('class="br-hb br-save" onclick="saveBeriReward()"') && modal.indexOf('br-save') < modal.indexOf('forceHideModal(\'beriRewardModal\')'), '💾 in the header, left of ×');
assert.ok(modal.includes('placeholder="Name"') && modal.includes('placeholder="Description (optional)"'), 'placeholders carry the field names');
for (const ico of ['<i>🪙</i>', '<i>🏷️</i>', '<i>📦</i>']) assert.ok(modal.includes(ico), ico + ' is the label');
assert.ok(modal.includes('id="br-active" checked hidden onchange="brPaintActive()"') && modal.includes('id="br-eye"'), '👁 drives the hidden checkbox saveBeriReward reads');
assert.ok(modal.includes('id="br-off" class="br-off" hidden'), '−N% pill, hidden until a full price above the cost');
assert.ok(admin.includes("el.textContent = off ? `−${off}%` : '';") && admin.includes('el.hidden = !off;'), 'brPreviewOff drives the pill');
assert.ok(/e\.key === 'Enter' && \(e\.ctrlKey \|\| e\.metaKey\)[^\n]*saveBeriReward\(\)/.test(admin), 'Ctrl+Enter saves');

// ---- admin: ✨ Grok Imagine in the image well (V102.122) ----
assert.ok(admin.includes('id="br-pic-ai"') && admin.includes('onclick="event.stopPropagation(); brGenImage()"'), 'sparkle button in the well, does not open the file picker');
const gen = slice(admin, 'async function brGenImage() {', '\n        }\n');
assert.ok(admin.includes("const BR_IMAGE_MODEL = 'or/x-ai/grok-imagine-image-2.0';"), 'xAI Grok Imagine Image 2.0 via OpenRouter');
assert.ok(gen.includes("{ feature: 'beri_reward_image', imageApi: true, aspectRatio: '4:3', maxOutputTokens: 1024 }"), 'Image API path (Seedream/Muse), 4:3, its own ai_usage feature');
assert.ok(gen.includes("if (!name) { alert('Type the reward name first") && gen.includes('no text, no watermark, no people'), 'prompt from name + description');
assert.ok(gen.includes("brPendingFile = new File([blob], 'grok-imagine.png'") && gen.includes('brShowImage(URL.createObjectURL(blob))'), 'result becomes the pending file → uploaded on Save like a picked photo');
assert.ok(gen.includes("btn.textContent = '⏳'") && gen.includes("btn.textContent = '✨'"), 'busy state on the button only');


const rowBody = slice(admin, 'list.innerHTML = beriRewardsCache.map(r => {', "}).join('');");
const offFn = new Function('r', slice(admin, 'function beriRewardOff(r) {', '\n        }') );
const rows = new Function('beriRewardsCache', 'escapeHtml', 'beriRewardOff', 'JSON', 'return beriRewardsCache.map(r => {' + rowBody + "}).join('')");
const R = [
    { id: 'a', name: 'SUPER BEAR', description: 'Bear House', beriCost: 2450, listCost: 3000, stock: 2, isActive: true, imageUrl: 'https://x/y.jpg' },
    { id: 'b', name: 'Money 100.00', description: 'CLICX or DIME', beriCost: 500, listCost: null, stock: 5, isActive: false, imageUrl: '' },
    { id: 'c', name: 'Legacy <b>', beriCost: 10, stock: null }
];
const rowHtml = rows(R, esc, offFn, JSON);
assert.equal(offFn(R[0]), 18); assert.equal(offFn(R[1]), 0); assert.equal(offFn({ beriCost: 100, listCost: 100 }), 0, 'equal price → no discount'); assert.equal(offFn({ beriCost: 100, listCost: 50 }), 0);
assert.ok(rowHtml.includes('<img src="https://x/y.jpg" alt="" class="br-thumb">') && (rowHtml.match(/br-thumb-none/g) || []).length === 2, 'thumb or 🎁 tile per row');
assert.ok(rowHtml.includes('🪙 2,450') && rowHtml.includes('<s>3,000</s> <b style="color:#dc2626;">−18%</b>'), 'cost over struck full price');
assert.ok(!/<s>.*Money/.test(rowHtml) && rowHtml.split('<s>').length === 2, 'no strike without a full price');
assert.ok(rowHtml.includes('Legacy &lt;b&gt;'), 'escaped');
assert.ok(rowHtml.includes('fa-eye"') && rowHtml.includes('fa-eye-slash') && rowHtml.includes('fa-pen') && rowHtml.includes('fa-trash'), 'icon-only actions');
assert.ok(!/>Edit<|>Delete<|>Active<|>Paused<|Stock:/.test(rowHtml), 'no action / stock words — titles carry them');
assert.ok(rowHtml.includes('title="Edit"') && rowHtml.includes('aria-label="Delete"') && rowHtml.includes('title="Stock"'));

// ---- intern: card template on sample data ----
const cardBody = slice(index, 'grid.innerHTML = beriRewardsCache.map(r => {', "}).join('');");
const cards = new Function('beriRewardsCache', 'myBeri', 'escapeHtml', 'return beriRewardsCache.map(r => {' + cardBody + "}).join('')");
const html = cards(R.concat([{ id: 'd', name: 'Sold out', beriCost: 5, listCost: 10, stock: 0 }]), 600, esc);
assert.ok(html.includes('<img src="https://x/y.jpg" alt="" loading="lazy"'), 'image on top');
assert.equal((html.match(/🎁<\/div>/g) || []).length, 3, '🎁 tile for the three without an image');
assert.ok(html.includes('🪙 2,450</b>') && html.includes('<s style="color:#94a3b8; font-size:0.78em;" title="Full price">3,000</s>') && html.includes('−18%'), 'strike + −18%');
assert.equal(html.split('<s ').length - 1, 2, 'strike only where listCost > beriCost (SUPER BEAR, Sold out)');
assert.ok(html.includes('📦 2') && html.includes('📦 หมด') && !html.includes(' left</span>') && !html.includes('· Out of stock'), 'stock as 📦 N / 📦 หมด, one language visible (the English lives in the title)');
assert.ok(html.includes("title='2 left'".replace(/'/g, '"')) && html.includes('title="Out of stock"'));
assert.ok(html.includes('>\n                                    แลกเลย\n') || html.includes('แลกเลย\n'), 'button says แลกเลย only');
assert.ok(!html.includes('แลกเลย · Redeem') && html.includes('title="Redeem"'), 'no bilingual button text; Redeem in the title');
assert.ok(html.includes('Beri ไม่พอ'), '600 Beri cannot afford 2,450');
assert.ok(html.includes('หมดแล้ว') && html.includes('disabled'), 'sold out disabled');
assert.ok(!html.includes('🎁 SUPER BEAR'), 'name no longer prefixed with 🎁 (the image / tile carries it)');

console.log('PASS: beri reward image + full price — modal fields (image well, Beri Cost / Full price / Stock), save validates + uploads via the Product photo helpers to product-images/, redeem untouched, admin rows (thumb, 🪙 cost over struck −N%, 📦, icon-only eye/pen/trash, ✨ Grok Imagine in the well; lean modal: icons as labels, 💾/× header, 👁 toggle, −N% pill, Ctrl+Enter), intern cards (image / 🎁, 🪙 2,450 ~~3,000~~ −18%, 📦 N, แลกเลย), escaping');
