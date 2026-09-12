const fs = require('node:fs');
const assert = require('node:assert/strict');

// Existing open tabs request exactly this byte range. Keep the complete title
// inside it so old clients can discover the release without first reloading.
for (const page of ['index.html', 'admin.html']) {
    const bytes = fs.readFileSync('public/' + page);
    const html = bytes.toString('utf8');
    const range = bytes.subarray(0, 501).toString('utf8');
    const versionPattern = /<title>[^<]*(V\d+\.\d+)[^<]*<\/title>/;
    assert.equal(range.match(versionPattern)?.[1], html.match(versionPattern)?.[1], page + ': legacy update detector must find version in first 501 bytes');
    assert.ok(range.match(versionPattern), page + ': missing release title');
}
console.log('PASS: both release titles are discoverable by existing update detectors');
