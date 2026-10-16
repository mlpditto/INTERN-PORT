// V102.263 — the exported badge board writes a label under every earned badge: its name, then the milestone reached ("150+ questions").
// Real admin.html functions in Chromium. Checks: label text per tier (steps from the catalog), one-off badges = name only, locked tiles
// unlabelled (no secret names leak), no two labels overlap in any layout even with the longest names, the PNG still encodes, no n/16 count.
const fs = require('node:fs');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
assert.ok(/<title>Nika Admin \(V102\.\d+\)<\/title>/.test(fs.readFileSync('public/admin.html', 'utf8')));
(async () => {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1200, height: 800 } });
    await page.route('**/*', r => r.request().url().startsWith('file:') ? r.continue() : r.fulfill({ status: 200, contentType: 'application/javascript', body: '' }));
    await page.addInitScript(() => { window.firebase = new Proxy(function () {}, { get: () => window.firebase, apply: () => window.firebase }); });
    await page.goto(require('url').pathToFileURL(process.cwd() + '/public/admin.html').href);
    const r = await page.evaluate(async () => {
      const mkItems = tiers => BADGE_STATS_DEFS.map(d => ({ id: d.id, t: tiers[d.id] || 0 }));
      const full = {}; BADGE_STATS_DEFS.forEach(d => { full[d.id] = d.steps === 1 ? (d.oneOff || 3) : Math.min(d.steps, 4); });
      const base = { kind: 'board', person: 'Bua', sub: 'Hospital Pharmacy › PRETEST', score: 11.85, avatar: 'none' };
      const out = { layouts: {} };
      for (const [name, tiers] of [['sample', { on_fire: 1, quiz_master: 3, perfectionist: 2, speedrunner: 1, social_butterfly: 4, graduate: 3 }], ['full', full], ['full-wide', full]]) {
        for (const l of ['card', 'banner', 'story']) {
          const st = Object.assign({ items: mkItems(tiers), layout: l }, base);
          let svg = badgeBoardSvg(st, l, 800);
          if (name === 'full-wide') svg = svg.replace(/font-family="[^"]*"/g, 'font-family="monospace"');   // a wide fallback font (CI has no Nunito): labels must still not touch
          const holder = document.createElement('div'); holder.innerHTML = svg; document.body.appendChild(holder);
          const el = holder.querySelector('svg'), all = [...el.querySelectorAll('text')], texts = all;
          const labelTexts = all.filter(t => parseFloat(t.getAttribute('font-size')) <= 8.2);   // the header (name, score) is the old layout, not ours
          const boxes = labelTexts.map(t => { const b = t.getBBox(); return { s: t.textContent, l: b.x, r: b.x + b.width, t: b.y, b: b.y + b.height }; });
          let overlaps = 0; for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) { const a = boxes[i], c = boxes[j]; if (a.l < c.r && c.l < a.r && Math.min(a.b, c.b) - Math.max(a.t, c.t) > 1.5) { overlaps++; (window.__ov = window.__ov || []).push([a.s, c.s, a.t, a.b, c.t, c.b]); } }
          const vb = el.viewBox.baseVal;
          out.layouts[name + ':' + l] = { texts: boxes.map(b => b.s), overlaps, inside: boxes.every(b => b.l >= 0 && b.r <= vb.width && b.b <= vb.height), h: vb.height, w: vb.width };
          holder.remove();
        }
      }
      const st0 = Object.assign({ items: mkItems(full), layout: 'story' }, base);
      const blob = await badgeExportPng(st0); out.png = { type: blob.type, size: blob.size > 2000 };
      // before the labels the story was 268/206 + rows*72; now a row is 101
      out.ov = window.__ov;
      out.rowStory = badgeBoardGeom(st0, 'story').row;
      return out;
    });
    const L = r.layouts;
    for (const l of ['card', 'banner', 'story']) {
      const t = L['sample:' + l].texts;
      assert.ok(t.includes('On Fire') && t.includes('3+ days'), l + ': On Fire bronze = "3+ days"');
      assert.ok(t.includes('Quiz Master') && t.includes('150+ questions'), l + ': Quiz Master gold = "150+ questions"');
      assert.ok(t.includes('Perfectionist') && t.includes('5+ quizzes'), l + ': Perfectionist silver = "5+ quizzes"');
      assert.ok(t.includes('Social Butterfly') && t.includes('20+ events'), l + ': Social Butterfly diamond = "20+ events"');
      assert.ok(t.includes('Graduate') && !t.some(x => /^\d+\+ /.test(x) && x.includes('Graduate')), l + ': one-off badge = name only');
      const milestones = t.filter(x => /^\d+\+ /.test(x)).length; assert.equal(milestones, 5, l + ': 5 milestone lines for the 5 multi-step badges (Graduate has none)');
      assert.ok(!t.includes('Night Owl') && !t.includes('Early Bird') && !t.includes('Legend'), l + ': locked / unearned badges are not named');
      assert.ok(!t.some(x => /\d+\/\d+/.test(x)), l + ': no n/16 count');
      for (const k of ['sample:', 'full:', 'full-wide:']) { const v = L[k + l]; assert.equal(v.overlaps, 0, k + l + ': no overlapping text ' + JSON.stringify(r.ov)); assert.ok(v.inside, k + l + ': every label is inside the picture'); }
    }
    assert.ok(L['full:story'].texts.includes('Codex Contributor') && L['full:story'].texts.includes('500+ journals'), 'longest names + the 4th Team Player step are drawn');
    assert.deepEqual(r.png, { type: 'image/png', size: true }, 'PNG encodes');
    assert.equal(r.rowStory, 101, 'story row = tile 72 + label 29');
    console.log('PASS: badge board labels — name + milestone under each earned badge (Card / Banner / Story), one-offs name only, locked unlabelled, no overlaps with the longest names, PNG encodes');
  } finally { await browser.close(); }
})().catch(e => { console.error('FAIL:', e.message); process.exit(1); });
