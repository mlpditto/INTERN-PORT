# Grand Line Deck — 이미지·영상·오디오 만들기

탭 **🏴‍☠️ Grand Line Deck** → 상단 세 모드: 🏴 Miss Goldenweek · 🧭 Log Pose · 🐳 Laboon. 세 모드 왼쪽의 📖 를 누르면 언제든 이 안내를 다시 엽니다.

---

## 1. 🖼 이미지

**위치:** 🏴 Miss Goldenweek

1. 왼쪽 **Visual Style Collection**에서 스타일 선택 (Pirate Crew Life, Jolly Roger Vector, 3D Devil Fruit, Grand Line Map, Oda Manga Style, Wano Arc Anime). 모든 프롬프트에 적용됩니다.
2. **🪄 Vision** 상자에 그림을 설명 — 제목 옆 공식 *Context + Goal + Source + Expectations*. 태국어도 됩니다.
3. 상자 아래 툴바의 ✒ 은 **enhancer 모델**(글을 구조화된 영어 프롬프트로 바꿈; 로고 탭 = 제공사, 칩 = 모델). **engine** 선택: **Nano Banana 2.1**(Google, 가장 저렴, 도표·인포그래픽에 적합) 또는 **Image 2**(OpenAI, 글자에 강함).
4. **✨ Create** — enhancer가 영어 프롬프트를 먼저 보여주고(수정/확인) engine이 렌더링합니다.
5. 결과는 미리보기 카드에: 다운로드, Codex로 보내기, 다른 engine으로 다시 생성.

> 지난 이미지는 아래 **Codex Gallery**(종류 필터, Refresh). 각 이미지 아래에 그린 engine이 표시됩니다.

---

## 2. 🎬 영상

**위치:** 🏴 Miss Goldenweek. 카드 위 단계 띠가 현재 위치를 보여줍니다: ① Intent ② Brief ③ Style ④ Plan (free) ⑤ Render (paid) ⑥ Review.

1. **Intent**: 오른쪽 위 칩 **🖼 Image** · **🎬 Series ×10** · **🎞 One clip**. 아래 engine 줄이 그 계열로 바뀌고 선택은 기억됩니다.
2. **Brief**: 네 칸 📄 Context · 🎯 Goal · 📚 Source · ⭐ Expectations (태국어 가능); 한 프롬프트로 합쳐집니다. **⇄ Free text**로 한 칸 입력으로 전환.
3. **Style**: 칩 하나 (약국 스타일 먼저, 고령 환자용 **Easy to see**, One Piece 여섯 스타일은 **🏴‍☠️ One Piece** 칩 뒤에). 스타일 문구가 모든 프롬프트 끝에 붙고 🛡️ Always added 줄(원작 캐릭터, 로고 없음)도 함께; 선택은 기억됩니다.
4. **Plan** (free): 왼쪽 아래 줄이 텍스트 모델(로고 탭 = 회사, 칩 = 버전). **Plan 10 episodes** (또는 **Plan 1 clip**) → **Episodes** 카드: 영/태 제목, 목표, 핵심 사실, 대사 1줄, 그림 1장, 태국어 자막. ✏️로 행을 바로 수정합니다.
5. **Render** (paid): engine 칩 선택(이름 아래 8초 가격): **Clip 9:16** Gemini Omni Flash ≈ $0.80 · **Veo Lite** ≈ $0.40 · **Kling** ≈ $1.01 · **HeyGen** ≈ $0.40 (아바타 진행자) · **Seedance** ≈ $0.73. 그다음:
   - 에피소드 하나의 **▶** → 그 행에서 **≈ $ · 8 s → Render** 확인 후 9:16 720p 오디오 포함 클립을 렌더링.
   - 여러 에피소드 **☑** → 바에 개수와 합계, **▶ Render n · one at a time**; 확인 한 번, 클립을 차례로 렌더링, **⏹ Stop after this one**으로 중단.
   - 끝난 클립은 자동 저장: Storage `teach-clips/{series}/EPnn.mp4` + `clip_series` 문서, **Codex Gallery → 🎬 Clips**에 표시. 업로드 실패 → 바의 **💾 Save all (n)**.
6. **Review**: 카드에서 재생(EP, 모델, 렌더 시간, 비용): **⬇ Download** MP4 (720×1280) · **CC ไทย / 🔊 เสียงไทย** (3절) · **🗑** 영구 삭제(먼저 확인; 에피소드는 planned로).

