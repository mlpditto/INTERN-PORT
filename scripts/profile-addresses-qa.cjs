// V102.159: admin profile modal ▸ Contact — more than one address. "Current address" stays users.address; "Address (National ID)" is
// users.addressIdCard; "+ Add address" (edit mode only) adds labelled rows saved as users.addresses [{label, text}]. Every row keeps the
// one-tap copy icon; 📋 copies the whole card with labels. The REAL Contact card markup + the REAL gs* functions in a browser.
const fs = require('node:fs');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const html = fs.readFileSync('public/admin.html', 'utf8').replace(/\r\n/g, '\n');

assert.ok(/<title>Nika Admin \(V102\.\d+\)<\/title>/.test(html));
assert.ok(html.includes('id="gs-address-idcard"') && html.includes('id="gs-address-extra"') && html.includes('onclick="gsAddAddressRow()"'), 'markup: National ID row, extras host, add button');
assert.ok(html.includes("addressIdCard: document.getElementById('gs-address-idcard').value.trim(),") && html.includes('addresses: gsCollectAddresses(),'), 'save writes addressIdCard + addresses');
assert.ok(html.includes("document.getElementById('gs-address-idcard').value = user?.addressIdCard || '';") && html.includes('gsRenderAddresses(user?.addresses);'), 'load reads them back');
assert.ok(html.includes("document.getElementById('gs-address').value = user?.address || '';") && html.includes('address: address,'), 'users.address (Current) is untouched');
assert.ok(html.includes('#groupSelectModal .gs-profile-card:not(.gs-editing) .gs-addr-tools { display:none; }'), 'tools only while editing');
assert.ok(!fs.readFileSync('public/index.html', 'utf8').includes('addressIdCard'), 'intern side untouched (admin first)');

