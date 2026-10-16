# DESIGN.md — INTERN-PORT UI house rules

How screens in this project are designed. Read it before any UI work; `CLAUDE.md` says *what to protect*, this says *how it should look and feel*. These are the rules the owner has been applying mockup after mockup — written down so nobody has to relearn them.

## 1. The one idea: lower the cognitive load

Every screen should be understood **at a glance**. Prefer fewer things, said once, in the smallest space.

| Principle | In practice |
|---|---|
| **Lean** | One line where one line is enough. A card is 2–3 rows, a panel header is 1–2 lines. Whitespace that carries no meaning is a bug (a divider that separates nothing, 25px of margin above a heading). |
| **Inline** | Actions sit on the row they act on (🎁 🗡️ 🗑 beside the name), not in a footer or a second panel. Forms open in place, under what opened them. |
| **Less text** | A label is a word only when an icon would be ambiguous. The sentence that explains goes in the **tooltip** (and `aria-label`). No headings that repeat the surrounding context, no "Choose a model to…" helper lines. |
| **More emoji** | An emoji (or an icon) + hover replaces a word: ⭐ rating, ⏱ time, 🕒 date, 🎯 next topic. Pills with a number: `📝 +0.9`, `⏰ 179d`. |
| **Minimal** | Fewer borders, fewer cards, soft tints, one accent colour per screen. Say it with a coloured frame, not another box. |

## 2. Rules

1. **Each number appears once, and means one thing.** Never show the same count in the chip, in the caption and in the group (RSU 2 · "2 people" · EXTERN 2). Never label a value with a word it is not — `Bonus +2.4` was the *quiz* score; it is `📝 +2.4`. A group chip hides its count when the division has a single group.
2. **Chip rails, not dropdowns.** Choices are a row of chips (vendor icons → that vendor's models). A single toggle (sort, view) is one icon button that cycles.
3. **Icon-only buttons carry a name.** Tooltip (`title`) *and* `aria-label`; 26–30px; 44px on coarse pointers. Destructive = a red 🗑/✕ and the confirm dialog **quotes the full sentence** of what will change.
4. **Hide the empty and the OK.** Empty fields are not rendered (one line lists what is missing). OK = a green frame or nothing — **no ✅ for "ok"** (a ✅ means "done by you", never "fine"). Show a state only when it needs attention.
5. **Signal, don't shout.** An exceptional state is a small coloured pill with an emoji and a number (`⏰ 179d`: training is over and nothing was credited), a left-edge colour on the card, a count chip in the filter rail, and the detail in the tooltip. A signal **points**; it never changes data by itself.
6. **Header row first, group bands after.** Lists: column headings on top, then a band per group (`🟢 Live · 3`, `Paused · Templates`), then its rows. The band says the group once; the heading serves them all.
7. **One list, two taps** beats two lists. Merge = tap the name to retire (🗑), tap the name to keep (📌); the preview and the button share the second line.
8. **Counts mean people unless the emoji says otherwise** — `👤` users, `👥` extra memberships, `📝` quizzes, `📅` events, `🧩` division slots.
9. **EN first.** English is the visible text; Thai/Korean ride in `data-th-*` / `data-kr-*` attributes (title, placeholder, aria-label). Do not add Thai-only text (the `kr-gap` ratchet fails on growth).
10. **Never break what works:** keep every existing id, handler and tooltip when re-flowing a panel — tests grab them.

## 3. Emoji vocabulary (one meaning each — do not reuse)

| Emoji | Means | | Emoji | Means |
|---|---|---|---|---|
| 📝 | quiz points / the quiz | | 🎁 | feedback add-on (credited) |
| ⭐ | rating / score | | 🗡️ | AI score |
| 🎯 | next topic requested | | ⏰ | signal: past the training period / overdue |
| 🏆 | ranked together as one board | | 👤 | individual / one user |
| 👍 | 10/10 with no comment | | 🗑 | delete / the name to retire |
| 📌 | keep (merge target) | | ⇄ | merge / fix spellings |
| 🔎 | search | | 🧩 | division slot |
| ⏱ | time used | | 🕒 | date / waiting |
| ↩️ | repair / undo a revert | | 📱 | LIFF preview as that user |
| ⚠️ | something is off (hover says what) | | 🔗 | link |

Add a row here **before** using a new emoji for a new meaning.

## 4. Components

- **Pill** (`font 12px/700`, `padding 2px 9px`, pastel bg + dark text of the same hue, `cursor:help` when it has a tooltip). Colours: yellow = rating, green = good/points, teal = add-on, red = signal, grey = neutral, violet = topic.
- **Icon button** 26–30px, 9px radius, 1px `#e2e8f0` border, 15px emoji; red text for delete.
- **Card**: 3 rows — *who · facts · actions* / *the content* / *footnotes*; left edge = state colour; no footer.
- **Panel under its trigger** (⇄ opens right under the title; 🎨 / 🔗 rows open under the division caption) — never a modal on a modal when a row can open in place.
- **Spacing rhythm**: 6 / 8 / 10px. A heading sits 6–8px above its list.

## 5. Process

1. **Mockup before code** — *before / after from the real code* (render the real modal with a fixture; the AFTER re-flows or re-builds from the same data), one bundled `.html`, **≤ 512 KB** (JPEG ~0.7×; bigger opens as raw source in the Browser pane). Say what is real and what is a runtime edit.
2. The owner picks ("ทำตามนี้เลย") → build on a branch from `origin/production` → `scripts/*-qa.cjs` for the new behaviour → run **all** `scripts/*-qa.cjs` + `*-check.cjs` → PR (never stack).
3. **Merge only when CI is green** (`gh pr checks --watch`, then merge — in the same command, gated). A rules or functions change also needs a manual deploy; say so in the PR.
4. Verify on the **real surface** (authed admin / phone / LIFF) and report what was *not* verified.

## 6. Pre-PR checklist

- [ ] Can it be one line shorter? Is any sentence better as a tooltip?
- [ ] Does any number appear twice? Does any label say something the value is not?
- [ ] Are empty / OK states hidden? Is there a ✅ that means "fine"?
- [ ] Every icon-only control has `title` + `aria-label`; coarse-pointer size is ≥ 44px.
- [ ] Any new emoji is in §3; Thai/Korean ride in attributes.
- [ ] Every id / handler a test or another screen uses is still there; all QA scripts pass.
- [ ] Before / after shown to the owner (≤ 512 KB) before the code.
