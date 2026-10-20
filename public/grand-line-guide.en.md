# Grand Line Deck — how to make images, video and audio

Tab: **🏴‍☠️ Grand Line Deck** → the three modes at the top: 🏴 Miss Goldenweek · 🧭 Research Log · 🐳 Laboon. Click 📖 (left of the three modes) any time to reopen this guide.

---

## 1. 🖼 Images

**Where:** 🏴 Miss Goldenweek.

1. Pick a look in **Visual Style Collection** on the left (Pirate Crew Life, Jolly Roger Vector, 3D Devil Fruit, Grand Line Map, Oda Manga Style, Wano Arc Anime). The style is added to every prompt.
2. Describe the picture in **🪄 Vision** — the formula beside the title is the recipe: *Context + Goal + Source + Expectations*. Thai is fine.
3. On the toolbar under the box, ✒ is the **enhancer model** (it rewrites your text into a structured English prompt; the logo tabs pick the provider, the chips the model). Pick the **engine**: **Nano Banana 2.1** (Google, cheapest, good for diagrams and infographics) or **Image 2** (OpenAI, strongest on text).
4. Press **✨ Create**. The enhancer shows its English prompt first — edit it or accept — then the engine renders.
5. The picture lands in the preview card. From there: download, send to a Codex entry, or regenerate with the other engine.

> Older pictures are in **Codex Gallery** at the bottom (filter by type, Refresh). The engine that drew each one is written under it.

---

## 2. 🎬 Video

**Where:** 🏴 Miss Goldenweek → the **Clip 9:16** chip in the engine row.

1. Pick a style and write the **series topic** in Vision (e.g. "warfarin counselling for new patients", Thai is fine).
2. Click **🎬 Clip 9:16**. The button becomes **Plan 10 episodes** and the box switches to series mode.
3. Press **Plan 10 episodes**. The ✒ enhancer model (text only, no video cost) plans 10 clips: English / Thai title, learning objective, the one key fact, one spoken line, one picture. The **Episodes** card appears; ✏️ edits any row in place.
4. Press **▶** on one episode. A cost line asks first — **≈ $0.80 · 8 s** — confirm it. Gemini Omni Flash renders a vertical 9:16, 720p clip with audio; a timer shows the wait (usually under a minute, up to 12 are allowed).
5. The clip plays in the preview card with EP number, model, render time and cost. Then choose:
   - **⬇ Download** — the MP4 (720×1280, H.264 + AAC).
   - **💾 Save** — the only write: MP4 to Storage `teach-clips/{series}/EPnn.mp4` plus the series record in `clip_series`.
   - **✕ Discard** — nothing is kept.
6. Render the next episode with its own ▶. There is no "render all" on purpose — one confirmation per clip.

> Thai speech quality of Omni Flash is still being judged; listen before publishing. A cheaper engine (Veo 3.1 Lite ≈ $0.40 / clip) needs a proxy change first.

---

## 3. 🐳 Audio

**Where:** 🐳 Laboon — the podcast / voice studio ("Brook, Soul King").

1. **Step 1 · Transcript** — paste or type the script in the big box. **Polish** rewrites it with AI using the options under it: Target Length, Script Format (monologue / dialogue), Podcast Style, Summary Level. The dialogue template and the pronunciation helper (CMU phonemes for tricky English words) sit beside it.
2. **Config (right rail)** — 1. Model Selection (TTS backend and voice model), 2. Production Language, 3. Voice Rendering Mode, 4. Performance Direction (tone, pace, emphasis). On a phone this rail is a drawer.
3. **Step 3 · Produce** — Audio Encoding and Sample Rate, then **Generate**. The audio player appears under the script; **Send to Podcast** passes it on to the podcast flow, **Reset** clears the studio.

> Text-to-speech is billed per character on the chosen backend; a 5-minute script is a few cents. Thai voices: Cloud TTS and Gemini TTS both work; try a short line first.

---

## 4. 🧭 Research Log

**Where:** 🧭 Research Log — a chat with the research model over the knowledge base.

- Type the question in **Query Brain** (same Context + Goal + Source + Expectations recipe) and press send; **Suggest Prompts** offers starting points.
- 📎 **Attach Image for Vision Analysis** sends a picture with the question (a slide, a label, a chart).
- **Focus on KB Only** in the sidebar keeps answers inside the uploaded documents; **Manage Documents** adds or removes them.
- **Clear Chat** starts over. Nothing here writes to the database — it is a scratchpad for preparing the images, clips and scripts above.
