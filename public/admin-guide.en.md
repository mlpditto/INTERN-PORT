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
| ➕ **Create** | Make something new — **Task** (Kanban card) · **Quest** (daily quest) · **Event** (announcement) · **Quiz** · **Goals** · **Certificates** |
| 📥 **Archive** | See archived items (Quests, Tasks, etc.) |
| 📱 **UI** | Preview the intern's screen (LIFF Preview) without LINE |
| 🔮 | AI Engine settings (keys / models) — if it says "not loaded yet", refresh the page |
| ⚓ | Toggle the One Piece theme for AI Digital Lab + Laugh Tale |
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
| 🤖 **AI Digital Lab** | AI tools for the team (chat, image generation, Podcast Studio) | Use when needed — nothing waiting here |
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
- 🏆 **Elite Board** (ranking) · search box · 📅 score date range · 🏅 **Badge Stats** · 📤 share ranking · 🛡️ **Groups & Divisions** · 👥 **Entry** (pre-registration) · ⏳ preview of the points deducted for missed daily check-ins
- Open one intern's history (drill-down) and filter by Q (Quiz) · W (Work) · L (Logs) · B (Bonus) · M (Manual) · 📍 Check-in · 🪙 Beri

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
