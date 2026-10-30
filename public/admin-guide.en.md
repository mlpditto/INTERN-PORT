# Admin guide (Nika) — first-time setup

Page: https://mlpditto.github.io/INTERN-PORT/admin.html · works on desktop or phone (the tab bar scrolls sideways)

> Tab-level guide — every button name is taken from the real admin.html screen (the 📖 button in the header opens this guide)

---

## 0. 🔑 Login

The **Admin Portal** page has 3 ways in — use any one:

| Way | How |
|---|---|
| ✨ **Send Login Link** (recommended) | The email box is pre-filled with the admin email → press the button → open your email → tap the link on the same device you requested it from |
| **Google** | Press the Google button and pick the account in the popup |
| **LINE** | Press the LINE button (works when the LINE account is linked to the admin email) |

**Good to know**
- The system allows **one admin email only** (set in the code). Any other account sees `Access denied for …` even if Google sign-in succeeds
- Firefox often blocks the Google popup → use **Send Login Link** instead (the system suggests it and tries to send the link itself when the popup is blocked)
- Closed the popup halfway → just press Google again

---

## 1. 🧭 Header (top of every tab)

| Button | What it does |
|---|---|
| ☀️ **Nika V…** | Page name + the version you are running (the logged-in email is under the name) |
| ➕ **Create** | Make something new — **Task** (Kanban card) · **Quest** (daily quest) · **Event** (announcement) · **Article** (a short read that pops up when interns open the app) · **Quiz** · **Goals** · **Certificates** |
| 📥 **Archive** | See archived items (Quests, Tasks, etc.) |
| 📱 **UI** | Preview the intern's screen (LIFF Preview) without LINE |
| 🔮 | AI Engine settings (keys / models) — if it says "not loaded yet", refresh the page |
| ⚓ | Toggle the One Piece theme for Grand Line Deck + Laugh Tale |
| **EN** | Label language — each tap cycles EN → KR → TH → K·T |
| 🌓 | Switch light / dark mode |
| 👋 **Logout** | Sign out |

---

## 2. 🗺️ Tab map — nicknames → real jobs

| Tab | What it is | First thing to do |
|---|---|---|
| 📊 **Dashboard** | Home: work queue + Kanban + stats | Look at the numbers on the chip bar at the top — any chip that is not 0 means work is waiting |
| 📦 **Assignments** | Manage Quizzes, exams, restaurant-review links, the reward shop | A **red badge** on the tab = Quizzes waiting to be reviewed |
| 👥 **User Hub** | Intern list, scores, ranking, groups | Search an intern → see their history and scores |
| 🏴‍☠️ **Grand Line Deck** | AI tools for the team (chat, image generation, Podcast Studio) | Use when needed — nothing waiting here |
| 🏝️ **Laugh Tale** | Review interns' **Reflections** and **Quiz feedback** | Open the feedback the AI marked "Needs a fix" |
| 🏜️ **Alabasta** | Review queue for **Case** (patient cases) and **Product** (product listings) | Filter Pending → review one by one |
| 🪨 **Poneglyph** | Codex (**Drug** / **Disease**), My Path, Memories | Review Drug/Disease drafts that interns submitted |

### 📊 Dashboard
- **Chip bar at the top** (tap to open the list): 👤 Access (access requests) · 📖 Review (Reflective Review) · 💰 Claimed (points requested) · ⏱️ Quiz (waiting / late) · 💼 Work · 💊 Drug Drafts · 🩺 Disease Drafts · 📥 New Cases
- **Kanban**: Backlog → 🚧 Doing → 👀 Review → ✅ Done (search Tasks; Show archived for older ones)
- **🚀 Escalated**: learning notes an intern escalated for special attention · **🗑️ Note deletion requests**: requests to delete notes
- **AI usage · Overview**: AI usage summary + heatmap (tap to open)
- **Quiz Coverage by System**: which body systems the Quizzes cover
- **LINE pushes this month**: pushes sent this month + **Preview digest** / **Send this now** / **Copy text** (copy the message and paste it into the group yourself = no push used)

