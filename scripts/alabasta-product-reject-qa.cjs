// V102.86: Alabasta Phase 3 — Reject modal as a chip rail, Product pane in the same lean shape as the Case pane,
// and the Inbox banner listing pending products too. REAL markup/CSS/render functions from public/admin.html.
const fs = require('node:fs'), assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

const html = fs.readFileSync('public/admin.html', 'utf8');
function grabFn(name) {
  let i = html.indexOf('function ' + name + '(');
  assert(i > -1, 'missing function ' + name);
  if (html.slice(i - 6, i) === 'async ') i -= 6;
  let d = 0;
  for (let j = html.indexOf('{', i); j < html.length; j++) {
    if (html[j] === '{') d++;
    else if (html[j] === '}' && --d === 0) return html.slice(i, j + 1);
  }
  throw new Error('unbalanced ' + name);
}
function grabDiv(id) {
  const i = html.indexOf('<div id="' + id + '"');
  assert(i > -1, 'missing #' + id);
  let d = 0; const re = /<div\b|<\/div>/g; re.lastIndex = i; let m;
  while ((m = re.exec(html))) {
    d += m[0] === '</div>' ? -1 : 1;
    if (d === 0) return html.slice(i, m.index + 6);
  }
  throw new Error('unbalanced #' + id);
}
function grabConst(name) {
  const i = html.indexOf('const ' + name + ' = [');
  assert(i > -1, 'missing const ' + name);
  return html.slice(i, html.indexOf('];', i) + 2);
}

