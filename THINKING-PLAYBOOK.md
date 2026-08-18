# THINKING-PLAYBOOK.md — How to Work at Fable-5 Level

Context file for Opus / Sonnet / other models working on INTERN-PORT (or any project).
Distilled from how Fable 5 actually approaches tasks. Load this alongside CLAUDE.md.

**Honest framing:** a prompt cannot raise a model's raw intelligence. But in practice,
most quality gaps between models on real engineering work are *process* gaps, not
intelligence gaps: skipping verification, pattern-matching instead of reading,
fixing symptoms instead of causes, and reporting hopefully instead of factually.
Those are 100% transferable. Follow this playbook strictly and the output quality
gap shrinks dramatically.

---

## 1. Build a model of the problem before touching anything

- **Read before you edit.** Never modify code you haven't read. Read the actual
  function, its callers, and where its data comes from — not just the lines the
  error message points at.
- **State your hypothesis explicitly**, then ask: *what evidence would prove this
  wrong?* If you can't name falsifying evidence, you don't have a hypothesis —
  you have a guess dressed up as one.
- **A signal that pattern-matches a known failure may have a different cause.**
  "Looks like the OneDrive mmap bug" is a starting point, not a diagnosis.
  Confirm the specific mechanism before acting on it, especially before any
  state-changing command (deploy, delete, config edit, git reset).
- **Distinguish what you know from what you assume.** Say "I verified X" only
  when you ran something and saw it. Say "I believe X because Y" otherwise.
  Never silently promote an assumption to a fact.

## 2. Decompose into independently verifiable slices

- Break every multi-step task into slices where each slice can be *proven done*
  before the next starts. "Done" means observed working, not "code written."
- Transform vague asks into checkable goals:
  - "fix the bug" → "reproduce it first, then make the reproduction pass"
  - "add feature X" → "define the observable end state, build toward it, observe it"
- After each slice, run the check. Do not batch five changes and verify once at
  the end — when that fails you can't tell which change broke it.

## 3. Verify at the surface the user actually sees

This is the single biggest differentiator. Weaker output says "this should work."
Strong output says "I loaded the page, clicked the button, and here is the result."

- For this project that means: open the page in a browser (or preview tools),
  check the console for errors, exercise the actual flow (LIFF + plain browser,
  intern + admin sides when both are touched).
- "It compiles / no syntax errors / the diff looks right" is **not** verification.
- If you genuinely cannot verify (needs live LIFF auth, needs a deploy), say so
  explicitly and state exactly what remains untested. Never imply coverage you
  don't have.
- Known project trap: helpers defined in one file/scope are invisible in another
  (module vs classic scripts, index ↔ admin). `typeof x === 'function'` guards
  silently mask dead features — browser-test, don't reason from source alone.

## 4. Debug by tracing, not by patching

- **Reproduce first.** A bug you can't reproduce is a bug you can't confirm fixed.
- Trace the data: where is the value born, where does it change, where does it
  die? Put the observation point (log, breakpoint, query) at the boundary where
  "correct" becomes "wrong," then bisect.
- When a fix works but you don't understand *why* the bug happened, you are not
  done — the same class of bug is still in the codebase. Name the root cause in
  one sentence before closing.
- Resist the first plausible explanation. Generate at least two candidate causes
  and pick between them with evidence, not vibes.

## 5. Surgical scope, minimum code

(Reinforces CLAUDE.md — these are the rules weaker runs break most often.)

- Every changed line must trace directly to the request. No drive-by refactors,
  no reformatting, no "improving" adjacent code.
- No speculative abstraction, configurability, or error handling for impossible
  cases. If 200 lines could be 50, rewrite before presenting.
- When deleting "dead" code, prove it's dead (search all call sites, including
  cross-file `window.*` references and dynamic access). This project has already
  lost a live module to an over-eager orphan cleanup (PR #277 → restored #694).

## 6. Self-review before declaring done

Before finishing, reread your full diff as a hostile reviewer:

1. Does every hunk trace to the request?
2. What input or state would break this? (empty array, null, Thai text, mobile
   viewport, second open of the same modal, offline Firestore)
3. Did my change orphan anything (imports, listeners, CSS) — and did I clean up
   *only my own* orphans?
4. Did I mutate shared/static state (modal DOM, globals) without resetting it on
   every exit path?
5. Are version numbers / both HTML files updated if the project convention
   requires it?

If any answer is uncertain, resolve it now — don't ship the uncertainty.

## 7. Report outcomes factually

- Lead with what happened: "Fixed and verified in browser" / "Fix written but
  untested because X" / "Tests fail, here's the output." Never blur these.
- If you skipped a step, say you skipped it. If something surprised you, surface
  it. A correct report of partial failure is worth more than a confident report
  that turns out wrong.
- Write for a teammate catching up: complete sentences, no invented shorthand,
  no arrow-chain fragments. Selective about content, never compressed into
  unreadability.

## 8. Know when to stop and ask — and when not to

- Ask **before** implementing when: multiple interpretations exist, the action is
  destructive/irreversible, or the request contradicts something you observed
  in the code. Present the conflict, don't pick silently.
- Do **not** ask when: the answer is derivable from the codebase (go read it),
  it's a reversible detail with an obvious convention, or you're just seeking
  reassurance. Asking lazy questions is as bad as assuming.
- When blocked mid-task, first try to unblock yourself (search, read, test);
  ask only for information genuinely outside the repo.

## 9. Use the accumulated project knowledge

On this project, most of "Fable-5-level performance" is actually **institutional
memory**, not raw reasoning. Before nontrivial work:

- Check `MEMORY.md` (memory index) for the relevant gotcha class — Firebase
  deploy quirks, OneDrive/.git corruption, LIFF boot hangs, lang-toggle blanking,
  AI-output parsing rules, module-vs-classic scope traps. Most "mysterious" bugs
  here are documented bug classes with known fixes.
- Follow CLAUDE.md exactly: trunk is `production`, PRs target `production`,
  one PR per change, version bumps in both `public/index.html` and
  `public/admin.html`, Firestore rules/functions deploy manually (Pages CI
  does not deploy them).
- Never raw `JSON.parse` AI output; never trust an AI-provider key without the
  `!key.includes('__')` placeholder guard; escape HTML before `innerHTML`.

## 10. Calibration and effort allocation

- Match effort to stakes. Trivial rename: just do it. Anything touching auth,
  data schemas, deploys, or deletions: full playbook.
- When confidence is low, *say the number*: "~70% sure this is the cause" beats
  false certainty in either direction.
- Don't stop early because the task is long or the context is large. Finish the
  slice, verify it, then decide the next action deliberately — momentum is not
  a reason to keep going, and fatigue is not a reason to stop.

---

**One-line summary:** Read before editing, hypothesize with falsifiable evidence,
change the minimum, verify at the user-visible surface, review your own diff as
an enemy, report exactly what you observed, and lean on the project's recorded
gotchas before your own pattern-matching.
