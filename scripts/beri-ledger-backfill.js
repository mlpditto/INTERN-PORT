/* ===================================================================
   Beri ledger B2 — one-time backfill
   ---------------------------------------------------------------------
   PASTE THIS INTO THE CONSOLE OF public/admin.html WHILE LOGGED IN AS
   ADMIN (medlifeplus@gmail.com). It needs the page's global `db` /
   `firebase` and admin auth (firestore.rules 35e: admin can create
   beri_ledger).

   What it does:
     - reads beri_adjustments + review_link_clicks +
       review_link_reviews(approved) + beri_redemptions
     - writes one beri_ledger row per historical Beri movement, using
       the SAME deterministic id as B1 (`${source}__${refId}`), so it
       never collides with rows B1 already wrote and is safe to re-run
     - preserves each movement's ORIGINAL timestamp; tags the row
       { backfilled:true, backfilledAt: <now> }
     - prints {written, skipped} per source, then a reconciliation
       table: Σ ledger.amount per user vs users/{uid}.beri

   RUN IT TWICE: as shipped DRY_RUN = true, so the first paste only prints
   the plan. Read the table, then set DRY_RUN = false and paste again.

   Field names re-verified against production 2026-08-30 (admin V98.34 /
   intern V96.79) — all four legacy collections and the refId scheme still
   match what B1 writes:
     beri_adjustments    userId/amount/note/timestamp/createdByUid, refId=doc.id
     review_link_clicks  userId/beriAwarded/linkId/timestamp, doc.id=`${linkId}_${userId}`
     review_link_reviews status==='approved', reviewedAt, amount hardcoded 1
                         (approveExploreReview does increment(1) — same constant)
     beri_redemptions    beriCost/requestedAt/deniedAt/rewardName, status==='denied'

   PR #963 added two more ledger sources (quiz_early_bird,
   quiz_deadline_buffer). They have no legacy collection behind them —
   nothing to backfill, and their live rows are simply skipped as existing.

   Safety: writes ONLY new beri_ledger docs. Never touches users.beri or any
   legacy collection. Ids are deterministic, so a re-run cannot double up.
   To undo: delete beri_ledger docs where backfilled == true.
   =================================================================== */
(async () => {
  const DRY_RUN = true;                // STEP 1 runs as a preview. Set to false for STEP 2.
  const BATCH = 400;

  if (typeof db === 'undefined' || typeof firebase === 'undefined') {
    console.error('Run this in the admin.html page console (needs global db/firebase).');
    return;
  }
  const svrNow = firebase.firestore.FieldValue.serverTimestamp();

  // ---- 1. gather candidate rows --------------------------------------
  const rows = [];   // { id, data }
  const perSource = {};
  const bump = (s) => (perSource[s] = perSource[s] || { seen: 0, written: 0, skipped: 0 });

  const mk = (source, refId, o) => {
    const s = bump(source); s.seen++;
    rows.push({
      id: `${source}__${refId}`,
      data: {
        userId: o.userId || '',
        amount: Number(o.amount) || 0,
        source,
        refId: String(refId),
        note: o.note || '',
        createdByUid: o.createdByUid || null,
        timestamp: o.timestamp || svrNow,
        backfilled: true,
        backfilledAt: svrNow
      }
    });
  };

  console.log('reading legacy collections…');
  const [adjSnap, clickSnap, revSnap, redSnap] = await Promise.all([
    db.collection('beri_adjustments').get(),
    db.collection('review_link_clicks').get(),
    db.collection('review_link_reviews').get(),
    db.collection('beri_redemptions').get()
  ]);

  adjSnap.forEach(doc => {
    const d = doc.data();
    mk('manual_adjust', doc.id, {
      userId: d.userId, amount: d.amount, note: d.note || 'Manual adjust',
      timestamp: d.timestamp, createdByUid: d.createdByUid || null
    });
  });

  clickSnap.forEach(doc => {
    const d = doc.data();
    // review_link_clicks doc id is already `${linkId}_${userId}` — same refId B1 uses
    mk('explore_link', doc.id, {
      userId: d.userId, amount: d.beriAwarded,
      note: `Explore: ${d.linkId || doc.id}`, timestamp: d.timestamp
    });
  });

  revSnap.forEach(doc => {
    const d = doc.data();
    if (d.status !== 'approved') return;
    mk('review_approved', doc.id, {
      userId: d.userId, amount: 1, note: 'Review approved',
      timestamp: d.reviewedAt
    });
  });

  redSnap.forEach(doc => {
    const d = doc.data();
    const cost = Number(d.beriCost) || 0;
    // the debit happened at request time regardless of later fulfill/deny
    mk('shop_redeem', doc.id, {
      userId: d.userId, amount: -cost,
      note: `Shop: ${d.rewardName || d.rewardId || doc.id}`,
      timestamp: d.requestedAt
    });
    if (d.status === 'denied') {
      mk('shop_refund', doc.id, {
        userId: d.userId, amount: cost,
        note: `Refund: ${d.rewardName || d.rewardId || doc.id}`,
        timestamp: d.deniedAt || d.requestedAt
      });
    }
  });

  // ---- 2. skip ids that already exist (B1 rows or a prior run) ------
  const existingSnap = await db.collection('beri_ledger').get();
  const existing = new Set(existingSnap.docs.map(d => d.id));
  const toWrite = rows.filter(r => {
    if (existing.has(r.id)) { perSource[r.data.source].skipped++; return false; }
    perSource[r.data.source].written++;
    return true;
  });

  console.table(perSource);
  console.log(`candidates: ${rows.length} | already present: ${rows.length - toWrite.length} | to write: ${toWrite.length}`);

  if (DRY_RUN) { console.warn('DRY_RUN — nothing written. Set DRY_RUN=false to apply.'); return; }
  if (!toWrite.length) { console.log('nothing to write.'); }

  // ---- 3. batched writes ------------------------------------------------
  for (let i = 0; i < toWrite.length; i += BATCH) {
    const chunk = toWrite.slice(i, i + BATCH);
    const b = db.batch();
    chunk.forEach(r => b.set(db.collection('beri_ledger').doc(r.id), r.data));
    await b.commit();
    console.log(`  wrote ${Math.min(i + BATCH, toWrite.length)}/${toWrite.length}`);
  }
  console.log('✅ backfill writes done.');

  // ---- 4. reconciliation: Σ ledger.amount per user vs users.beri ----
  const [ledgerAll, usersAll] = await Promise.all([
    db.collection('beri_ledger').get(),
    db.collection('users').get()
  ]);
  const sum = {};
  ledgerAll.forEach(d => {
    const x = d.data();
    sum[x.userId] = (sum[x.userId] || 0) + (Number(x.amount) || 0);
  });
  const mismatches = [];
  usersAll.forEach(d => {
    const u = d.data();
    const bal = Number(u.beri) || 0;
    const led = sum[d.id] || 0;
    const diff = Math.round((bal - led) * 100) / 100;
    if (Math.abs(diff) > 0.001) {
      mismatches.push({ userId: d.id, name: u.displayName || '', balance: bal, ledgerSum: Math.round(led * 100) / 100, diff });
    }
  });
  mismatches.sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff));
  console.log(`\nreconciliation — ${mismatches.length} user(s) where balance ≠ Σ ledger:`);
  console.table(mismatches);
  console.log('(a residual diff is expected for movements with no legacy record — very old grants, ' +
              'balance edited directly in the console, etc. fulfillBeriRedemption correctly has no row.)');
})();
