/* 🥣 Cereal Killer — board data (Phase 0, 2026-11-20). Not loaded by index.html yet.
   Transcribed from the owner's photos of the printed board; the cell-by-cell record with the photo
   cross-checks is docs/CEREAL-KILLER-PLAN.md Appendix A. Data only — the loader, adjacency and every
   rule live in cereal-rules.js, so a transcription slip is a one-character fix here.

   Letters: H house · P park (witness) · C café · S subway · T train station · B dog bowl · . street · - no cell
   city:   20 letters read row by row = cells 1..20 on a 5-wide, 4-row grid (spaces are ignored)
   suburb: 4 rows that sit directly under the city (y 5..8); ids continue from 21 in reading order, skipping '-'
   subway: the one pair of S cells (a step from one lands on the other)
   train:  the three T stations in track order (a step moves to the next or previous station only) */
(function (root, data) {
  if (typeof module === 'object' && module.exports) module.exports = data; else root.CEREAL_MAPS = data;
})(typeof self !== 'undefined' ? self : this, {
  city: {
    A: { cells: 'HPHPH .CH.S H.PCH S.HH.', subway: [10, 16] },
    B: { cells: 'H..CH .SHPH HCPS. PHH.H', subway: [7, 14] },
  },
  suburb: {
    A: { rows: ['CBHPP', 'PHTHC', '.H-PH', 'T---T'], train: [35, 28, 36] },
    B: { rows: ['HPBPT', '.HCH-', 'TPHH-', '---T-'], train: [30, 34, 25] },
  },
  // The four printed pairings; spoons = difficulty for the killer.
  difficulty: [
    { city: 'B', suburb: 'B', name: 'Rookie killer', th: 'ฆาตกรมือใหม่', spoons: 1 },
    { city: 'A', suburb: 'A', name: 'Skilled killer', th: 'ฆาตกรผู้ชำนาญ', spoons: 2 },
    { city: 'B', suburb: 'A', name: 'Hot-headed killer', th: 'ฆาตกรหัวร้อน', spoons: 3 },
    { city: 'A', suburb: 'B', name: 'Cereal killer', th: 'ซีเรียลคิลเลอร์', spoons: 4 },
  ],
});
