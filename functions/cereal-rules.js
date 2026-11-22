/* 🥣 Cereal Killer — rules engine (Phase 0, 2026-11-20). Not loaded by index.html yet.
   Pure functions over a board built from cereal-maps.js: no DOM, no Firebase, no state of its own. The same
   file runs in the page (window.CerealRules), in node for scripts/cereal-rules-check.cjs, and later inside
   the cerealAct Cloud Function, so the client's move preview and the referee can never disagree.
   Rules source: the owner's Thai summary of the printed rulebook — docs/CEREAL-KILLER-PLAN.md §1 and Appendix A.

   Vocabulary: a "path" is an array of cell ids whose first element is where the mover already stands, so a
   3-step move is a 4-element path. A "step" is one hop: to an orthogonal neighbour, through the subway
   (S → the other S) or along the train (T → the next / previous station). Diagonals never count, except
   for Lola's Bark. Backtracking is always allowed. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(); else root.CerealRules = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const CITY_W = 5, CITY_ROWS = 4, CITY_CELLS = CITY_W * CITY_ROWS;
  const T = { HOUSE: 'H', PARK: 'P', CAFE: 'C', SUBWAY: 'S', TRAIN: 'T', BOWL: 'B', STREET: '.' };
  const STEPS = { killer: 3, detective: 3, lola: 4 };
  const DAYS = 7, MAX_KILLS = 6, ARRESTS = 4;
  const CALENDAR_MIN = { 2: 1, 4: 3, 7: 6 };            // kills required by the END of that day
  const QUESTIONS = ['dir', 'row', 'col', 'building', 'parity', 'area'];   // 'area' = 3-player card
  const DIRS = ['N', 'S', 'E', 'W'];
  const BUILDING_TYPES = [T.HOUSE, T.CAFE, T.SUBWAY, T.TRAIN];  // "in a building" = house / café / S / T (not the bowl)
  const ABILITIES = ['sniff', 'bark', 'bite'];

  // ---- board ---------------------------------------------------------------------------------------

  /** Build a board. maps = the cereal-maps.js object; citySide 'A'|'B'; suburbSide 'A'|'B'|null (2-player = null).
   *  opts.seam (default true): the suburb's top row touches the city's bottom row (16↔21 … 20↔25). */
  function buildMap(maps, citySide, suburbSide, opts) {
    const seam = !opts || opts.seam !== false;
    const city = maps.city[citySide], suburb = suburbSide ? maps.suburb[suburbSide] : null;
    if (!city) throw new Error('unknown city side ' + citySide);
    if (suburbSide && !suburb) throw new Error('unknown suburb side ' + suburbSide);
    const cells = {}, ids = [];
    let id = 1;
    city.cells.replace(/\s+/g, '').split('').forEach((t, i) => {
      cells[id] = { id, x: i % CITY_W + 1, y: Math.floor(i / CITY_W) + 1, t }; ids.push(id); id++;
    });
    if (ids.length !== CITY_CELLS) throw new Error('city ' + citySide + ' needs ' + CITY_CELLS + ' cells, got ' + ids.length);
    if (suburb) suburb.rows.forEach((row, y) => row.split('').forEach((t, x) => {
      if (t === '-') return;
      cells[id] = { id, x: x + 1, y: y + 1 + CITY_ROWS, t }; ids.push(id); id++;
    }));
    const subway = {};
    if (city.subway) { const [a, b] = city.subway; subway[a] = b; subway[b] = a; }
    return { citySide, suburbSide: suburbSide || null, seam, cells, ids, subway, train: suburb ? suburb.train.slice() : [] };
  }

  const cell = (map, id) => map.cells[id];
  const type = (map, id) => (map.cells[id] || {}).t;
  const inCity = id => id <= CITY_CELLS;
  const cellsOf = (map, t) => map.ids.filter(id => map.cells[id].t === t);

  /** Orthogonal neighbours (what "adjacent" means everywhere but Bark). */
  function neighbors(map, id) {
    const c = map.cells[id]; if (!c) return [];
    return map.ids.filter(o => {
      const d = map.cells[o];
      if (Math.abs(d.x - c.x) + Math.abs(d.y - c.y) !== 1) return false;
      return map.seam || inCity(o) === inCity(id);
    });
  }

  /** 8-neighbourhood, for Bark only. */
  function neighbors8(map, id) {
    const c = map.cells[id]; if (!c) return [];
    return map.ids.filter(o => {
      const d = map.cells[o];
      if (o === id || Math.max(Math.abs(d.x - c.x), Math.abs(d.y - c.y)) !== 1) return false;
      return map.seam || inCity(o) === inCity(id);
    });
  }

  /** Where one step from `id` may land. opts.canRide (default true) adds the subway partner and the train's
   *  neighbouring stations; opts.blocked = cells that may not be entered (the detective's and Lola's cells, for the killer). */
  function stepTargets(map, id, opts) {
    const o = opts || {}, canRide = o.canRide !== false, blocked = o.blocked || [];
    const out = neighbors(map, id);
    if (canRide) {
      if (map.subway[id]) out.push(map.subway[id]);
      const i = map.train.indexOf(id);
      if (i >= 0) { if (i > 0) out.push(map.train[i - 1]); if (i < map.train.length - 1) out.push(map.train[i + 1]); }
    }
    return out.filter(t => !blocked.includes(t));
  }

  /** Validate a path. opts: steps (budget), exact (must use the whole budget), canRide, blocked,
   *  bonusCells (passing THROUGH one of these — not starting or ending on it — adds one step, once).
   *  Returns { ok, error?, steps, bonus }. Errors: 'empty' · 'cell' · 'hop:<from>-<to>' · 'short' · 'long'. */
  function validatePath(map, path, opts) {
    const o = opts || {}, bonusCells = o.bonusCells || [];
    if (!Array.isArray(path) || !path.length) return { ok: false, error: 'empty', steps: 0, bonus: false };
    for (const id of path) if (!map.cells[id]) return { ok: false, error: 'cell', steps: 0, bonus: false };
    for (let i = 1; i < path.length; i++) {
      if (!stepTargets(map, path[i - 1], o).includes(path[i])) return { ok: false, error: 'hop:' + path[i - 1] + '-' + path[i], steps: i - 1, bonus: false };
    }
    const steps = path.length - 1;
    const bonus = path.slice(1, -1).some(id => bonusCells.includes(id));
    const budget = (o.steps == null ? steps : o.steps) + (bonus ? 1 : 0);
    if (o.exact && steps !== o.steps) return { ok: false, error: steps < o.steps ? 'short' : 'long', steps, bonus };
    if (steps > budget) return { ok: false, error: 'long', steps, bonus };
    return { ok: true, steps, bonus };
  }

  /** Every path of exactly `steps` hops from `from` (opts as stepTargets). Small boards, branching ≤ 5. */
  function legalPaths(map, from, steps, opts) {
    const out = [];
    (function walk(path) {
      if (path.length - 1 === steps) { out.push(path); return; }
      for (const t of stepTargets(map, path[path.length - 1], opts)) walk(path.concat(t));
    })([from]);
    return out;
  }

  /** Fewest steps between two cells with the given movement rules (BFS); -1 when unreachable. */
  function distance(map, from, to, opts) {
    if (from === to) return 0;
    const seen = new Set([from]); let frontier = [from], d = 0;
    while (frontier.length) {
      d++; const next = [];
      for (const id of frontier) for (const t of stepTargets(map, id, opts)) {
        if (t === to) return d;
        if (!seen.has(t)) { seen.add(t); next.push(t); }
      }
      frontier = next;
    }
    return -1;
  }

  // ---- killer ----------------------------------------------------------------------------------------

  /** The killer loses at once when no legal 3-step path exists. blocked = detective (+ Lola) cells. */
  const cornered = (map, from, blocked) => legalPaths(map, from, STEPS.killer, { exact: true, canRide: true, blocked }).length === 0;

  /** Houses on the path (start, passed or end) that do not already hold a cereal token. */
  function killOptions(map, path, taken) {
    const t = taken || [];
    return path.filter((id, i) => path.indexOf(id) === i && type(map, id) === T.HOUSE && !t.includes(id));
  }

  /** Parks orthogonally adjacent to the kill cell. Two → the killer picks; none → no witness this day. */
  const witnessOptions = (map, killCell) => neighbors(map, killCell).filter(id => type(map, id) === T.PARK);

  /** One killer turn. turn = { path, kill: id|null, witness: id|null }.
   *  ctx = { blocked: [detective, lola cells], taken: [houses with cereal], kills: count so far, skipUsed: bool }.
   *  Returns { ok, error?, kills, skipUsed, path, kill, witness }.
   *  Errors: path errors from validatePath · 'skip' (second no-kill day) · 'max' (already 6) · 'kill' (not a fresh house on the path)
   *  · 'witness' (not an adjacent park, or missing when one exists, or given when none exists) · 'end-on-witness'. */
  function validateKillerTurn(map, turn, ctx) {
    const c = ctx || {}, taken = c.taken || [], kills = c.kills || 0;
    const p = validatePath(map, turn.path, { steps: STEPS.killer, exact: true, canRide: true, blocked: c.blocked || [] });
    if (!p.ok) return { ok: false, error: p.error };
    const end = turn.path[turn.path.length - 1];
    if (turn.kill == null) {
      if (c.skipUsed) return { ok: false, error: 'skip' };
      if (turn.witness != null) return { ok: false, error: 'witness' };
      return { ok: true, kills, skipUsed: true, path: turn.path, kill: null, witness: null };
    }
    if (kills >= MAX_KILLS) return { ok: false, error: 'max' };
    if (!killOptions(map, turn.path, taken).includes(turn.kill)) return { ok: false, error: 'kill' };
    const parks = witnessOptions(map, turn.kill);
    if (parks.length ? !parks.includes(turn.witness) : turn.witness != null) return { ok: false, error: 'witness' };
    if (turn.witness != null && turn.witness === end) return { ok: false, error: 'end-on-witness' };
    return { ok: true, kills: kills + 1, skipUsed: !!c.skipUsed, path: turn.path, kill: turn.kill, witness: parks.length ? turn.witness : null };
  }

  /** Calendar minimum at the end of the killer's turn on `day`. false = the good side wins at once. */
  const calendarOk = (day, kills) => CALENDAR_MIN[day] == null || kills >= CALENDAR_MIN[day];

  // ---- questions -------------------------------------------------------------------------------------

  /** Compass directions of `target` as seen from `ref` (both ids). Both axes when diagonal; [] on the same cell. */
  function directions(map, ref, target) {
    const a = map.cells[ref], b = map.cells[target], out = [];
    if (b.y < a.y) out.push('N'); if (b.y > a.y) out.push('S');
    if (b.x > a.x) out.push('E'); if (b.x < a.x) out.push('W');
    return out;
  }

  /** Cells a truthful answer leaves possible: how much a direction gives away. Used to auto-pick between two
   *  true directions — the one with the larger consistent region tells the detective less. */
  function cellsInDirection(map, ref, dir) {
    const a = map.cells[ref];
    return map.ids.filter(id => {
      const c = map.cells[id];
      return dir === 'N' ? c.y < a.y : dir === 'S' ? c.y > a.y : dir === 'E' ? c.x > a.x : c.x < a.x;
    });
  }
  function leastInformative(map, ref, dirs) {
    return dirs.slice().sort((p, q) => cellsInDirection(map, ref, q).length - cellsInDirection(map, ref, p).length || DIRS.indexOf(p) - DIRS.indexOf(q))[0];
  }

  /** Every truthful answer to a question card, as an array (the compass card can have two). */
  function answer(map, question, killerCell, witnessCell) {
    const k = map.cells[killerCell], w = witnessCell != null ? map.cells[witnessCell] : null;
    switch (question) {
      case 'dir': return directions(map, witnessCell, killerCell);
      case 'row': return [k.y === w.y ? 'yes' : 'no'];
      case 'col': return [k.x === w.x ? 'yes' : 'no'];
      case 'building': return [BUILDING_TYPES.includes(k.t) ? 'yes' : 'no'];
      case 'parity': return [killerCell % 2 === 0 ? 'even' : 'odd'];
      case 'area': return [inCity(killerCell) ? 'city' : 'suburb'];
      default: throw new Error('unknown question ' + question);
    }
  }

  // ---- detective ------------------------------------------------------------------------------------

  /** ≤ 3 steps, +1 once for passing through a café (not the start cell). May ride S and T; nobody blocks the detective. */
  const validateDetectivePath = (map, path) => validatePath(map, path, { steps: STEPS.detective, canRide: true, bonusCells: cellsOf(map, T.CAFE) });

  /** Arrest / Bite target: the mover's own cell or an orthogonal neighbour. */
  const arrestValid = (map, from, target) => target === from || neighbors(map, from).includes(target);

  /** Standing on or next to the witness is what allows a question. */
  const canQuestion = (map, detectiveCell, witnessCell) => witnessCell != null && arrestValid(map, detectiveCell, witnessCell);

  // ---- Lola (3-player) ------------------------------------------------------------------------------

  /** ≤ 4 steps, +1 once for passing through the bowl (not the start cell); never rides S or T; cafés give nothing. */
  const validateLolaPath = (map, path) => validatePath(map, path, { steps: STEPS.lola, canRide: false, bonusCells: cellsOf(map, T.BOWL) });

  /** Never the same ability two turns in a row. */
  const lolaAbilityOk = (ability, lastAbility) => ABILITIES.includes(ability) && ability !== lastAbility;

  /** Sniff a cell (Lola's own or a neighbour). killerPath = the killer's path this day (start included), killerNow = its end.
   *  Truthful answers as an array, like answer(): ['center'] when the killer stands on the sniffed cell; the compass
   *  directions (one or two, killer picks) when he was there this day; ['no'] otherwise. */
  function sniff(map, killerPath, sniffCell, killerNow) {
    if (killerNow === sniffCell) return ['center'];
    if (!killerPath.includes(sniffCell)) return ['no'];
    return directions(map, sniffCell, killerNow);
  }

  /** Bark: is the killer on Lola's cell or any of the 8 cells around it? */
  const bark = (map, lolaCell, killerCell) => (lolaCell === killerCell || neighbors8(map, lolaCell).includes(killerCell)) ? 'yes' : 'no';

  // ---- starts ------------------------------------------------------------------------------------------

  const killerHomeOptions = map => cellsOf(map, T.HOUSE);
  const detectiveStartOptions = map => cellsOf(map, T.CAFE);
  const lolaStart = map => cellsOf(map, T.BOWL)[0] || null;

  return {
    T, STEPS, DAYS, MAX_KILLS, ARRESTS, CALENDAR_MIN, QUESTIONS, DIRS, ABILITIES, CITY_CELLS,
    buildMap, cell, type, inCity, cellsOf, neighbors, neighbors8, stepTargets, validatePath, legalPaths, distance,
    cornered, killOptions, witnessOptions, validateKillerTurn, calendarOk,
    directions, cellsInDirection, leastInformative, answer,
    validateDetectivePath, arrestValid, canQuestion,
    validateLolaPath, lolaAbilityOk, sniff, bark,
    killerHomeOptions, detectiveStartOptions, lolaStart,
  };
});