> 돌아온 클립마다 과금; 확인 없는 "전체 렌더링"은 없습니다. engine의 태국어 음성은 아직 고르지 않으니 태국어 음성은 3절대로 만드세요.

---

## 3. 🗣️ 태국어 클립

**위치:** 🏴 Miss Goldenweek → 계획 후 **Episodes** 카드, 그리고 **Codex Gallery → 🎬 Clips → ▶**

영상 engine의 태국어 음성은 아직 믿기 어렵습니다. 실제 쓰는 방법: engine은 그림만 그리고, 앱이 태국어 자막과 Gemini TTS 태국어 음성을 위에 얹습니다 (클립 자체 소리는 음소거).

1. **Plan**은 에피소드마다 한 줄 **태국어 자막**을 줍니다. Episodes 카드에서 ✏️로 말하게 하고 싶은 문장으로 고칩니다. 입력란 아래 카운터가 음성 길이 ≈ 초를 클립과 비교해 보여줍니다. ×1.35로 빨리 해도 길다고 하면 줄이세요.
2. **약 이름 읽기(음성 전용)** 란: `Warfarin=วอร์ฟาริน, INR=ไอเอ็นอาร์`, 쉼표 구분. 음성을 만들 때만 쓰고 자막 철자는 그대로입니다.
3. 아무 engine으로 **▶ Render** (Veo Lite가 가장 저렴, ≈ $0.40). Expectations에 "no on-screen text, no speech"를 넣어 그림이 자막·음성과 겹치지 않게 합니다.
4. 클립 카드(또는 갤러리 ▶ 플레이어)에서: **CC ไทย** 자막 띠 켜기/끄기 · **🔊 เสียงไทย** Gemini TTS 음성을 만들어 클립과 맞춰 재생(클립은 음소거); 상태 줄에 음성 길이와 가속 배율 · **Kore / Charon / Achird** 칩으로 목소리 선택(내레이터 / 차분 / 친근), 선택은 기억됩니다.
5. **⬇ MP4 + ซับ + 🔊** — 자막과 태국어 음성을 입힌 세로 MP4 저장(🔊 없이면 버튼은 **⬇ MP4 + ซับ**); 파일명 `EPnn-th-voice.mp4`.

> TTS는 글자당 과금, 클립당 몇 사땅. 음성은 목소리×문장별로 캐시되어 칩을 바꿔도 두 번 내지 않습니다. 시리즈 전체 전에 실제 문장 하나로 세 목소리를 들어보세요.

---

## 4. 🐳 오디오

**위치:** 🐳 Laboon — 팟캐스트/음성 스튜디오 ("Brook, Soul King")

1. **Step 1 · Transcript** — 큰 상자에 대본 입력. **Polish**가 AI로 다듬음: Target Length, Script Format(독백/대화), Podcast Style, Summary Level. 옆에 대화 템플릿과 발음 도우미(어려운 영어 단어의 CMU 음소).
2. **Config(오른쪽 레일)** — 1. Model Selection(TTS 백엔드·음성 모델) 2. Production Language 3. Voice Rendering Mode 4. Performance Direction(톤·속도·강조). 휴대폰에서는 드로어.
3. **Step 3 · Produce** — Audio Encoding, Sample Rate 선택 후 **Generate**. 대본 아래에 플레이어가 나타나고 **Send to Podcast**로 팟캐스트 흐름에 전달, **Reset**은 초기화.

> TTS는 백엔드별 글자 수 과금 — 5분 대본은 몇 센트. 태국어 음성은 Cloud TTS·Gemini TTS 모두 가능; 짧은 문장부터 시험하세요.

---

## 5. 🧭 Log Pose

**위치:** 🧭 Log Pose — 지식 베이스 위의 리서치 모델 채팅

- **Query Brain**에 질문(같은 Context + Goal + Source + Expectations 공식) 후 전송; **Suggest Prompts**가 시작점을 제안.
- 📎 **Attach Image for Vision Analysis** — 슬라이드·라벨·차트 이미지를 질문과 함께 전송.
- 사이드바 **Focus on KB Only**는 업로드 문서 안에서만 답하게 함; **Manage Documents**로 문서 추가/삭제.
- **Clear Chat**으로 새로 시작. 여기서는 DB에 쓰지 않음 — 위의 이미지·클립·대본을 준비하는 메모장.