(async () => {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } }); const pageErrors = []; page.on('pageerror', e => pageErrors.push(e.message));
    const styles = [...html.matchAll(/<style\b[^>]*>[\s\S]*?<\/style>/gi)].map(m => m[0]).join('');
    await page.setContent('<meta charset="utf-8">' + styles + '<div id="tab-alabasta">' + grabDiv('alabasta-inbox-section') + grabDiv('alabastaRejectModal') + grabDiv('alabasta-case-section') + '</div>');
    const fns = ['alabastaInitials', 'alabastaAgo', 'renderAlabastaInbox', 'toggleAlabastaInbox', 'isAlabastaProductRejected', 'isAlabastaProductReviewed', 'isAlabastaProductPending', 'getAlabastaProductCategory', 'renderAlabastaProductCategoryPills',
      'getFilteredAlabastaProducts', 'renderAlabastaProducts', 'syncProductExportButton', 'syncAlabastaSubtabCounts', 'setAlabastaProductStatusFilter', 'setAlabastaProductCategoryFilter',
      'openAlabastaRejectModal', 'closeAlabastaRejectModal', 'toggleAlabastaRejectCustom', 'rejectWithPreset', 'confirmAlabastaRejectCustom', '_persistAlabastaReject'].map(grabFn).join('\n');
    const ts = (n) => `{ toDate: () => new Date(Date.now() - ${n} * 3600e3), toMillis: () => Date.now() - ${n} * 3600e3 }`;
    await page.addScriptTag({
      content: `
      ${grabConst('ALABASTA_PRODUCT_CATEGORIES')}
      window.alabastaProductCategoryFilter = 'all'; window.alabastaProductStatusFilter = 'all';
      var activeBoardGroup = 'All', usersData = [];
      var casesData = [
        { id: 'a', status: 'pending', displayName: 'P1', customer: 'สมชาย มีสุข', caseId: 'HN1', disease: 'Pneumonia', note: 'n', timestamp: ${ts(1)} },
        { id: 'b', status: 'pending', displayName: 'P2', customer: 'x y', caseId: 'HN2', disease: 'DM', note: 'n', timestamp: ${ts(5)} },
      ];
      var productListingsData = [
        { id: 'p1', status: 'pending', displayName: 'U1', name: 'Paracetamol 500', packSize: '10 tabs', categoryKey: 'otc', price: 35, description: 'fever and pain relief tablets', platforms: ['LINE MAN', 'Grab'], timestamp: ${ts(2)} },
        { id: 'p2', status: 'pending', displayName: 'U2', name: 'Vitamin C', categoryKey: 'supplement', price: 120, promoPrice: 99, description: 'daily', timestamp: ${ts(3)} },
        { id: 'p3', status: 'reviewed', adminBonus: 1.25, displayName: 'U3', name: 'Face wash', categoryKey: 'cosmeceutical', price: 200, description: 'gentle', timestamp: ${ts(30)} },
      ];
      window.computeProductDuplicates = () => new Map(); window.renderProductStatsCard = () => {};
      // Fake Firestore: records every write so the REAL _persistAlabastaReject can be checked end to end.
      window.writes = [];
      var db = {
        collection: (c) => ({ doc: (id) => ({ _c: c, _id: id, update: async (d) => { writes.push({ kind: 'update', col: c, id, d }); } }) }),
        batch: () => ({ update: (ref, d) => writes.push({ kind: 'batchUpdate', col: ref._c, id: ref._id, d }), commit: async () => { writes.push({ kind: 'commit' }); } }),
      };
      var firebase = { firestore: { FieldValue: { serverTimestamp: () => 'TS' } } };
      var ALLOWED_EMAIL = 'admin@test';
      var stageSubmissionMirror = async (batch, id, fields) => { writes.push({ kind: 'mirror', id, fields }); return 1; };
      function showToast() {}
      function renderAlabastaCases() {}
      ${fns}
      document.getElementById('alabasta-product-pane').style.display = '';
      document.getElementById('alabasta-product-status-rail').style.display = '';
      renderAlabastaProducts();`
    });
    const prow = () => page.locator('#alabastaProductTable tbody tr').count();
    const txt = (id) => page.locator('#' + id).innerText();

    // ---- Inbox lists cases AND products
    assert.match(await page.locator('#alabasta-inbox-section').innerText(), /4\s+waiting for review/);
    await page.locator('#alabasta-inbox-toggle').click();
    assert.equal(await page.locator('#alabasta-inbox-body').isVisible(), true);
    assert.equal(await page.locator('#alabasta-inbox-container .alabasta-inbox-card').count(), 4);
    assert.equal(await page.locator('#alabasta-inbox-container .alabasta-inbox-kind').count(), 2);
    // newest first across kinds: P1 (1h), p1 (2h), p2 (3h), P2 (5h)
    const names = await page.locator('#alabasta-inbox-container .alabasta-inbox-card b').allInnerTexts();
    assert.deepEqual(names, ['P1', 'U1', 'U2', 'P2']);

    // ---- Product table: 8 columns, status rail with stable counts
    // V3: lands on Pending when something waits; no archive toggle (All = every product)
    assert(await page.locator('#alabasta-product-status-pending').evaluate(n => n.classList.contains('active')), 'default chip = Pending');
    assert.equal(await prow(), 2);
    assert.equal(await page.locator('#alabasta-product-archived-toggle, #alabasta-product-show-archived').count(), 0);
    await page.evaluate(() => setAlabastaProductStatusFilter('all'));
    assert.equal(await page.locator('#alabastaProductTable thead th').count(), 8);
    assert.equal(await prow(), 3);
    assert.deepEqual([await txt('alabasta-product-total'), await txt('alabasta-product-pending'), await txt('alabasta-product-reviewed')], ['3', '2', '1']);
    await page.locator('#alabasta-product-status-pending').click();
    assert.equal(await prow(), 2);
    assert.deepEqual([await txt('alabasta-product-total'), await txt('alabasta-product-pending'), await txt('alabasta-product-reviewed')], ['3', '2', '1']);
    assert(await page.locator('#alabasta-product-status-pending').evaluate(n => n.classList.contains('active')));
    assert.match(await page.locator('#alabasta-product-export-btn').innerText(), /\(2\)/);
    await page.locator('#alabasta-product-status-reviewed').click();
    assert.equal(await prow(), 1);
    await page.locator('#alabasta-product-status-all').click();
    assert.equal(await prow(), 3);
    assert.equal(await page.locator('#alabastaProductTable tr.alabasta-row-pending .alabasta-go-btn').count(), 2);
    assert.equal(await page.locator('#alabastaProductTable tr:not(.alabasta-row-pending) .is-reopen').count(), 1);
    assert.equal(await page.locator('#alabastaProductTable .alabasta-more-menu-item', { hasText: 'Delete product' }).count(), 3);
    const firstRow = await page.locator('#alabastaProductTable tbody tr').first().innerText();
    assert(firstRow.includes('Paracetamol 500') && firstRow.includes('10 tabs') && firstRow.includes('LINE MAN, Grab') && firstRow.includes('฿35.00'), 'product cell carries name, pack, platforms, price: ' + firstRow);
    assert(!firstRow.includes('Platform'), 'no separate Platform column');
    await page.evaluate(() => setAlabastaProductStatusFilter('pending'));
    await page.evaluate(() => { productListingsData.forEach(p => p.status = 'reviewed'); renderAlabastaProducts(); });
    assert.match(await page.locator('#alabastaProductTable tbody').innerText(), /No products waiting for review/);

    // ---- Product reject: its own state, chip, row actions, modal kind and writes
    await page.evaluate(() => {
      productListingsData.forEach((p, i) => { p.status = i < 2 ? 'pending' : 'reviewed'; });
      productListingsData.push({ id: 'p4', status: 'rejected', isArchived: true, rejectedReason: 'ซ้ำ', displayName: 'U4', name: 'Duplicate item', categoryKey: 'otc', price: 10, description: 'dup', timestamp: { toDate: () => new Date(), toMillis: () => Date.now() - 3600e3 } });
      setAlabastaProductStatusFilter('all');
    });
    assert.deepEqual([await txt('alabasta-product-total'), await txt('alabasta-product-pending'), await txt('alabasta-product-reviewed'), await txt('alabasta-product-rejected')], ['4', '2', '1', '1']);
    assert.match(await page.locator('#alabasta-inbox-section').innerText(), /4\s+waiting for review/, 'a rejected product is not "waiting"');
    await page.locator('#alabasta-product-status-rejected').click();
    assert.equal(await prow(), 1);
    assert.match(await page.locator('#alabastaProductTable tbody').innerText(), /Rejected/);
    assert.equal(await page.locator('#alabastaProductTable .is-reopen').count(), 1);
    assert.equal(await page.locator('#alabastaProductTable .alabasta-go-btn').count(), 0);
    assert(await page.locator('#alabasta-product-status-rejected').evaluate(n => n.classList.contains('active')));
    await page.locator('#alabasta-product-status-all').click();
    assert.equal(await prow(), 4);
    assert.equal(await page.locator('#alabastaProductTable tr.alabasta-row-pending .is-reject').count(), 2, 'pending rows offer Reject');
    assert.equal(await page.locator('#alabastaProductTable tr:not(.alabasta-row-pending) .is-reject').count(), 0);
    assert.equal(await page.evaluate(() => [isAlabastaProductPending(productListingsData[3]), isAlabastaProductReviewed(productListingsData[3]), isAlabastaProductRejected(productListingsData[3])].join()), 'false,false,true');
    await page.evaluate(() => { writes.length = 0; openAlabastaRejectModal('p1', 'product'); });
    assert.equal(await txt('alabasta-reject-title'), 'Reject Product');
    assert.match(await txt('alabasta-reject-context'), /Paracetamol 500 · U1/);
    await page.locator('.alabasta-reject-preset').nth(0).click();
    const w = await page.evaluate(() => writes);
    assert.deepEqual(w.map(x => x.kind + ':' + (x.col || '') + ':' + x.id), ['batchUpdate:product_listings:p1', 'mirror::p1', 'commit::undefined']);
    assert.equal(w[0].d.status, 'rejected');
    assert.equal(w[0].d.isArchived, true);
    assert.equal(w[0].d.adminBonus, 0);
    assert.equal(w[0].d.rejectedReason, 'ข้อมูลไม่ครบ · Incomplete info');
    assert.equal(w[1].fields.status, 'rejected', 'the intern mirror leaves "pending"');
    assert.equal(w[1].fields.score, 0);
    assert.equal(await page.evaluate(() => writes.some(x => x.col === 'cases')), false, 'no case is touched');
    // the modal goes back to "Case" next time
    await page.evaluate(() => openAlabastaRejectModal('a'));
    assert.equal(await txt('alabasta-reject-title'), 'Reject Case');
    await page.evaluate(() => { closeAlabastaRejectModal(); productListingsData.pop(); writes.length = 0; setAlabastaProductStatusFilter('all'); });

    // ---- empty chrome: category rail hidden for one category, header hidden when empty
    await page.evaluate(() => { productListingsData.forEach(p => { p.categoryKey = 'otc'; }); window.alabastaProductStatusFilter = 'all'; renderAlabastaProducts(); });
    assert.equal(await page.locator('#alabasta-product-category-pills').evaluate(n => getComputedStyle(n).display === 'none'), true, 'single category → rail hidden');
    await page.evaluate(() => { productListingsData[0].categoryKey = 'supplement'; renderAlabastaProducts(); });
    assert.equal(await page.locator('#alabasta-product-category-pills').evaluate(n => getComputedStyle(n).display !== 'none' && n.children.length > 1), true, 'two categories → rail shown');
    assert.equal(await page.locator('#alabastaProductTable thead').evaluate(n => getComputedStyle(n).display !== 'none'), true);
    assert.equal(await page.locator('#alabasta-product-status-rail #alabasta-product-category-pills > button').count(), 2, 'category pills sit inside the status rail');
    assert.equal(await page.locator('#alabasta-product-category-pills').evaluate(n => /All/.test(n.textContent)), false, 'no second All');
    await page.locator('#alabasta-product-category-pills > button').nth(1).click();
    assert.equal(await page.evaluate(() => window.alabastaProductCategoryFilter), 'supplement');
    await page.locator('#alabasta-product-category-pills > button.active').click();
    assert.equal(await page.evaluate(() => window.alabastaProductCategoryFilter), 'all', 'tapping the active category again clears it');
    await page.evaluate(() => { productListingsData.length = 0; renderAlabastaProducts(); });
    assert.equal(await page.locator('#alabastaProductTable thead').evaluate(n => getComputedStyle(n).display === 'none'), true, 'no products → no column titles');

    // ---- Reject modal: chip rail, same stored reasons
    await page.evaluate(() => openAlabastaRejectModal('a'));
    assert.equal(await page.locator('#alabastaRejectModal').isVisible(), true);
    assert.match(await txt('alabasta-reject-context'), /P1 · HN1 · Pneumonia/);
    const chips = page.locator('#alabasta-reject-presets > button');
    assert.equal(await chips.count(), 4);
    const tops = await chips.evaluateAll(els => els.map(e => Math.round(e.getBoundingClientRect().top)));
    assert(Math.max(...tops) - Math.min(...tops) <= 4, 'preset chips share one row: ' + tops);
    assert.deepEqual(await page.locator('.alabasta-reject-preset').evaluateAll(els => els.map(e => e.dataset.reason)),
      ['ข้อมูลไม่ครบ · Incomplete info', 'เคสซ้ำ · Duplicate', 'ไม่เกี่ยวข้อง · Not relevant']);
    await page.locator('.alabasta-reject-preset').nth(1).click();
    // the CASE path is unchanged: one update on cases/a, nothing on product_listings or the mirror
    assert.deepEqual(await page.evaluate(() => writes.map(w => w.kind + ':' + w.col + ':' + w.id)), ['update:cases:a']);
    assert.equal(await page.evaluate(() => writes[0].d.rejectedReason), 'เคสซ้ำ · Duplicate');
    assert.equal(await page.evaluate(() => writes[0].d.isArchived), true);
    // "Other" opens the textarea and rejects nothing by itself
    await page.evaluate(() => { writes.length = 0; openAlabastaRejectModal('a'); });
    await page.locator('#alabasta-reject-custom-toggle').click();
    assert.equal(await page.locator('#alabasta-reject-custom').isVisible(), true);
    assert.equal(await page.locator('#alabasta-reject-custom-toggle').isVisible(), false);
    assert.equal(await page.evaluate(() => writes.length), 0);
    // re-opening resets the custom state
    await page.evaluate(() => openAlabastaRejectModal('b'));
    assert.equal(await page.locator('#alabasta-reject-custom-toggle').isVisible(), true);
    assert.equal(await page.locator('#alabasta-reject-custom').isVisible(), false);

    // ---- phone width: product rail does not spill
    await page.setViewportSize({ width: 390, height: 800 });
    assert(await page.locator('#alabasta-product-status-rail').evaluate(n => n.scrollWidth <= n.clientWidth + 1));
    assert.deepEqual(pageErrors, []);
    console.log('PASS: Alabasta phase 3 — reject chip rail, product lean table + status rail, inbox lists products');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
