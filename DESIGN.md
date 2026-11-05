# DESIGN.md — INTERN-PORT UI house rules

How screens in this project are designed. Read it before any UI work. `CLAUDE.md` says *what to protect*; this file says *how it should look and feel*.

**Every section has the same shape:** one line on *why*, then a table. Rules use `Rule · ✓ Do · ✗ Don't`. Reference sections use `Item · Spec / meaning · Where`.

---

## 1. Principles
*Why: every screen should be understood at a glance, with fewer things, said once, in the smallest space.*

| # | Rule | ✓ Do | ✗ Don't |
|---|---|---|---|
| 1.1 | **Lean** | One line where one is enough; a card is 2–3 rows, a panel header 1–2 lines | A divider that separates nothing; 25 px above a heading |
| 1.2 | **Inline** | Actions on the row they act on (🎁 🗡️ 🗑 beside the name); forms open in place, under what opened them | A footer or second panel of actions |
| 1.3 | **Less text** | A word only when an icon would be ambiguous; the explaining sentence goes in `title` + `aria-label` | Headings that repeat the context; "Choose a model to…" helper lines |
| 1.4 | **More emoji** | Emoji + hover instead of a word: ⭐ rating, ⏱ time, 🕒 date; pills with a number `📝 +0.9` | A word label where §5 already has an emoji |
| 1.5 | **Minimal** | Soft tints, one accent colour per screen, a coloured frame | Another box or border to say the same thing |

## 2. Content rules
*Why: what the owner corrected mockup after mockup.*

| # | Rule | ✓ Do | ✗ Don't |
|---|---|---|---|
| 2.1 | **Each number once, meaning one thing** | One count, in one place; a group chip hides its count when the division has one group | The same count in chip + caption + group; `Bonus +2.4` for what is the quiz score (`📝 +2.4`) |
| 2.2 | **Hide the empty and the OK** | Skip empty fields (one line lists what is missing); OK = a green frame or nothing | ✅ meaning "fine" (✅ = done by you) |
| 2.3 | **Signal, don't shout** | A small pill with emoji + number (`⏰ 179d`), a left-edge colour, a count chip; detail in the tooltip | A signal that changes data by itself |
| 2.4 | **Counts mean people** unless the emoji says otherwise | `👤` users · `👥` memberships · `📝` quizzes · `📅` events · `🧩` slots | A bare number with no emoji when it is not people |
| 2.5 | **EN first** | English visible; Thai / Korean in `data-th-*` / `data-kr-*` (title, placeholder, aria-label) | Thai-only visible text (the `kr-gap` ratchet fails on growth) |

## 3. Layout & controls
*Why: the same control looks and behaves the same on every screen.*

| # | Rule | ✓ Do | ✗ Don't |
|---|---|---|---|
| 3.1 | **Chip rails, not dropdowns** | A row of chips; a single toggle (sort, view) = one icon button that cycles | `<select>` for a choice the user makes often |
| 3.2 | **AI model picker = one style** (§6) | Vendor icons; tap one → its models open right beside it; the picked model stays visible | A second row of tabs; one long rail of every model |
| 3.3 | **Icon-only buttons carry a name** | `title` + `aria-label`; 26–30 px; 44 px on coarse pointers | An icon with no tooltip |
| 3.4 | **Destructive = red + quoted confirm** | Red 🗑 / ✕; the confirm quotes the full sentence of what will change | A native `confirm()` that can be dropped |
| 3.5 | **Header row first, group bands after** | Column headings on top, then `🟢 Live · 3` bands, then rows | The group name repeated on every row |
| 3.6 | **One list, two taps** | Tap the name to retire (🗑), tap to keep (📌); preview + button share the 2nd line | Two lists for one merge |
| 3.7 | **Panel under its trigger** | ⇄ opens right under the title; 🎨 / 🔗 rows open under the division caption | A modal on a modal when a row can open in place |
| 3.8 | **Never break what works** | Keep every id, handler and tooltip when re-flowing | Renaming an id a test or another screen grabs |

## 4. Components
*Why: reuse these measurements instead of inventing new ones.*

