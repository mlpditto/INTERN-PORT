// V101.297 (owner pick C + 1, 2026-11-09): the intern opens THEIR OWN issued certificate PDF from LIFF.
// The PDF snapshots (`certificate-files/…`, `certificate_files/{no}`) stay admin-only in the rules; this
// function is the only door. Identity comes from the LINE ID token (verified with LINE), not from the
// anonymous Firebase uid, which any client can link to any userId.
'use strict';

const LINE_LOGIN_CHANNEL_ID = '2008959998';   // the channel behind USER_LIFF_ID 2008959998-yjcNpaGt (public, not a secret)

// The LINE account may own the doc directly (users/{U…}) or through the admin's merge list.
function ownsUserDoc(userId, lineSub, userDoc) {
    if (!userId || !lineSub || !userDoc) return false;
    if (userId === lineSub) return true;
    return Array.isArray(userDoc.linkedLineUserIds) && userDoc.linkedLineUserIds.includes(lineSub);
}

// Why the intern cannot have a file yet ('' = fine). `cert` = certificates/{no}, `files` = certificate_files/{no}.
function certProblem(userId, userDoc, cert, files) {
    if (!userDoc || !userDoc.certApproved || !userDoc.certNo) return 'not-issued';
    if (!cert || cert.status !== 'valid') return 'not-valid';
    if (cert.userId && cert.userId !== userId) return 'not-yours';
    if (!filePath(files)) return 'no-file';
    return '';
}

// the newest export wins (a re-export after a fix replaces what the intern gets)
function filePath(files) {
    const f = files && (files.latest || files.original);
    return f && typeof f.path === 'string' && f.path.startsWith('certificate-files/') ? f.path : '';
}

async function verifyLineIdToken(axios, idToken) {
    const body = new URLSearchParams({ id_token: String(idToken || ''), client_id: LINE_LOGIN_CHANNEL_ID });
    const res = await axios.post('https://api.line.me/oauth2/v2.1/verify', body.toString(),
        { headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, timeout: 10000, validateStatus: () => true });
    return res.status === 200 && res.data && typeof res.data.sub === 'string' ? res.data.sub : '';
}

module.exports = { LINE_LOGIN_CHANNEL_ID, ownsUserDoc, certProblem, filePath, verifyLineIdToken };
