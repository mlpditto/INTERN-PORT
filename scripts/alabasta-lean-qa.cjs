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
    const fns = ['alabastaInitials', 'alabastaAgo', 'renderAlabastaInbox', 'toggleAlabastaInbox', 'renderAlabastaSystemFilterPills', 'renderAlabastaCases', 'setAlabastaStatusFilter', 'setAlabastaSystemFilter', 'closeAlabastaMoreMenus', 'syncAlabastaSubtabCounts']
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
      function renderAlabastaBulkToolbar() {} function syncAlabastaSelectAllCheckbox() {}
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

    // all reviewed → Inbox banner shows the green "none waiting" state and cannot open
    assert.equal(await page.locator('#alabasta-inbox-section').evaluate(n => n.classList.contains('is-empty')), true);
    assert.equal(await page.locator('#alabasta-inbox-empty').isVisible(), true);

    // date popover opens leftwards from the rail's right end — stays inside the viewport
    await page.evaluate(() => setAlabastaStatusFilter('all'));
    await page.locator('#alabasta-date-popover').evaluate(n => { n.hidden = false; });
    const r = await page.locator('#alabasta-date-popover').evaluate(n => { const b = n.getBoundingClientRect(); return [b.left, b.right, innerWidth]; });
    assert(r[0] >= 0 && r[1] <= r[2], 'date popover inside viewport ' + r);

    // phone width: nothing spills sideways
    await page.setViewportSize({ width: 390, height: 800 });
    assert(await page.locator('#alabasta-status-rail').evaluate(n => n.scrollWidth <= n.clientWidth + 1));
    console.log('PASS: Alabasta lean header — tools menu, status rail filters, ids kept, popover in viewport');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
