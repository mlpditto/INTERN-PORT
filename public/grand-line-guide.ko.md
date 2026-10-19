# Grand Line Deck — 이미지·영상·오디오 만들기

탭 **AI Digital Lab** → 상단 세 모드: 🏴 Miss Goldenweek · 🧭 Research Log · 🐳 Laboon. 🏴‍☠️ 배지를 누르면 언제든 이 안내를 다시 엽니다.

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

**위치:** 🏴 Miss Goldenweek → engine 줄의 **Clip 9:16** 칩

1. 스타일을 고르고 Vision에 **시리즈 주제**를 씁니다 (예: 신규 환자 warfarin 상담).
2. **🎬 Clip 9:16** 클릭 → 버튼이 **Plan 10 episodes**로 바뀌고 시리즈 모드가 됩니다.
3. **Plan 10 episodes** — ✒ enhancer 모델(텍스트만, 영상 비용 없음)이 10개 에피소드를 계획: 영/태 제목, 학습 목표, 핵심 사실 1개, 대사 1줄, 그림 1장. **Episodes** 카드가 나타나고 ✏️로 행을 바로 수정합니다.
4. 한 에피소드의 **▶** — 먼저 비용 확인 **≈ $0.80 · 8 s**. Gemini Omni Flash가 세로 9:16 720p, 오디오 포함 클립을 렌더링합니다 (보통 1분 이내, 최대 12분).
5. 미리보기 카드에서 재생(EP 번호, 모델, 렌더 시간, 비용) 후 선택:
   - **⬇ Download** — MP4 (720×1280, H.264 + AAC)
   - **💾 Save** — 유일한 저장: Storage `teach-clips/{series}/EPnn.mp4` + `clip_series` 문서
   - **✕ Discard** — 아무것도 저장하지 않음
6. 다음 에피소드는 그 행의 ▶로. 일부러 "전체 렌더링"은 없습니다 — 클립마다 확인.

> Omni Flash의 태국어 음성 품질은 아직 검증 중 — 게시 전 들어보세요. 더 저렴한 engine(Veo 3.1 Lite ≈ $0.40/클립)은 proxy 수정이 먼저 필요합니다.

---

## 3. 🐳 오디오

**위치:** 🐳 Laboon — 팟캐스트/음성 스튜디오 ("Brook, Soul King")

1. **Step 1 · Transcript** — 큰 상자에 대본 입력. **Polish**가 AI로 다듬음: Target Length, Script Format(독백/대화), Podcast Style, Summary Level. 옆에 대화 템플릿과 발음 도우미(어려운 영어 단어의 CMU 음소).
2. **Config(오른쪽 레일)** — 1. Model Selection(TTS 백엔드·음성 모델) 2. Production Language 3. Voice Rendering Mode 4. Performance Direction(톤·속도·강조). 휴대폰에서는 드로어.
3. **Step 3 · Produce** — Audio Encoding, Sample Rate 선택 후 **Generate**. 대본 아래에 플레이어가 나타나고 **Send to Podcast**로 팟캐스트 흐름에 전달, **Reset**은 초기화.

> TTS는 백엔드별 글자 수 과금 — 5분 대본은 몇 센트. 태국어 음성은 Cloud TTS·Gemini TTS 모두 가능; 짧은 문장부터 시험하세요.

---

## 4. 🧭 Research Log

**위치:** 🧭 Research Log — 지식 베이스 위의 리서치 모델 채팅

- **Query Brain**에 질문(같은 Context + Goal + Source + Expectations 공식) 후 전송; **Suggest Prompts**가 시작점을 제안.
- 📎 **Attach Image for Vision Analysis** — 슬라이드·라벨·차트 이미지를 질문과 함께 전송.
- 사이드바 **Focus on KB Only**는 업로드 문서 안에서만 답하게 함; **Manage Documents**로 문서 추가/삭제.
- **Clear Chat**으로 새로 시작. 여기서는 DB에 쓰지 않음 — 위의 이미지·클립·대본을 준비하는 메모장.
