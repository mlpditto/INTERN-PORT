// Bangkok district for a flood-watch point + what that district did in the 2554 and 2569 floods.
//
// District: Nominatim reverse geocode (OSM, free; policy = identify yourself in the User-Agent, ≤ 1 request/s,
// cache). The point is already rounded to 3 dp (~100 m) by the intern page, so an in-memory cache keyed on that
// rounding makes repeat opens free. Never throws — the popup just shows no district line.
//
// History (verified 2026-10-08, see memory reference_bkk_flood_districts_2554_2569):
//   2569 = ประกาศกองอำนวยการป้องกันและบรรเทาสาธารณภัยกรุงเทพมหานคร 29 ก.ย. 2569 — 21 districts had their disaster status
//          ended, 29 remain (ปานกลาง 14 / สูง 15). The split comes from Rocket Media Lab's reading of the attachment.
//   2554 = Rocket Media Lab's compilation from news reports (NOT an official list): 5 groups collapsed to 3.
// Levels: 'high' | 'moderate' | 'none' ('none' in 2569 means the disaster status was ENDED, not "no water").

const H = 'high', M = 'moderate', N = 'none';
const DISTRICTS = {
    'คลองสามวา': [H, H], 'คันนายาว': [M, H], 'จตุจักร': [H, H], 'บางกะปิ': [M, H], 'บางเขน': [H, H],
    'บึงกุ่ม': [M, H], 'ประเวศ': [M, H], 'มีนบุรี': [M, H], 'ลาดกระบัง': [M, H], 'วังทองหลาง': [N, H],
    'สวนหลวง': [N, H], 'สะพานสูง': [M, H], 'สายไหม': [H, H], 'หนองจอก': [M, H], 'หลักสี่': [H, H],
    'ดอนเมือง': [H, M], 'ดินแดง': [M, M], 'ดุสิต': [M, M], 'ทวีวัฒนา': [H, M], 'ทุ่งครุ': [N, M],
    'บางซื่อ': [M, M], 'บางนา': [N, M], 'บางบอน': [M, M], 'บางพลัด': [H, M], 'พญาไท': [N, M],
    'พระโขนง': [M, M], 'ราชเทวี': [N, M], 'วัฒนา': [N, M], 'ห้วยขวาง': [M, M],
    'คลองเตย': [M, N], 'คลองสาน': [N, N], 'จอมทอง': [M, N], 'ตลิ่งชัน': [H, N], 'ธนบุรี': [M, N],
    'บางกอกน้อย': [M, N], 'บางกอกใหญ่': [M, N], 'บางขุนเทียน': [M, N], 'บางคอแหลม': [M, N], 'บางแค': [H, N],
    'บางรัก': [M, N], 'ปทุมวัน': [N, N], 'ป้อมปราบศัตรูพ่าย': [N, N], 'พระนคร': [M, N], 'ภาษีเจริญ': [H, N],
    'ยานนาวา': [M, N], 'ราษฎร์บูรณะ': [N, N], 'ลาดพร้าว': [M, N], 'สัมพันธวงศ์': [M, N], 'สาทร': [N, N],
    'หนองแขม': [H, N]
};

// 'เขตบึงกุ่ม' / 'Bueng Kum District' / 'บึงกุ่ม' → 'บึงกุ่ม' when it is one of the 50, else null.
function districtName(raw) {
    const s = String(raw || '').trim().replace(/^เขต\s*/, '').trim();
    return Object.prototype.hasOwnProperty.call(DISTRICTS, s) ? s : null;
}

function districtHistory(name) {
    const d = DISTRICTS[name];
    return d ? { y2554: d[0], y2569: d[1] } : null;
}

const cache = new Map();   // '13.830,100.660' → Promise<string|null>
function resolveDistrict(lat, lon, http) {
    if (!http) http = require('axios').get;   // lazy: the check script runs where functions/node_modules may be absent
    const key = `${Number(lat).toFixed(3)},${Number(lon).toFixed(3)}`;
    if (!cache.has(key)) {
        const p = http('https://nominatim.openstreetmap.org/reverse', {
            params: { format: 'jsonv2', lat: Number(lat).toFixed(4), lon: Number(lon).toFixed(4), zoom: 14, 'accept-language': 'th' },
            headers: { 'User-Agent': 'INTERN-PORT flood-watch (github.com/mlpditto/INTERN-PORT)' },
            timeout: 8000
        }).then(r => {
            const a = (r && r.data && r.data.address) || {};
            // Bangkok's เขต arrives as suburb (zoom 14) — city_district / borough on some tiles.
            return districtName(a.suburb) || districtName(a.city_district) || districtName(a.borough) || null;
        }).catch(e => { console.warn('[flood-district] reverse geocode failed:', e && e.message); cache.delete(key); return null; });
        cache.set(key, p);
    }
    return cache.get(key);
}

module.exports = { DISTRICTS, districtName, districtHistory, resolveDistrict };
