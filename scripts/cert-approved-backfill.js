/* ===================================================================
   certApproved — one-time backfill (follows PR #1250, V100.58)
   RAN ON PRODUCTION 2026-09-19: 2 users updated, 1 no-userId cert skipped.
   ---------------------------------------------------------------------
   PASTE THIS INTO THE CONSOLE OF public/admin.html WHILE LOGGED IN AS
   ADMIN. It needs the page's global `db` / `auth` / `firebase`.

   Before #1250 nothing wrote users.certApproved, so everyone who was
   issued a certificate still shows "Request Pending". This marks them
   approved, with the same rule #1250 uses going forward:
     - the user has at least one VALID certificates/{no} with userId
     - AND users/{uid}.certRequested === true   (group exports of people
       who never asked are left alone)
     - AND certApproved is not already true      (safe to re-run)
   Writes { certApproved:true, certApprovedAt:<that cert's issuedAt>,
   certNo:<latest valid no>, certApprovedBackfill:true } with update(),
   which fails on a missing doc and touches only those four fields.

   RUN IT TWICE: as shipped DRY_RUN = true, so the first paste only prints
   the plan. Read the table, then set DRY_RUN = false and paste again.

   To undo: for users where certApprovedBackfill == true, update
   { certApproved:false } and delete certApprovedAt / certNo /
   certApprovedBackfill — none of them had certApproved before this run.
   =================================================================== */
(async () => {
  const DRY_RUN = true;                // STEP 1 runs as a preview. Set to false for STEP 2.

  if (typeof db === 'undefined' || typeof auth === 'undefined' || typeof firebase === 'undefined') {
    console.error('Run this in the admin.html page console (needs global db/auth/firebase).');
    return;
  }
  const tok = auth.currentUser && await auth.currentUser.getIdTokenResult(true);
  if (!tok || !tok.claims.admin) {
    console.error('Not signed in with the admin claim — stopping before any read.');
    return;
  }

  // ---- 1. latest VALID certificate per userId --------------------------
  const certSnap = await db.collection('certificates').get();
  const latest = new Map();          // uid -> cert data
  let noUser = 0, revoked = 0;
  certSnap.forEach(d => {
    const c = d.data();
    if (c.status !== 'valid') { revoked++; return; }
    if (!c.userId) { noUser++; return; }
    const cur = latest.get(c.userId);
    if (!cur || (c.seq || 0) > (cur.seq || 0)) latest.set(c.userId, { ...c, no: c.no || d.id });
  });

  // ---- 2. decide per user ----------------------------------------------
  const plan = [], skipped = { userMissing: [], notRequested: [], alreadyApproved: [] };
  for (const [uid, c] of latest) {
    const u = await db.collection('users').doc(uid).get();
    if (!u.exists) { skipped.userMissing.push(uid); continue; }
    const d = u.data();
    const label = `${d.fullNameEn || d.fullName || d.displayName || uid}`;
    if (d.certRequested !== true) { skipped.notRequested.push(label); continue; }
    if (d.certApproved === true) { skipped.alreadyApproved.push(label); continue; }
    plan.push({ uid, name: label, certNo: c.no, issuedAt: c.issuedAt || null,
                before: JSON.stringify({ certApproved: d.certApproved, certApprovedAt: d.certApprovedAt, certNo: d.certNo }) });
  }

  console.log(`certificates: ${certSnap.size} total · ${revoked} revoked · ${noUser} without userId · ${latest.size} users with a valid cert`);
  console.table(plan.map(p => ({ name: p.name, certNo: p.certNo,
    issued: p.issuedAt && p.issuedAt.toDate ? p.issuedAt.toDate().toLocaleDateString('en-GB') : '-', before: p.before })));
  console.log('skipped:', Object.fromEntries(Object.entries(skipped).map(([k, v]) => [k, v.length])), skipped);

  if (DRY_RUN) { console.log(`DRY RUN — would update ${plan.length} user(s). Set DRY_RUN = false and paste again.`); return; }

  // ---- 3. write ----------------------------------------------------------
  let written = 0, failed = [];
  for (const p of plan) {
    try {
      await db.collection('users').doc(p.uid).update({
        certApproved: true,
        certApprovedAt: p.issuedAt || firebase.firestore.FieldValue.serverTimestamp(),
        certNo: p.certNo,
        certApprovedBackfill: true
      });
      written++;
    } catch (e) { failed.push({ name: p.name, error: e.message }); }
  }
  // ---- 4. verify by reading back ------------------------------------------
  let verified = 0;
  for (const p of plan) {
    const d = (await db.collection('users').doc(p.uid).get()).data() || {};
    if (d.certApproved === true && d.certNo === p.certNo && d.certApprovedBackfill === true) verified++;
  }
  console.log(`DONE — written ${written}/${plan.length}, verified ${verified}/${plan.length}`, failed.length ? failed : '');
})();