| Item | Spec | Where |
|---|---|---|
| **Pill** | 12 px / 700, padding 2 × 9 px, pastel bg + dark text of the same hue, `cursor:help` with a tooltip. Yellow = rating · green = good / points · teal = add-on · red = signal · grey = neutral · violet = topic | Scores, signals, counts |
| **Icon button** | 26–30 px, 9 px radius, 1 px `#e2e8f0` border, 15 px emoji; red text for delete | Row actions |
| **Card** | 3 rows: *who · facts · actions* / *content* / *footnotes*; left edge = state colour; no footer | Lists of people, requests, feedback |
| **Model picker** | `bindRegistryModelInput` (vendor-first, inline): vendor icons → the picked vendor's chips beside it; trial models (Grok, Ollama) last | Every AI model choice (§6) |
| **Spacing** | 6 / 8 / 10 px rhythm; a heading 6–8 px above its list | Everywhere |

## 5. Emoji vocabulary
*Why: one meaning each. Add a row here **before** using an emoji for a new meaning.*

| Emoji | Means | Emoji | Means |
|---|---|---|---|
| 📝 | quiz points / the quiz | 🎁 | feedback add-on (credited) |
| ⭐ | rating / score | 🗡️ | AI score |
| 🎯 | next topic requested | ⏰ | signal: past the training period / overdue |
| 🏆 | ranked together as one board | 👤 | individual / one user |
| 👍 | 10/10 with no comment | 🗑 | delete / the name to retire |
| 📌 | keep (merge target) | ⇄ | merge / fix spellings |
| 🔎 | search | 🧩 | division slot |
| ⏱ | time used | 🕒 | date / waiting |
| ↩️ | repair / undo a revert | 📱 | LIFF preview as that user |
| ⚠️ | something is off (hover says what) | 🔗 | link |

## 6. AI model picker
*Why: 19 models plus trials. One style lets the admin find a model the same way on every screen.*

| # | Rule | ✓ Do | ✗ Don't |
|---|---|---|---|
| 6.1 | **Vendor icons first** | One icon per vendor in `TEXT_AI_MODELS` order (Gemini · GPT · Claude · Qwen · DeepSeek · Muse · Kimi), then the trial vendors (Grok · Ollama) | Vendor names as words; a separate tab row |
| 6.2 | **The picked vendor's chips sit beside its icon** | Chip text = `short` (Luna 6, Sonnet 5.5); the full name in `aria-label` | Every model chip at once |
| 6.3 | **OpenRouter shows as the chip's dot** | The existing dot / tint from `text-ai-chips.css` | A word "OpenRouter" on the chip |
| 6.4 | **Trial models stay trial** | Grok / Ollama only where the tool offers trials; never an AI Settings default | A trial model saved as a default |

## 7. Process
*Why: the owner sees the change before the code, and nothing ships unverified.*

| Step | What | Done when |
|---|---|---|
| 1 | **Mockup** before / after from the real code (render the real modal with a fixture); one `.html` ≤ 512 KB (JPEG ~0.7×; bigger opens as raw source in the Browser pane); say what is real and what is a runtime edit | The owner picks ("ทำตามนี้เลย") |
| 2 | **Build** on a branch from `origin/production`; add `scripts/*-qa.cjs` for the new behaviour | The new QA fails without the change |
| 3 | **Sweep**: run all `scripts/*-qa.cjs` + `*-check.cjs` | Only the known machine-local failures remain |
| 4 | **PR** (never stack); merge only when the QA run for the head SHA is green; a rules or functions change also needs a manual deploy (say so in the PR) | The live `<title>` shows the new version |
| 5 | **Verify** on the real surface (authed admin / phone / LIFF) | What was *not* verified is said in the report |

## 8. Pre-PR checklist
*Why: the questions that catch most review comments.*

| # | Check | Rule |
|---|---|---|
| 8.1 | Can it be one line shorter? Is a sentence better as a tooltip? | 1.1 · 1.3 |
| 8.2 | Does any number appear twice? Does a label say something the value is not? | 2.1 |
| 8.3 | Are empty / OK states hidden? Is there a ✅ that means "fine"? | 2.2 |
| 8.4 | Every icon-only control has `title` + `aria-label`; ≥ 44 px on coarse pointers | 3.3 |
| 8.5 | Any new emoji is in §5; Thai / Korean ride in attributes | 2.5 · §5 |
| 8.6 | An AI model choice uses the one picker | 3.2 · §6 |
| 8.7 | Every id / handler still there; all QA scripts pass | 3.8 · 7.3 |
| 8.8 | Before / after shown to the owner before the code | 7.1 |
