/* ===================================================================
   Journal end-to-end test — EMULATOR ONLY.

   1. firebase emulators:start --only firestore,auth   (needs Java)
   2. serve public/ on any port, then open
        http://127.0.0.1:<port>/index.html?emulator=1
   3. paste this in the console.
   It refuses to run unless window._usingEmulator is true, so it can
   never touch production data.

   It drives the REAL submit paths and then reads back what landed.
   =================================================================== */
(async () => {
  if (!window._usingEmulator) {
    console.error('%cRefusing to run: this page is NOT on the emulator. Add ?emulator=1 on 127.0.0.1.',
      'background:#b91c1c;color:#fff;padding:2px 8px;border-radius:4px');
    return;
  }
  const log = (t, ok) => console.log('%c' + (ok ? 'PASS  ' : 'FAIL  ') + t,
    'color:' + (ok ? '#15803d' : '#b91c1c') + ';font-weight:700');

  // Three things this harness learned the hard way:
  //  1. `userId` on the page is a script-scope binding, NOT window.userId — you
  //     cannot override it from the console. Read it, do not assign it.
  //  2. learning_path_entries rules need userId == auth.uid OR a user_auth_links
  //     doc mapping this auth uid to that userId. We create the link.
  //  3. wiping needs isAdmin(), which the rules grant to the admin email. The AUTH
  //     EMULATOR accepts any password, so this identity is local and grants nothing.
  const email = 'medlifeplus@gmail.com', pw = 'emulator-only';
  try { await firebase.auth().createUserWithEmailAndPassword(email, pw); }
  catch (e) { await firebase.auth().signInWithEmailAndPassword(email, pw); }
  const authUser = firebase.auth().currentUser;
  window._fbAuthUser = authUser;
  const uid = userId;                       // the page's own binding
  await db.collection('user_auth_links').doc(authUser.uid)
    .set({ authUid: authUser.uid, effectiveUserId: uid });
  if (typeof userProfile === 'undefined' || !userProfile) {
    window.userProfile = { displayName: 'Emulator Tester', pictureUrl: '' };
  }
  const wipe = async () => {
    for (const c of ['reflective_logs', 'learning_path_entries', 'submissions']) {
      const snap = await db.collection(c).where('userId', '==', uid).get();
      await Promise.all(snap.docs.map(d => d.ref.delete()));
    }
    window.myReflectiveLogsCache = [];
    window.myLpEntriesCache = [];
  };
  // hasSubmittedDRToday reads these caches, which onSnapshot fills in the real app.
  // Without this stand-in every entry looks like the day's first.
  const sync = async () => {
    const a = await read();
    window.myReflectiveLogsCache = a.refl.map(x => ({ timestamp: x.timestamp, content: x.content }));
    window.myLpEntriesCache = a.notes.map(x => ({ createdAt: x.createdAt }));
    return a;
  };
  const read = async () => {
    const [r, n, s] = await Promise.all([
      db.collection('reflective_logs').where('userId', '==', uid).get(),
      db.collection('learning_path_entries').where('userId', '==', uid).get(),
      db.collection('submissions').where('userId', '==', uid).get()
    ]);
    return {
      refl: r.docs.map(d => d.data()),
      notes: n.docs.map(d => d.data()),
      subs: s.docs.map(d => d.data())
    };
  };

  // ---- 1. plain entry, nothing written yet -> reflection with the daily point
  await wipe();
  document.getElementById('rl-content').value = 'Emulator test: a plain daily reflection entry.';
  document.getElementById('rl-mood').value = '\u{1F60A}';
  document.getElementById('lp-note-title').value = '';
  window._lpNoteTags = [];
  await submitJournalEntry();
  let a = await read();
  log('plain -> one reflective_logs row', a.refl.length === 1);
  log('plain -> autoScore 0.1', a.refl[0] && Number(a.refl[0].autoScore) === 0.1);
  log('plain -> no learning_path_entries', a.notes.length === 0);

  // ---- 2. titled entry on a FRESH day -> note carrying the daily point
  await wipe();
  document.getElementById('rl-content').value = 'Emulator test: a titled entry, first of the day.';
  document.getElementById('lp-note-title').value = 'Warfarin counselling';
  window._lpNoteTags = ['cardio'];
  await submitJournalEntry();
  let b = await read();
  const noteSub = b.subs.find(x => x.submissionType === 'learning_note');
  log('titled, first today -> one learning_path_entries row', b.notes.length === 1);
  log('titled, first today -> submissions score 0.1', noteSub && Number(noteSub.score) === 0.1);

  // ---- 3. a SECOND entry the same day must NOT be paid again
  document.getElementById('rl-content').value = 'Emulator test: second entry the same day.';
  document.getElementById('lp-note-title').value = 'Second note today';
  window._lpNoteTags = [];
  await submitJournalEntry();
  let c = await read();
  const paid = c.refl.filter(x => Number(x.autoScore) > 0).length +
               c.subs.filter(x => x.submissionType === 'learning_note' && Number(x.score) > 0).length;
  log('second entry same day -> still exactly one +0.1 (' + paid + ')', paid === 1);

  console.table(c.subs.map(x => ({ type: x.submissionType, score: x.score, pointsAmount: x.pointsAmount, title: x.title })));
  await wipe();
  console.log('%cemulator data wiped — nothing persists once you stop the emulator anyway',
    'color:#6b7280');
})();