function grab(src, marker) {
    const i = src.indexOf(marker); assert.ok(i >= 0, marker);
    let d = 0, k = src.indexOf('{', i);
    for (; k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}' && --d === 0) break; }
    return src.slice(i, k + 1);
}
const secStart = html.indexOf('<section class="gs-profile-card gs-card-contact">');
const section = html.slice(secStart, html.indexOf('</section>', secStart) + 10);
const css = html.split('\n').filter(l => /^\s*#groupSelectModal \.gs-/.test(l)).join('\n');
// the card edit toggle: the function holding the aria-expanded flip
const flipAt = html.indexOf("const editing = button.getAttribute('aria-expanded') !== 'true';");
const toggleName = html.slice(html.lastIndexOf('function ', flipAt) + 9, html.indexOf('(', html.lastIndexOf('function ', flipAt)));
const code = ['gsAddressRowHtml(', 'window.gsAddAddressRow = function', 'window.gsRemoveAddressRow = function', 'window.gsSyncAddressLabel = function', 'function gsRenderAddresses(', 'function gsCollectAddresses(',
    'async function gsCopyProfile(', 'function gsRefreshProfileCards(', 'function ' + toggleName + '('].map(m => grab(html, m.startsWith('gsAddressRowHtml') ? 'function gsAddressRowHtml(' : m)).join('\n');

(async () => {
    const browser = await chromium.launch();
    try {
        const page = await browser.newPage({ viewport: { width: 900, height: 800 } });
        const errs = []; page.on('pageerror', e => errs.push(e.message));
        await page.setContent('<!doctype html><meta charset="utf-8"><style>:root{--text-sub:#64748b}' + css + '</style><div id="groupSelectModal"><div id="gs-save-status"></div>' + section + '</div>');
        await page.addScriptTag({ content: [
            'var gsLanguage = "en"; function gsText(en, th) { return gsLanguage === "th" ? th : en; } function gsSetLanguage() {}',
            'var escapeHtml = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", \'"\': "&quot;" }[c]));',
            'window.__clip = []; Object.defineProperty(navigator, "clipboard", { value: { writeText: t => { __clip.push(t); return Promise.resolve(); } } });',
            code
        ].join('\n') });
        const vis = sel => page.$eval(sel, e => !e.hidden && e.getClientRects().length > 0);   // a child of a display:none parent still computes its own display
        const rows = () => page.$$eval('.gs-card-contact .gs-card-field', els => els.map(e => e.querySelector('label').textContent + '=' + e.querySelector('input').value));

        // load, as openProfile does: values in, inputs hidden, extras rendered from users.addresses
        await page.evaluate(() => {
            document.getElementById('gs-tel').value = '0957050499'; document.getElementById('gs-email').value = '';
            document.getElementById('gs-address').value = '99 Sukhumvit, Bangkok'; document.getElementById('gs-address-idcard').value = '12 Moo 3, Nakhon Pathom';
            gsRenderAddresses([{ label: 'Work', text: 'MLP Pharmacy, Ratchada' }, { label: 'Broken', text: '' }, null]);
            document.querySelectorAll('.gs-profile-card input').forEach(i => { i.hidden = true; });
            gsRefreshProfileCards();
        });
        assert.deepEqual(await rows(), ['Phone=0957050499', 'Email=', 'Current address=99 Sukhumvit, Bangkok', 'Address (National ID)=12 Moo 3, Nakhon Pathom', 'Work=MLP Pharmacy, Ratchada'], 'rows in order; an empty / null extra is not rendered');
        assert.equal(await vis('.gs-addr-add'), false, 'no add button in read mode');
        assert.equal(await page.$eval('.gs-addr-extra .gs-read-value', e => e.textContent), 'MLP Pharmacy, Ratchada');
        assert.ok((await page.$eval('.gs-card-contact .gs-empty-note', e => e.textContent)).includes('Email'), '"Not provided" names the empty field only');
        // one-tap copy on the National ID row copies just that address
        await page.click('.gs-card-field:has(#gs-address-idcard) .gs-copy-field');
        assert.deepEqual(await page.evaluate(() => __clip), ['12 Moo 3, Nakhon Pathom']);
        // 📋 copies the card with labels, skipping empties
        await page.click('.gs-card-contact .gs-copy-card');
        assert.equal(await page.evaluate(() => __clip[1]), 'Phone: 0957050499\nCurrent address: 99 Sukhumvit, Bangkok\nAddress (National ID): 12 Moo 3, Nakhon Pathom\nWork: MLP Pharmacy, Ratchada');
        // edit mode: tools appear, add a row, label it, remove another
        await page.click('.gs-card-contact .gs-edit-card');
        assert.equal(await vis('.gs-addr-add'), true, 'add button while editing');
        assert.equal(await vis('.gs-addr-extra .gs-addr-label'), true, 'label input while editing');
        await page.click('.gs-addr-add');
        assert.equal(await page.locator('.gs-addr-extra').count(), 2);
        await page.fill('.gs-addr-extra:nth-child(2) .gs-addr-label', 'Parents');
        await page.fill('.gs-addr-extra:nth-child(2) .gs-addr-text', '5 Soi 1, Chiang Mai');
        assert.equal(await page.$eval('.gs-addr-extra:nth-child(2) label', e => e.textContent + '|' + e.dataset.gsTh), 'Parents|Parents', 'label follows the input (both languages)');
        await page.click('.gs-addr-extra:nth-child(1) .gs-addr-del');
        assert.equal(await page.locator('.gs-addr-extra').count(), 1, 'Work removed');
        assert.deepEqual(await page.evaluate(() => gsCollectAddresses()), [{ label: 'Parents', text: '5 Soi 1, Chiang Mai' }], 'what Save would write');
        // a blank label falls back; a blank text is dropped on save
        await page.click('.gs-addr-add');
        await page.fill('.gs-addr-extra:nth-child(2) .gs-addr-label', '');
        await page.dispatchEvent('.gs-addr-extra:nth-child(2) .gs-addr-label', 'input');
        assert.equal(await page.$eval('.gs-addr-extra:nth-child(2) label', e => e.textContent), 'Other address');
        assert.deepEqual(await page.evaluate(() => gsCollectAddresses()), [{ label: 'Parents', text: '5 Soi 1, Chiang Mai' }], 'an extra with no text is not saved');
        // done editing: tools hide; the empty extra is folded into "Not provided"
        await page.click('.gs-card-contact .gs-edit-card');
        assert.equal(await vis('.gs-addr-add'), false);
        assert.ok((await page.$eval('.gs-card-contact .gs-empty-note', e => e.textContent)).includes('Other address'), 'empty extra listed under Not provided');
        assert.equal(await page.$eval('.gs-addr-extra:nth-child(1) .gs-read-value', e => e.textContent), '5 Soi 1, Chiang Mai');
        assert.deepEqual(errs, [], 'no page errors');
        console.log('PASS: profile addresses — Current (users.address) + National ID + labelled extras; one-tap copy per row, 📋 copies all with labels, add/rename/remove only while editing, empty extras dropped on save');
    } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
