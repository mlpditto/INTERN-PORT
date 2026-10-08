// functions/flood-district.js — the 2554 / 2569 table matches the verified lists (50 districts, 12/26/12 and 15/14/21),
// the name normaliser accepts Nominatim's 'เขต…' form and rejects anything else, and resolveDistrict reads Nominatim's
// address (suburb first), caches by the 3-dp key and never throws. No network: the http function is injected.
const assert = require('node:assert/strict');
const { DISTRICTS, districtName, districtHistory, resolveDistrict } = require('../functions/flood-district.js');

const names = Object.keys(DISTRICTS);
assert.equal(names.length, 50, '50 districts');
assert.equal(new Set(names).size, 50, 'no duplicate');
const count = (i, lv) => names.filter(n => DISTRICTS[n][i] === lv).length;
assert.deepEqual([count(0, 'high'), count(0, 'moderate'), count(0, 'none')], [12, 26, 12], '2554 = 12 สูง / 26 ปานกลาง / 12 ไม่กระทบ (Rocket Media Lab)');
assert.deepEqual([count(1, 'high'), count(1, 'moderate'), count(1, 'none')], [15, 14, 21], '2569 = 15 สูง / 14 ปานกลาง / 21 สิ้นสุดสถานะภัย (ประกาศ กทม. 29 ก.ย. 69)');
// spot checks straight from the announcement / infographic
assert.deepEqual(districtHistory('คันนายาว'), { y2554: 'moderate', y2569: 'high' });
assert.deepEqual(districtHistory('ดอนเมือง'), { y2554: 'high', y2569: 'moderate' });
assert.deepEqual(districtHistory('ปทุมวัน'), { y2554: 'none', y2569: 'none' });
assert.deepEqual(districtHistory('วังทองหลาง'), { y2554: 'none', y2569: 'high' }, 'flooded for the first time in 2569');
assert.deepEqual(districtHistory('หนองแขม'), { y2554: 'high', y2569: 'none' });
assert.equal(districtHistory('นนทบุรี'), null);

assert.equal(districtName('เขตบึงกุ่ม'), 'บึงกุ่ม');
assert.equal(districtName(' เขต คันนายาว '), 'คันนายาว');
assert.equal(districtName('บึงกุ่ม'), 'บึงกุ่ม');
assert.equal(districtName('Bueng Kum District'), null, 'English form is not mapped');
assert.equal(districtName('เขตเมืองนนทบุรี'), null);
assert.equal(districtName(undefined), null);

(async () => {
    const calls = [];
    const http = (url, opts) => { calls.push({ url, opts }); return Promise.resolve({ data: { address: { quarter: 'แขวงนวลจันทร์', suburb: 'เขตบึงกุ่ม', city: 'กรุงเทพมหานคร' } } }); };
    assert.equal(await resolveDistrict(13.83, 100.66, http), 'บึงกุ่ม');
    assert.equal(await resolveDistrict(13.8301, 100.6602, http), 'บึงกุ่ม', 'same 3-dp key → cached');
    assert.equal(calls.length, 1, 'one upstream call for two opens ~100 m apart');
    assert.ok(/nominatim\.openstreetmap\.org\/reverse$/.test(calls[0].url));
    assert.equal(calls[0].opts.params['accept-language'], 'th'); assert.equal(calls[0].opts.params.zoom, 14);
    assert.ok(/INTERN-PORT/.test(calls[0].opts.headers['User-Agent']), 'Nominatim policy: identify the app');
    // city_district fallback, outside-Bangkok → null, failure → null (and not cached)
    assert.equal(await resolveDistrict(13.9, 100.7, () => Promise.resolve({ data: { address: { city_district: 'เขตคลองสามวา' } } })), 'คลองสามวา');
    assert.equal(await resolveDistrict(13.95, 100.5, () => Promise.resolve({ data: { address: { suburb: 'เมืองนนทบุรี', city: 'นนทบุรี' } } })), null);
    let n = 0;
    const failing = () => { n++; return Promise.reject(new Error('timeout')); };
    assert.equal(await resolveDistrict(14.0, 100.4, failing), null);
    assert.equal(await resolveDistrict(14.0, 100.4, failing), null);
    assert.equal(n, 2, 'a failure is not cached');
    console.log('PASS: flood-district — 50 districts (2554 12/26/12, 2569 15/14/21), เขต-prefix normaliser, Nominatim suburb/city_district parse, 3-dp cache, failures → null');
})().catch(e => { console.error(e); process.exit(1); });
