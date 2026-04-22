const admin = require("firebase-admin");

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

function parseArgs(argv) {
  const args = {
    apply: false,
    limit: null,
    verbose: false,
  };

  for (const raw of argv) {
    if (raw === "--apply") {
      args.apply = true;
      continue;
    }
    if (raw === "--verbose") {
      args.verbose = true;
      continue;
    }
    if (raw.startsWith("--limit=")) {
      const value = Number(raw.split("=")[1]);
      if (Number.isFinite(value) && value > 0) {
        args.limit = Math.floor(value);
      }
    }
  }

  return args;
}

async function loadAuthLinks() {
  const snap = await db.collection("user_auth_links").get();
  const lookup = new Map();

  snap.forEach((doc) => {
    const data = doc.data() || {};
    const effectiveUserId = String(data.effectiveUserId || "").trim();
    const authUid = String(data.authUid || doc.id || "").trim();
    if (!effectiveUserId || !authUid) return;
    if (!lookup.has(effectiveUserId)) {
      lookup.set(effectiveUserId, new Set());
    }
    lookup.get(effectiveUserId).add(authUid);
  });

  return lookup;
}

async function loadLegacyCases(limit) {
  let query = db.collection("cases").where("authUid", "==", null);
  try {
    const nullSnap = await query.get();
    if (!nullSnap.empty) return nullSnap.docs;
  } catch (_) {
    // Fall through to full scan if null query is unsupported by existing data shape.
  }

  const allSnap = await db.collection("cases").get();
  const filtered = allSnap.docs.filter((doc) => {
    const data = doc.data() || {};
    return !data.authUid;
  });
  return limit ? filtered.slice(0, limit) : filtered;
}

function pushSample(list, item, max = 20) {
  if (list.length < max) list.push(item);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  console.log(`[cases-authUid] Starting ${args.apply ? "LIVE RUN" : "DRY RUN"}`);

  const authLinkLookup = await loadAuthLinks();
  const legacyCaseDocs = await loadLegacyCases(args.limit);
  const legacyDocs = args.limit ? legacyCaseDocs.slice(0, args.limit) : legacyCaseDocs;

  const summary = {
    mode: args.apply ? "apply" : "dry-run",
    totalLinks: 0,
    legacyCasesScanned: legacyDocs.length,
    updatable: 0,
    updated: 0,
    skippedNoLink: 0,
    skippedAmbiguous: 0,
    skippedMissingUserId: 0,
    samplesUpdated: [],
    samplesNoLink: [],
    samplesAmbiguous: [],
    samplesMissingUserId: [],
  };

  for (const authUids of authLinkLookup.values()) {
    summary.totalLinks += authUids.size;
  }

  let batch = db.batch();
  let batchOps = 0;

  for (const doc of legacyDocs) {
    const data = doc.data() || {};
    const legacyUserId = String(data.userId || "").trim();
    const sample = {
      caseDocId: doc.id,
      userId: legacyUserId || "(missing)",
      caseId: data.caseId || "",
      displayName: data.displayName || "",
    };

    if (!legacyUserId) {
      summary.skippedMissingUserId += 1;
      pushSample(summary.samplesMissingUserId, sample);
      continue;
    }

    const candidates = Array.from(authLinkLookup.get(legacyUserId) || []);
    if (candidates.length === 0) {
      summary.skippedNoLink += 1;
      pushSample(summary.samplesNoLink, sample);
      continue;
    }

    if (candidates.length > 1) {
      summary.skippedAmbiguous += 1;
      pushSample(summary.samplesAmbiguous, { ...sample, candidateAuthUids: candidates });
      continue;
    }

    summary.updatable += 1;
    pushSample(summary.samplesUpdated, { ...sample, authUid: candidates[0] });

    if (!args.apply) continue;

    batch.update(doc.ref, {
      authUid: candidates[0],
      authUidBackfilledAt: admin.firestore.FieldValue.serverTimestamp(),
      authUidBackfillSource: "user_auth_links",
    });
    batchOps += 1;
    summary.updated += 1;

    if (batchOps >= 400) {
      await batch.commit();
      batch = db.batch();
      batchOps = 0;
    }

    if (args.verbose) {
      console.log(`[cases-authUid] Updated ${doc.id} -> ${candidates[0]}`);
    }
  }

  if (args.apply && batchOps > 0) {
    await batch.commit();
  }

  console.log(JSON.stringify(summary, null, 2));
  console.log(`[cases-authUid] Completed ${args.apply ? "LIVE RUN" : "DRY RUN"}`);
}

main().catch((err) => {
  console.error("[cases-authUid] Failed:", err);
  process.exitCode = 1;
});