### 📦 Assignments (4 sub-tabs)
- 🧠 **Quiz Engine**: Quiz list filtered with chips (GRADED · TEMPLATE · ONE-TIME · 🔒 LOCKED · 📎 MATERIALS · 🧪 NOT AUDITED · 🏷️ INCOMPLETE); select several, then use 🚀 Activate · ⏹️ Deactivate · 📄 Export PDF · Merge · 🔍 Compare · 🏷️ AI tags · 🗑️ Delete · 🌐 Translate Missing
- 🎓 **Exam**: timed exam room (pick a Quiz + Host + total time; status Lobby / Running / Paused)
- 🔗 **Gourmet World**: restaurant-review links (➕ Add Link, 🖼️ Fetch missing logos; logos come from the link / upload / 🖼 Image link)
- 🏪 **A Shop for Killers**: the Beri reward shop — set name, link, logo, type, Beri Reward

### 👥 User Hub
- 🏆 **Elite Board** (ranking) · search box · 📅 score date range · 🏅 **Badge Stats** · 📤 share ranking · 🛡️ **Divisions & Groups** · 👥 **Entry** (pre-registration) · ⏳ preview of the points deducted for missed daily check-ins
- Open one intern's history (drill-down) and filter by Q (Quiz) · W (Work) · L (Logs) · B (Bonus) · M (Manual) · 📍 Check-in · 🪙 Beri
- 🛡️ **Divisions & Groups** (the shield button in the toolbar) — a *group* is a person's home team; a *division* is a bucket of people **ranked together** that can switch on a special UI (a division named **Content Creator** gives its members the Content card instead of Mission). A person's division is **their own setting** (`users.division`), so the **same group name can sit in several divisions**; a person with no division is in **Only I** (ranked only within their group). Docs created before this keep working: with no division set, it is the division whose group list holds their group.
  - Group **lists** are a **draft**: add / remove groups as much as you like, nothing is written until you press **Save** (a Save bar appears only while the lists differ, e.g. "+ Audit in RSU"). Closing without Save discards them. **Moving people is saved at once** (see below).
  - The top row is a **rail of divisions** (each has its own colour, plus **Only I**); the number on a chip is its active people. Tap one: its groups show below (its list + the groups of the people in it). **Search** at the top looks in every division at once; typing a group that exists elsewhere offers **＋ Add “X” to this division**, a brand-new name offers **＋ New group “X”** (an empty group kept in the division's list)
  - **Create a division**: the round ＋ at the end of the rail → type a name → ＋ (people can be moved into it after you Save) · **Move people**: tap a group chip → its **people** appear under it (tap names, or **All**) → **Move N →** a division or **Only I** — saved right away, the group name stays · **Remove a group from a division's list**: ⊖ (only when nobody is in it) · **Remove a division**: the ✕ on the right of the panel caption (its people go back to Only I; nothing is deleted)
  - **Look (🎨)**: colour · icon · picture for a group (🎨 in the picked group's action bar) or a division (🎨 beside ✕ in the caption). Each pick saves at once and every chip that shows that group / division follows (Users rail, User Hub, Elite Board, the row tag). A picture takes the icon's place (shown round); **↺ default** goes back to the built-in look.
  - **Memberships ("also")**: a person has ONE main group in ONE division (points, rank, quizzes, streak), and can **also** belong to other division · group pairs — in the User Hub group row, **＋** after "also" opens the same ① Division → ② Group picker; the pair shows as a faded **EXTERN | RSU** chip (tap = remove). A member counts in that division (Users rail, Divisions & Groups as a dashed name, Elite Board) and sees its work, but is never moved from there — change it in the User Hub.
  - ⚠️ In the same bar, the icons (✏️ Rename · ⇄ Merge · 👁 Visibility · 🗑 Delete, marked ⚡) acts on the **group itself** and **takes effect at once**, not on Save — Delete removes the group everywhere
  - Chip counts are active people only (hidden / not-yet-registered are left out) · division names the code treats specially: **Content Creator** (or the old name CAFE)

### 🏝️ Laugh Tale
- 📓 **Reflections** (reflective notes) and 🧠 **Quiz** (feedback on Quizzes) each have the tabs **Needs a fix · Analysis · Patterns · Comments**
- Pick the AI model used for analysis with the provider-logo chips
- 👒 **Straw Hat Mode**: hide / show the intern's identity · 📐 edit the LP Taxonomy · select several, then 🗑 Delete selected

### 🏜️ Alabasta
- Switch 🩺 **Case** / 🛒 **Product** · chips All / 📥 Pending / ✅ Reviewed / ❌ Rejected · date range · 🔎 search · ⬇️ CSV
- **Rejecting a case**: pick a reason (incomplete data · duplicate · not relevant · other) — the intern sees the reason in their own history
- Select several → ✅ Bulk Review / 🗑️ Bulk Delete
- **⋯** menu: ⚙️ Edit Case Taxonomy · 🔧 **Sync intern view** (syncs reviewed cases/work so the intern sees them) · 🔎 Scan orphan history (search only, deletes nothing)

### 🪨 Poneglyph
- 💊 **Drug Codex** · 🩺 **Disease Codex** (edit data, attach download-file links) · **My Path** (the admin's own learning notes + 🧭 AI Learning Path) · 🎟️ **Memories** (finished activities and stamps)
- 📊 **Monitor: Intern Learning Paths** to view interns' LP notes · 🗑️ Trash
- Editing / deleting an intern's note requires a **reason** so an audit log is kept (deletes are soft — recoverable from Trash)

---

## 3. 📅 Daily routine (example order)

1. Open **Dashboard** → look at the chips at the top; any that is not 0 is a queue
2. Check the red badge on 📦 **Assignments** → review the waiting Quizzes
3. **Alabasta** → filter Pending → review Cases / Products
4. **Laugh Tale** → look at "Needs a fix" in Quiz feedback

---

## 4. ⚠️ Caution

- **Everything writes to real data (production)** — even when you open this page from your own machine (localhost). There is no test mode
- **Delete / Bulk Delete / Archive** cannot be undone for some items — check the selection before you confirm
- **Send this now** (Dashboard) sends a real LINE message to the group. If you only need the text, use **Copy text**
- If you reviewed / rejected a case but the intern still sees the old status, try Alabasta → ⋯ → 🔧 Sync intern view

## 5. 🔧 Fixes

| Symptom | What to do |
|---|---|
| `Access denied for …` | Log in only with the specified admin account |
| Google popup does not appear | Use ✨ Send Login Link (especially on Firefox) |
| `Admin required` when pressing some buttons | Log out → log in again → if it still shows, tell the system owner (the account has no server-side permission yet) |
| 🔮 button says "not loaded yet" | Refresh the page |
| Numbers / lists look old | Refresh (Ctrl+F5) — after a version change the browser may still use old files; check the version number next to the Nika name |

---

## 6. 🧠 Jev — the AI helper

**Jev** is a small AI that answers short questions such as “do these two questions test the same fact?” or “which category is this shop?”. You can always recognise it by its **logo (a dark square with a teal J)** and the dark + teal colours.

> **Jev only suggests.** It never saves, deletes or scores anything on its own — you decide, you tick, you press Save.

### Where Jev is in the app

| Where | What Jev does | What you do |
|---|---|---|
| 📦 **Assignments** → tick 2+ quizzes → **🔍 Compare** | Puts a **chip** next to each “≈ %” match: **✓ 92%** = same fact · **✗** = different · **?** = not sure | Read both questions and decide which to keep or edit |
| 📦 **Assignments** → 🔗 **Gourmet World** → **Categories (n)** | Suggests a category for every shop that has none | Tick the ones you agree with → **Save** |
| **Quiz editor → PDF** (import questions) and **Reflective Review → AI suggestion** | A silent **guardrail**: checks the text for “ignore your instructions…” tricks before it goes to another AI | Only if it warns you: choose **Cancel** (stop) or **OK** (continue) |

### 🔍 Compare — duplicate questions

![Compare: the Compare button (1) and the Jev chips (2)](assets/guide/jev-compare.png)

1. In **Assignments**, tick two or more quizzes and press **🔍 Compare** (1).
2. Every pair of similar questions shows the plain “≈ %” (word overlap). A moment later **Jev adds its own chip** (2) to the **60 strongest matches**:
   - **✓ 92%** (dark + teal) — the questions test the **same fact**; answering one gives away the other
   - **✗** (grey) — **different** facts, even if the wording is similar
   - **?** (yellow edge) — Jev is **not sure**: read both questions yourself
3. No chip? Jev is switched off or did not answer — the “≈ %” still works on its own.

### ⚡ Categories — shops without a category

![Categories: the Jev button (1) and its list (2)](assets/guide/jev-categories.png)

1. The **Categories (n)** button (1) appears only when some shops have no category (n = how many).
2. Jev shows up to three guesses per shop with a %. **Confident answers (80% or more) are already ticked; doubtful ones are not** and are shown in amber (2).
3. Tap another chip to change a guess, tick the shops you agree with, press **Save**. Only the ticked ones are saved.

### 🛡️ Guardrail — when Jev warns you

![The Jev guardrail pop-up](assets/guide/jev-guardrail.png)

Before a PDF's text (or an intern's reflection) goes to another AI, Jev checks that the text is **study content, not an instruction aimed at the AI**. If it scores 70% or more you get this pop-up: **Cancel** stops, **OK** goes on anyway. In Reflective Review, a flagged text simply skips the AI grammar check. If Jev cannot answer, nothing is blocked — the work continues as before.

### Cost and where to look

- Jev runs on the **Jev AI** account (tokens). One comparison or one shop costs roughly 300–600 tokens; the balance is on the Jev AI dashboard (**Token account**).
- **For the technical admin:** in Firestore, `quiz_dup_scores/_config` → `{ enabled: false }` turns Compare chips and Categories off; `{ provider: "openrouter" }` sends the same questions through OpenRouter instead (no deploy needed).

---

## 7. 🏴‍☠️ Deck — images, video, audio

Tab: **🏴‍☠️ Grand Line Deck** → the three modes at the top: 🏴 Miss Goldenweek · 🧭 Log Pose · 🐳 Laboon.

### 🖼 Images

**Where:** 🏴 Miss Goldenweek.

1. Pick a look in **Visual Style Collection** on the left (Pirate Crew Life, Jolly Roger Vector, 3D Devil Fruit, Grand Line Map, Oda Manga Style, Wano Arc Anime). The style is added to every prompt.
2. Describe the picture in **🪄 Vision** — the formula beside the title is the recipe: *Context + Goal + Source + Expectations*. Thai is fine.
3. On the toolbar under the box, ✒ is the **enhancer model** (it rewrites your text into a structured English prompt; the logo tabs pick the provider, the chips the model). Pick the **engine**: **Nano Banana 2.1** (Google, cheapest, good for diagrams and infographics) or **Image 2** (OpenAI, strongest on text).
4. Press **✨ Create**. The enhancer shows its English prompt first — edit it or accept — then the engine renders.
5. The picture lands in the preview card. From there: download, send to a Codex entry, or regenerate with the other engine.

> Older pictures are in **Codex Gallery** at the bottom (filter by type, Refresh). The engine that drew each one is written under it.

### 🎬 Video

**Where:** 🏴 Miss Goldenweek. The step strip on the card shows where you are: ① Intent ② Brief ③ Style ④ Plan (free) ⑤ Render (paid) ⑥ Review.

1. **Intent**: the chips top right, **🖼 Image** · **🎬 Series ×10** · **🎞 One clip**. The engine row below switches to that family; the pick is remembered.
2. **Brief**: four fields, 📄 Context · 🎯 Goal · 📚 Source · ⭐ Expectations (Thai is fine); they become one prompt. **⇄ Free text** swaps them for a single box.
3. **Style**: one chip (pharmacy styles first, **Easy to see** for older patients, the six One Piece styles behind the **🏴‍☠️ One Piece** chip). The style text is appended to every prompt, with the 🛡️ Always added line (original characters, no logos); the pick is remembered.
4. **Plan** (free): the bottom-left rail is the text model (logo tabs pick the vendor, chips the version). Press **Plan 10 episodes** (or **Plan 1 clip**) → the **Episodes** card: EN/TH title, objective, key fact, one spoken line, one picture, Thai caption. ✏️ edits a row in place.
5. **Render** (paid): pick the engine chip (the 8-s price sits under the name): **Clip 9:16** Gemini Omni Flash ≈ $0.80 · **Veo Lite** ≈ $0.40 · **Kling** ≈ $1.01 · **HeyGen** ≈ $0.40 (avatar presenter) · **Seedance** ≈ $0.73. Then:
   - **▶** on one episode → the row asks **≈ $ · 8 s → Render**; confirm and it renders a 9:16 720p clip with audio.
   - **☑** several episodes → the bar shows the count and the total, **▶ Render n · one at a time**; one confirmation, the clips render one after another, **⏹ Stop after this one** stops.
   - Every finished clip saves itself: MP4 to Storage `teach-clips/{series}/EPnn.mp4` + the `clip_series` record, and it shows in **Codex Gallery → 🎬 Clips**. A failed upload → **💾 Save all (n)** in the bar.
6. **Review**: the clip plays in the card with EP, model, render time and cost: **⬇ Download** MP4 (720×1280) · **CC ไทย / 🔊 เสียงไทย** (see 🗣️ Thai clip below) · **🗑** deletes for good (asks first; the episode goes back to planned).

> You pay per clip that comes back; there is no unconfirmed "render all". Thai speech from the engines is still uneven, so make the Thai voice as in 🗣️ Thai clip below.

### 🗣️ Thai clip

**Where:** 🏴 Miss Goldenweek → the **Episodes** card after planning, and **Codex Gallery → 🎬 Clips → ▶**

Thai speech from the video engines is not reliable yet. The route that works: the engine draws the picture only, and the app lays Thai captions and a Thai voice from Gemini TTS on top (the clip's own sound is muted).

1. **Plan** gives every episode a one-line **Thai caption**. In the Episodes card press ✏️ and make it the sentence you want spoken. The counter under the field shows ≈ how many seconds the voice needs against the clip; if it says too long even at ×1.35, shorten it.
2. The **drug-name readings (voice only)** field: `Warfarin=วอร์ฟาริน, INR=ไอเอ็นอาร์`, comma-separated. Used only when the voice is made; the caption keeps the original spelling.
3. **▶ Render** with any engine (Veo Lite is cheapest, ≈ $0.40). Put "no on-screen text, no speech" in Expectations so the picture does not fight the captions and the voice.
4. In the clip card (or the gallery ▶ player): **CC ไทย** shows / hides the caption band · **🔊 เสียงไทย** makes the Gemini TTS voice and plays it in sync (the clip is muted); the status line shows the voice length and any speed-up · the **Kore / Charon / Achird** chips pick the voice (narrator / calm / friendly) and the pick is remembered.
5. **⬇ MP4 + ซับ + 🔊** saves a vertical MP4 with the captions and the Thai voice burned in (without 🔊 the button reads **⬇ MP4 + ซับ**); the file is `EPnn-th-voice.mp4`.

> TTS is billed per character, a few satang per clip. A voice is cached per voice × text, so switching chips does not pay twice. Listen to the three voices on one real sentence before doing a whole series.

### 🐳 Audio

**Where:** 🐳 Laboon — the podcast / voice studio ("Brook, Soul King").

1. **Step 1 · Transcript** — paste or type the script in the big box. **Polish** rewrites it with AI using the options under it: Target Length, Script Format (monologue / dialogue), Podcast Style, Summary Level. The dialogue template and the pronunciation helper (CMU phonemes for tricky English words) sit beside it.
2. **Config (right rail)** — 1. Model Selection (TTS backend and voice model), 2. Production Language, 3. Voice Rendering Mode, 4. Performance Direction (tone, pace, emphasis). On a phone this rail is a drawer.
3. **Step 3 · Produce** — Audio Encoding and Sample Rate, then **Generate**. The audio player appears under the script; **Send to Podcast** passes it on to the podcast flow, **Reset** clears the studio.

> Text-to-speech is billed per character on the chosen backend; a 5-minute script is a few cents. Thai voices: Cloud TTS and Gemini TTS both work; try a short line first.

### 🧭 Log Pose

**Where:** 🧭 Log Pose — a chat with the research model over the knowledge base.

- Type the question in **Query Brain** (same Context + Goal + Source + Expectations recipe) and press send; **Suggest Prompts** offers starting points.
- 📎 **Attach Image for Vision Analysis** sends a picture with the question (a slide, a label, a chart).
- **Focus on KB Only** in the sidebar keeps answers inside the uploaded documents; **Manage Documents** adds or removes them.
- **Clear Chat** starts over. Nothing here writes to the database — it is a scratchpad for preparing the images, clips and scripts above.
