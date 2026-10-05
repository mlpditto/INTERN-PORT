// V102.84: Alabasta Case pane lean header — the REAL markup, CSS and render functions from public/admin.html.
// Checks: maintenance buttons live in one ⋯ menu, Total/Pending/Reviewed are a clickable status rail
// (old ids kept), the rail filters the table, counts stay stable while a chip is active.
const fs = require('node:fs'), assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

const html = fs.readFileSync('public/admin.html', 'utf8');
function grabFn(name) {
  const i = html.indexOf('function ' + name + '(');
  assert(i > -1, 'missing function ' + name);
  let d = 0, k = html.indexOf('{', i);
  for (let j = k; j < html.length; j++) {
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

(async () => {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    const styles = [...html.matchAll(/<style\b[^>]*>[\s\S]*?<\/style>/gi)].map(m => m[0]).join('');
    await page.setContent('<meta charset="utf-8">' + styles + '<div id="tab-alabasta">' + grabDiv('alabasta-inbox-section') + grabDiv('alabasta-case-section') + '</div>');
    const fns = ['alabastaInitials', 'alabastaAgo', 'renderAlabastaInbox', 'toggleAlabastaInbox', 'renderAlabastaSystemFilterPills', 'renderAlabastaCases', 'toggleAlabastaSearch', 'setAlabastaSubtab', 'syncAlabastaDateTriggerLabel', 'setAlabastaStatusFilter', 'setAlabastaSystemFilter', 'closeAlabastaMoreMenus', 'syncAlabastaSubtabCounts']
      .map(grabFn).join('\n');
    const ts = (n) => ({ toDate: () => new Date(Date.now() - n * 3600e3), toMillis: () => Date.now() - n * 3600e3 });
    await page.addScriptTag({
      content: `
      window.alabastaSelectedIds = new Set(); window.alabastaSystemFilter = 'all'; window.alabastaStatusFilter = 'all';
      window.CASE_SYSTEMS = [{ key: 'resp', emoji: '🫁', label: { en: 'Respiratory', ko: '' } }];
      var activeBoardGroup = 'All', usersData = [], productListingsData = [];
      var casesData = [
        { id: 'a', status: 'pending', displayName: 'P1', customer: 'สมชาย มีสุข', caseId: 'HN1', disease: 'Pneumonia', note: 'long note A', diseaseSystemKey: 'resp', timestamp: (${ts.toString()})(1) },
        { id: 'b', status: 'pending', displayName: 'P2', customer: 'เอ็ม ใจดี', caseId: 'HN2', disease: 'DM', note: 'long note B', diseaseSystemKey: 'resp', timestamp: (${ts.toString()})(2) },
        { id: 'c', status: 'reviewed', displayName: 'R1', diseaseSystemKey: 'resp', timestamp: (${ts.toString()})(3) },
      ];
      function renderAlabastaProducts() {} function renderAlabastaBulkToolbar() {} function syncAlabastaSelectAllCheckbox() {}
      function isAlabastaProductReviewed() { return false; }
      ${fns}
      renderAlabastaCases();`
    });
    const rows = () => page.locator('#alabastaCaseTable tbody tr').count();
    const txt = (id) => page.locator('#' + id).innerText();

    // Phase 2: Inbox is a folded banner; table has 7 columns (☐ + 6), initials not full names
    assert.equal(await page.locator('#alabasta-inbox-section').evaluate(n => n.classList.contains('is-empty')), false);
    assert.match(await page.locator('#alabasta-inbox-section').innerText(), /2\s+waiting for review/);
    assert.equal(await page.locator('#alabasta-inbox-body').isVisible(), false);
    await page.locator('#alabasta-inbox-toggle').click();
    assert.equal(await page.locator('#alabasta-inbox-body').isVisible(), true);
    assert.equal(await page.locator('#alabasta-inbox-container .alabasta-inbox-card').count(), 2);
    assert.equal(await page.locator('#alabasta-inbox-toggle').getAttribute('aria-expanded'), 'true');
    await page.locator('#alabasta-inbox-toggle').click();
    assert.equal(await page.locator('#alabasta-inbox-body').isVisible(), false);
    // V3: lands on Pending when something waits; the archive toggle is gone (All = every case)
    assert(await page.locator('#alabasta-status-pending').evaluate(n => n.classList.contains('active')), 'default chip = Pending when cases wait');
    assert.equal(await rows(), 2);
    assert.equal(await page.locator('#alabasta-archived-toggle, #alabasta-case-show-archived').count(), 0);
    await page.evaluate(() => setAlabastaStatusFilter('all'));
    assert.equal(await page.locator('#alabastaCaseTable thead th').count(), 7);
    assert.deepEqual(await page.evaluate(() => [alabastaInitials('สมชาย มีสุข'), alabastaInitials('เอ็ม ใจดี'), alabastaInitials('')]), ['ส.ม.', 'อ.จ.', '']);
    const bodyText = await page.locator('#alabastaCaseTable').innerText();
    assert(!bodyText.includes('สมชาย') && bodyText.includes('ส.ม.'), 'patient shown as initials only');
    assert.equal(await page.locator('#alabastaCaseTable tr.alabasta-row-pending .alabasta-go-btn').count(), 2);
    assert.equal(await page.locator('#alabastaCaseTable tr:not(.alabasta-row-pending) .is-reopen').count(), 1);
    assert.equal(await page.locator('#alabastaCaseTable details.alabasta-more-menu .alabasta-more-menu-item', { hasText: 'Delete case' }).count(), 3);

    // header: maintenance buttons are inside the tools menu only
    assert.equal(await page.locator('#alabasta-tools-menu #alabasta-reconcile-btn').count(), 1);
    assert.equal(await page.locator('#alabasta-tools-menu #alabasta-orphan-btn').count(), 1);
    assert.equal(await page.locator('#alabasta-case-toolbar > #alabasta-reconcile-btn, #alabasta-case-toolbar > #alabasta-orphan-btn').count(), 0);
    assert.equal(await page.locator('#alabasta-tools-menu .alabasta-more-menu-body').isVisible(), false);
    await page.locator('#alabasta-tools-menu > summary').click();
    assert.equal(await page.locator('#alabasta-reconcile-btn').isVisible(), true);
    await page.locator('#alabasta-tools-menu > summary').click();

    // old ids survive and are filled
    for (const id of ['alabasta-case-total', 'alabasta-case-pending', 'alabasta-case-reviewed']) assert.equal(await page.locator('#' + id).count(), 1);
    assert.deepEqual([await txt('alabasta-case-total'), await txt('alabasta-case-pending'), await txt('alabasta-case-reviewed')], ['3', '2', '1']);
    assert.equal(await rows(), 3);

    // rail filters, counts stay put
    await page.locator('#alabasta-status-pending').click();
    assert.equal(await rows(), 2);
    assert(await page.locator('#alabasta-status-pending').evaluate(n => n.classList.contains('active')));
    assert.equal(await page.locator('#alabasta-status-all').evaluate(n => n.classList.contains('active')), false);
    assert.deepEqual([await txt('alabasta-case-total'), await txt('alabasta-case-pending'), await txt('alabasta-case-reviewed')], ['3', '2', '1']);
    await page.locator('#alabasta-status-reviewed').click();
    assert.equal(await rows(), 1);
    await page.locator('#alabasta-status-all').click();
    assert.equal(await rows(), 3);

    // pending chip + nothing pending → friendly empty row
    await page.evaluate(() => { casesData.forEach(c => c.status = 'reviewed'); setAlabastaStatusFilter('pending'); });
    assert.match(await page.locator('#alabastaCaseTable tbody').innerText(), /No cases waiting for review/);

    // all reviewed → nothing waiting: the Inbox banner is not shown at all
    assert.equal(await page.locator('#alabasta-inbox-section').evaluate(n => n.classList.contains('is-empty')), true);
    assert.equal(await page.locator('#alabasta-inbox-section').isVisible(), false);

    // date popover opens leftwards from the rail's right end — stays inside the viewport
    await page.evaluate(() => setAlabastaStatusFilter('all'));
    await page.locator('#alabasta-date-popover').evaluate(n => { n.hidden = false; });
    const r = await page.locator('#alabasta-date-popover').evaluate(n => { const b = n.getBoundingClientRect(); return [b.left, b.right, innerWidth]; });
    assert(r[0] >= 0 && r[1] <= r[2], 'date popover inside viewport ' + r);

    // Real-shaped data: reviewing/rejecting ARCHIVES a case (isArchived:true). Reviewed / Rejected chips must still find them
    await page.evaluate(() => {
      const t = (h) => ({ toDate: () => new Date(Date.now() - h * 3600e3), toMillis: () => Date.now() - h * 3600e3 });
      casesData = [
        { id: 'a', status: 'pending', displayName: 'P1', caseId: 'HN1', disease: 'Pneumonia', diseaseSystemKey: 'resp', timestamp: t(1) },
        { id: 'b', status: 'pending', displayName: 'P2', caseId: 'HN2', disease: 'DM', diseaseSystemKey: 'other', timestamp: t(2) },
        { id: 'c', status: 'reviewed', isArchived: true, adminBonus: 1.5, displayName: 'R1', caseId: 'HN3', disease: 'UTI', diseaseSystemKey: 'resp', timestamp: t(30) },
        { id: 'd', status: 'rejected', isArchived: true, rejectedReason: 'เคสซ้ำ · Duplicate', displayName: 'X1', caseId: 'HN4', disease: 'Headache', diseaseSystemKey: 'resp', timestamp: t(40) },
      ];
      window.alabastaStatusFilter = 'all'; window.alabastaSystemFilter = 'all'; renderAlabastaCases();
    });
    const counts = async () => [await txt('alabasta-case-total'), await txt('alabasta-case-pending'), await txt('alabasta-case-reviewed'), await txt('alabasta-case-rejected')];
    assert.deepEqual(await counts(), ['4', '2', '1', '1']);
    assert.equal(await rows(), 4, 'All = every case, archived or not');
    await page.locator('#alabasta-status-reviewed').click();
    assert.equal(await rows(), 1);
    assert.match(await page.locator('#alabastaCaseTable tbody').innerText(), /✓ 1\.50 pts/);
    assert.doesNotMatch(await page.locator('#alabastaCaseTable tbody').innerText(), /Archived/);
    assert.deepEqual(await counts(), ['4', '2', '1', '1']);
    await page.locator('#alabasta-status-rejected').click();
    assert.equal(await rows(), 1);
    assert.match(await page.locator('#alabastaCaseTable tbody').innerText(), /Rejected/);
    assert.equal(await page.locator('#alabastaCaseTable .is-reopen').count(), 1);
    assert(await page.locator('#alabasta-status-rejected').evaluate(n => n.classList.contains('active')));
    // system pills count inside the chosen status; system filter narrows chip counts but not the chosen status
    await page.evaluate(() => setAlabastaSystemFilter('resp'));
    assert.equal(await rows(), 1);
    assert.deepEqual(await counts(), ['3', '1', '1', '1']);
    await page.evaluate(() => { setAlabastaSystemFilter('all'); setAlabastaStatusFilter('all'); });
    assert.equal(await rows(), 4);
    assert.equal((await counts())[0], '4', 'chip counts add up: 4 = 2 + 1 + 1');
    await page.evaluate(() => { setAlabastaStatusFilter('rejected'); casesData.splice(3, 1); renderAlabastaCases(); });
    assert.match(await page.locator('#alabastaCaseTable tbody').innerText(), /No rejected cases/);
    await page.evaluate(() => setAlabastaStatusFilter('all'));

    // Empty chrome: a single system is not a choice → rail hidden; header hidden while the table is empty
    const railShown = () => page.locator('#alabasta-system-filter-pills').evaluate(n => getComputedStyle(n).display !== 'none' && n.children.length > 0);
    const headShown = () => page.locator('#alabastaCaseTable thead').evaluate(n => getComputedStyle(n).display !== 'none');
    await page.evaluate(() => { window.alabastaStatusFilter = 'all'; window.alabastaSystemFilter = 'all'; renderAlabastaCases(); });
    assert.equal(await railShown(), false, 'one system only → no system rail');
    assert.equal(await headShown(), true);
    await page.evaluate(() => { CASE_SYSTEMS.push({ key: 'other', emoji: '🩸', label: { en: 'Other', ko: '' } }); renderAlabastaCases(); });
    assert.equal(await railShown(), true, 'two systems → rail shown');
    await page.evaluate(() => { CASE_SYSTEMS.pop(); setAlabastaSystemFilter('resp'); });
    assert.equal(await railShown(), true, 'an active system filter keeps the rail so it can be cleared');
    await page.evaluate(() => { setAlabastaSystemFilter('all'); casesData = []; renderAlabastaCases(); });
    assert.equal(await headShown(), false, 'no rows → no column titles');
    assert.match(await page.locator('#alabastaCaseTable tbody').innerText(), /No case submissions found/);
    await page.evaluate(() => { casesData = [{ id: 'z', status: 'pending', displayName: 'Z', caseId: 'H', disease: 'D', timestamp: null }]; renderAlabastaCases(); });
    assert.equal(await headShown(), true, 'header returns with the first row');

    // One rail: status │ system (icon + count, no second "All"), tap the active system again to clear; date is 📅 ▾ until a range is set
    await page.evaluate(() => {
      const t = (h) => ({ toDate: () => new Date(Date.now() - h * 3600e3), toMillis: () => Date.now() - h * 3600e3 });
      CASE_SYSTEMS.push({ key: 'other', emoji: '🩸', label: { en: 'Other', ko: '' } });
      casesData = [
        { id: 'a', status: 'pending', displayName: 'P1', caseId: 'H1', disease: 'A', diseaseSystemKey: 'resp', timestamp: t(1) },
        { id: 'b', status: 'pending', displayName: 'P2', caseId: 'H2', disease: 'B', diseaseSystemKey: 'other', timestamp: t(2) },
        { id: 'c', status: 'pending', displayName: 'P3', caseId: 'H3', disease: 'C', diseaseSystemKey: 'other', timestamp: t(3) },
      ];
      window.alabastaStatusFilter = 'all'; window.alabastaSystemFilter = 'all'; renderAlabastaCases();
    });
    const sysBtns = page.locator('#alabasta-status-rail #alabasta-system-filter-pills > button');
    assert.equal(await sysBtns.count(), 2, 'system pills live inside the status rail, no "All" among them');
    assert.deepEqual(await sysBtns.evaluateAll(els => els.map(e => e.title)), ['Respiratory', 'Other']);
    assert.deepEqual(await sysBtns.evaluateAll(els => els.map(e => e.querySelector('.pill-count').textContent)), ['1', '2']);
    assert.equal(await page.locator('#alabasta-system-filter-pills').evaluate(n => /All/.test(n.textContent)), false);
    const railTops = await page.locator('#alabasta-status-rail > button, #alabasta-system-filter-pills > button').evaluateAll(els => els.map(e => Math.round(e.getBoundingClientRect().top)));
    assert(Math.max(...railTops) - Math.min(...railTops) <= 4, 'status and system chips share one row at 1280px: ' + railTops);
    await sysBtns.nth(1).click();
    assert.equal(await rows(), 2);
    assert.equal(await page.evaluate(() => window.alabastaSystemFilter), 'other');
    assert.equal(await page.locator('#alabasta-system-filter-pills > button.active').count(), 1);
    await page.locator('#alabasta-system-filter-pills > button.active').click();
    assert.equal(await page.evaluate(() => window.alabastaSystemFilter), 'all', 'tapping the active system again clears it');
    assert.equal(await rows(), 3);
    assert.equal(await page.locator('#alabasta-date-trigger-label').isVisible(), false, 'date trigger is icon-only by default');
    await page.evaluate(() => { document.getElementById('alabasta-date-from').value = '2026-10-01'; document.getElementById('alabasta-date-to').value = '2026-10-05'; syncAlabastaDateTriggerLabel(); });
    assert.match(await txt('alabasta-date-trigger-label'), /2026-10-01 → 2026-10-05/);
    await page.evaluate(() => { document.getElementById('alabasta-date-from').value = ''; document.getElementById('alabasta-date-to').value = ''; syncAlabastaDateTriggerLabel(); CASE_SYSTEMS.pop(); });
    assert.equal(await page.locator('#alabasta-date-trigger-label').isVisible(), false);

    // Smart default: no pending -> All
    await page.evaluate(() => { window._alabastaStatusDefaulted = false; casesData = [{ id: 'r', status: 'reviewed', isArchived: true, adminBonus: 1, displayName: 'R', caseId: 'H', disease: 'D', timestamp: null }]; renderAlabastaCases(); });
    assert.equal(await page.evaluate(() => window.alabastaStatusFilter), 'all');
    assert.equal(await rows(), 1);

    // One toolbar row: title, tabs | status | system, date, search, tools - all inside #alabasta-toolbar
    await page.evaluate(() => { casesData = [{ id: 'p', status: 'pending', displayName: 'P', caseId: 'H', disease: 'D', timestamp: null }]; productListingsData = []; syncAlabastaSubtabCounts(); });
    for (const sel of ['#alabasta-subtab-case', '#alabasta-status-rail', '#alabasta-case-toolbar', '#alabasta-tools-menu', '#alabasta-case-search']) {
      assert.equal(await page.locator('#alabasta-toolbar ' + sel).count(), 1, sel + ' lives in the one toolbar');
    }
    assert.equal(await page.locator('#alabasta-case-pane #alabasta-status-rail').count(), 0, 'rail is no longer inside the pane');
    const tbTops = await page.locator('#alabasta-toolbar h4, #alabasta-toolbar .alabasta-subtab, #alabasta-status-rail > button, #alabasta-case-toolbar > *').evaluateAll(els => els.filter(e => e.getBoundingClientRect().width > 0).map(e => Math.round(e.getBoundingClientRect().top)));
    assert(Math.max(...tbTops) - Math.min(...tbTops) <= 12, 'toolbar is one row at 1280px: ' + tbTops);
    assert.equal(await page.locator('#alabasta-subtab-case-count').isVisible(), true, 'red dot on the Case tab while something waits');
    assert.equal(await page.locator('#alabasta-subtab-product-count').isVisible(), false);
    assert.equal((await page.locator('#alabasta-subtab-case').innerText()).trim(), '🩺 Case', 'no number on the tab');
    // search is an icon that opens the input; it stays open while it holds text
    assert.equal(await page.locator('#alabasta-case-search').isVisible(), false);
    await page.locator('#alabasta-case-toolbar .alabasta-search-wrap > button').click();
    assert.equal(await page.locator('#alabasta-case-search').isVisible(), true);
    await page.locator('#alabasta-case-search').fill('zzz');
    await page.locator('#alabasta-subtab-case').click({ force: true });
    assert.equal(await page.locator('#alabasta-case-search').isVisible(), true, 'open while it has text');
    await page.locator('#alabasta-case-search').fill('');
    await page.locator('#alabasta-subtab-case').click({ force: true });
    assert.equal(await page.locator('#alabasta-case-search').isVisible(), false, 'closes on blur when empty');
    // tabs swap the rails
    assert.equal(await page.locator('#alabasta-status-rail').isVisible(), true);
    assert.equal(await page.locator('#alabasta-product-status-rail').isVisible(), false);
    await page.evaluate(() => setAlabastaSubtab('product'));
    assert.equal(await page.locator('#alabasta-status-rail').isVisible(), false);
    assert.equal(await page.locator('#alabasta-product-status-rail').isVisible(), true);
    assert.equal(await page.locator('#alabasta-case-toolbar').isVisible(), false);
    await page.evaluate(() => setAlabastaSubtab('case'));
    assert.equal(await page.locator('#alabasta-status-rail').isVisible(), true);

    // phone width: nothing spills sideways
    await page.setViewportSize({ width: 390, height: 800 });
    assert(await page.locator('#alabasta-status-rail').evaluate(n => n.scrollWidth <= n.clientWidth + 1));
    console.log('PASS: Alabasta lean header — tools menu, status rail filters, ids kept, popover in viewport');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
