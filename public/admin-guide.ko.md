# 관리자 가이드 (Nika) — 처음 시작하기

페이지: https://mlpditto.github.io/INTERN-PORT/admin.html · 데스크톱과 휴대폰 모두 사용 가능 (탭 바는 옆으로 스크롤됩니다)

> 탭 단위 가이드 — 모든 버튼 이름은 실제 admin.html 화면에서 가져왔습니다 (헤더의 📖 버튼으로 이 가이드를 엽니다)

---

## 0. 🔑 로그인

**Admin Portal** 페이지에는 3가지 로그인 방법이 있습니다 — 하나만 사용하세요:

| 방법 | 사용법 |
|---|---|
| ✨ **Send Login Link** (권장) | 이메일 칸에 관리자 이메일이 미리 입력되어 있습니다 → 버튼을 누르고 → 메일을 열어 → 요청한 기기에서 링크를 누르세요 |
| **Google** | Google 버튼을 누르고 팝업에서 계정을 선택하세요 |
| **LINE** | LINE 버튼을 누르세요 (LINE 계정이 관리자 이메일에 연결되어 있을 때 작동) |

**알아두세요**
- 시스템은 **관리자 이메일 한 개만** 허용합니다 (코드에 설정됨). 다른 계정은 Google 로그인에 성공해도 `Access denied for …` 가 표시됩니다
- Firefox는 Google 팝업을 자주 차단합니다 → **Send Login Link** 를 사용하세요 (팝업이 차단되면 시스템이 이를 안내하고 링크 전송을 직접 시도합니다)
- 팝업을 중간에 닫았다면 → Google을 다시 누르면 됩니다

---

## 1. 🧭 헤더 (모든 탭의 맨 위)

| 버튼 | 기능 |
|---|---|
| ☀️ **Nika V…** | 페이지 이름 + 현재 실행 중인 버전 (이름 아래에 로그인한 이메일 표시) |
| ➕ **Create** | 새로 만들기 — **Task** (칸반 카드) · **Quest** (일일 퀘스트) · **Event** (공지) · **Article** (인턴이 앱을 열 때 뜨는 짧은 글) · **Quiz** · **Goals** · **Certificates** |
| 📥 **Archive** | 보관된 항목 보기 (Quests, Tasks 등) |
| 📱 **UI** | LINE 없이 인턴 화면 미리보기 (LIFF Preview) |
| 🔮 | AI Engine 설정 (키 / 모델) — "not loaded yet" 이라고 나오면 페이지를 새로고침하세요 |
| ⚓ | Grand Line Deck + Laugh Tale 의 One Piece 테마 켜기/끄기 |
| **EN** | 라벨 언어 — 누를 때마다 EN → KR → TH → K·T 순으로 바뀝니다 |
| 🌓 | 라이트 / 다크 모드 전환 |
| 👋 **Logout** | 로그아웃 |

---

## 2. 🗺️ 탭 지도 — 별명 → 실제 역할

| 탭 | 무엇인가 | 먼저 할 일 |
|---|---|---|
| 📊 **Dashboard** | 홈: 작업 대기열 + 칸반 + 통계 | 맨 위 칩 바의 숫자를 확인하세요 — 0이 아닌 칩은 처리할 일이 있다는 뜻입니다 |
| 📦 **Assignments** | Quiz, 시험, 맛집 리뷰 링크, 보상 상점 관리 | 탭의 **빨간 배지** = 검토 대기 중인 Quiz |
| 👥 **User Hub** | 인턴 목록, 점수, 순위, 그룹 | 인턴을 검색하면 기록과 점수를 볼 수 있습니다 |
| 🏴‍☠️ **Grand Line Deck** | 팀용 AI 도구 (채팅, 이미지 생성, Podcast Studio) | 필요할 때 사용 — 대기 중인 작업 없음 |
| 🏝️ **Laugh Tale** | 인턴의 **Reflections** 와 **Quiz feedback** 검토 | AI가 "Needs a fix" 로 표시한 피드백을 여세요 |
| 🏜️ **Alabasta** | **Case** (환자 사례)와 **Product** (제품 등록) 검토 대기열 | Pending 필터 → 하나씩 검토 |
| 🪨 **Poneglyph** | Codex (**Drug** / **Disease**), My Path, Memories | 인턴이 제출한 Drug/Disease 초안을 검토하세요 |

### 📊 Dashboard
- **맨 위 칩 바** (눌러서 목록 열기): 👤 Access (접근 요청) · 📖 Review (Reflective Review) · 💰 Claimed (요청된 포인트) · ⏱️ Quiz (대기 / 지연) · 💼 Work · 💊 Drug Drafts · 🩺 Disease Drafts · 📥 New Cases
- **칸반**: Backlog → 🚧 Doing → 👀 Review → ✅ Done (Tasks 검색; 오래된 항목은 Show archived)
- **🚀 Escalated**: 인턴이 특별 주의를 요청한 학습 노트 · **🗑️ Note deletion requests**: 노트 삭제 요청
- **AI usage · Overview**: AI 사용량 요약 + 히트맵 (눌러서 열기)
- **Quiz Coverage by System**: Quiz가 다루는 신체 계통
- **LINE pushes this month**: 이번 달 발송된 푸시 + **Preview digest** / **Send this now** / **Copy text** (메시지를 복사해 그룹에 직접 붙여넣기 = 푸시 횟수 소모 없음)

### 📦 Assignments (하위 탭 4개)
- 🧠 **Quiz Engine**: 칩으로 필터링하는 Quiz 목록 (GRADED · TEMPLATE · ONE-TIME · 🔒 LOCKED · 📎 MATERIALS · 🧪 NOT AUDITED · 🏷️ INCOMPLETE); 여러 개를 선택한 뒤 🚀 Activate · ⏹️ Deactivate · 📄 Export PDF · Merge · 🔍 Compare · 🏷️ AI tags · 🗑️ Delete · 🌐 Translate Missing 사용
- 🎓 **Exam**: 시간제 시험실 (Quiz + Host + 총 시간 선택; 상태 Lobby / Running / Paused)
- 🔗 **Gourmet World**: 맛집 리뷰 링크 (➕ Add Link, 🖼️ Fetch missing logos; 로고는 링크 / 업로드 / 🖼 Image link 에서 가져옴)
- 🏪 **A Shop for Killers**: Beri 보상 상점 — 이름, 링크, 로고, 유형, Beri Reward 설정

### 👥 User Hub
- 🏆 **Elite Board** (순위) · 검색창 · 📅 점수 기간 · 🏅 **Badge Stats** · 📤 순위 공유 · 🛡️ **Divisions & Groups** · 👥 **Entry** (사전 등록) · ⏳ 일일 체크인 누락으로 차감될 포인트 미리보기
- 인턴 한 명의 기록(드릴다운)을 열고 Q (Quiz) · W (Work) · L (Logs) · B (Bonus) · M (Manual) · 📍 Check-in · 🪙 Beri 로 필터링
- 🛡️ **Divisions & Groups** (툴바의 방패 버튼) — *group* 은 사람의 소속 팀이고, *division* 은 **함께 순위가 매겨지는** 사람들의 묶음이며 특별한 UI를 켤 수 있습니다 (**Content Creator** 라는 division 의 구성원은 Mission 대신 Content 카드를 받습니다). 사람의 division 은 **본인의 설정**(`users.division`)이므로 **같은 group 이름이 여러 division 에 있을 수 있습니다**. division 이 없는 사람은 **Only I** 에 속합니다 (자기 group 안에서만 순위). 이전에 만들어진 문서도 계속 작동합니다: division 이 설정되지 않았다면, 그 사람의 group 이 들어 있는 division 으로 간주됩니다.
  - Group **목록**은 **초안**입니다: 마음껏 추가 / 삭제할 수 있고 **Save** 를 누르기 전에는 아무것도 저장되지 않습니다 (목록이 달라졌을 때만 Save 바가 나타남. 예: "+ Audit in RSU"). Save 없이 닫으면 변경이 버려집니다. **사람 이동은 즉시 저장됩니다** (아래 참고).
  - 맨 위 줄은 **division 레일**입니다 (각각 고유 색, 그리고 **Only I**); 칩의 숫자는 활성 인원입니다. 하나를 누르면 아래에 그 group 들이 표시됩니다 (목록 + 소속 인원의 group). 맨 위 **검색**은 모든 division 을 한 번에 찾습니다; 다른 곳에 있는 group 을 입력하면 **＋ Add “X” to this division**, 완전히 새 이름이면 **＋ New group “X”** (division 목록에 유지되는 빈 group)가 나타납니다
  - **Division 만들기**: 레일 끝의 둥근 ＋ → 이름 입력 → ＋ (Save 후 사람을 옮길 수 있음) · **사람 이동**: group 칩을 누르면 그 아래에 **사람들**이 표시됩니다 (이름을 누르거나 **All**) → **Move N →** division 또는 **Only I** — 즉시 저장, group 이름은 유지 · **division 목록에서 group 제거**: ⊖ (아무도 없을 때만) · **Division 삭제**: 패널 제목 오른쪽의 ✕ (구성원은 Only I 로 돌아가며 아무것도 삭제되지 않음)
  - **Look (🎨)**: group (선택한 group 의 액션 바에 있는 🎨) 또는 division (제목의 ✕ 옆 🎨) 의 색 · 아이콘 · 사진. 선택은 즉시 저장되고, 해당 group / division 을 표시하는 모든 칩이 따라 바뀝니다 (Users 레일, User Hub, Elite Board, 행 태그). 사진은 아이콘 자리를 대신하며(원형), **↺ default** 는 기본 모양으로 되돌립니다.
  - **Memberships ("also")**: 한 사람은 하나의 division 에 **주 group 하나**(포인트, 순위, Quiz, 스트릭)를 가지며, 다른 division · group 쌍에 **추가로** 속할 수 있습니다 — User Hub group 행의 "also" 뒤 **＋** 를 누르면 같은 ① Division → ② Group 선택기가 열리고, 쌍은 흐린 **EXTERN | RSU** 칩으로 표시됩니다 (누르면 제거). 구성원은 그 division 에서 집계되고 (Users 레일, Divisions & Groups 의 점선 이름, Elite Board) 해당 업무를 볼 수 있지만, 그곳에서 옮겨지지는 않습니다 — 변경은 User Hub 에서 하세요.
  - ⚠️ 같은 바에서 아이콘(✏️ Rename · ⇄ Merge · 👁 Visibility · 🗑 Delete, ⚡ 표시)은 **group 자체**에 작용하며 Save 가 아니라 **즉시 적용**됩니다 — Delete 는 모든 곳에서 group 을 제거합니다
  - 칩의 숫자는 활성 인원만 센 것입니다 (숨김 / 미등록 제외) · 코드가 특별 취급하는 division 이름: **Content Creator** (또는 예전 이름 CAFE)

### 🏝️ Laugh Tale
- 📓 **Reflections** (성찰 노트)와 🧠 **Quiz** (Quiz 피드백)에는 각각 **Needs a fix · Analysis · Patterns · Comments** 탭이 있습니다
- 분석에 사용할 AI 모델은 제공업체 로고 칩으로 선택합니다
- 👒 **Straw Hat Mode**: 인턴 신원 숨기기 / 보이기 · 📐 LP Taxonomy 편집 · 여러 개 선택 후 🗑 Delete selected

### 🏜️ Alabasta
- 🩺 **Case** / 🛒 **Product** 전환 · 칩 All / 📥 Pending / ✅ Reviewed / ❌ Rejected · 기간 · 🔎 검색 · ⬇️ CSV
- **Case 반려**: 사유를 선택하세요 (데이터 불완전 · 중복 · 관련 없음 · 기타) — 인턴은 자기 기록에서 그 사유를 봅니다
- 여러 개 선택 → ✅ Bulk Review / 🗑️ Bulk Delete
- **⋯** 메뉴: ⚙️ Edit Case Taxonomy · 🔧 **Sync intern view** (검토된 case/work 를 동기화해 인턴이 볼 수 있게 함) · 🔎 Scan orphan history (검색만 하며 삭제하지 않음)

### 🪨 Poneglyph
- 💊 **Drug Codex** · 🩺 **Disease Codex** (데이터 편집, 다운로드 파일 링크 첨부) · **My Path** (관리자 본인의 학습 노트 + 🧭 AI Learning Path) · 🎟️ **Memories** (완료한 활동과 스탬프)
- 📊 **Monitor: Intern Learning Paths** 에서 인턴의 LP 노트를 확인 · 🗑️ Trash
- 인턴의 노트를 수정 / 삭제하려면 감사 로그를 남기기 위해 **사유**가 필요합니다 (삭제는 소프트 삭제 — Trash 에서 복구 가능)

---

## 3. 📅 하루 루틴 (순서 예시)

1. **Dashboard** 를 열고 → 맨 위 칩을 확인합니다. 0이 아닌 칩은 처리할 대기열입니다
2. 📦 **Assignments** 의 빨간 배지를 확인 → 대기 중인 Quiz 를 검토합니다
3. **Alabasta** → Pending 필터 → Case / Product 를 검토합니다
4. **Laugh Tale** → Quiz 피드백의 "Needs a fix" 를 확인합니다

---

## 4. ⚠️ 주의

- **모든 작업은 실제 데이터(운영 환경)에 기록됩니다** — 내 컴퓨터(localhost)에서 이 페이지를 열어도 마찬가지입니다. 테스트 모드는 없습니다
- **Delete / Bulk Delete / Archive** 는 일부 항목에서 되돌릴 수 없습니다 — 확인하기 전에 선택 항목을 점검하세요
- **Send this now** (Dashboard)는 그룹에 실제 LINE 메시지를 보냅니다. 문구만 필요하면 **Copy text** 를 사용하세요
- Case 를 검토 / 반려했는데 인턴에게 예전 상태가 보인다면 Alabasta → ⋯ → 🔧 Sync intern view 를 시도해 보세요

## 5. 🔧 문제 해결

| 증상 | 해결 방법 |
|---|---|
| `Access denied for …` | 지정된 관리자 계정으로만 로그인하세요 |
| Google 팝업이 나타나지 않음 | ✨ Send Login Link 를 사용하세요 (특히 Firefox) |
| 일부 버튼을 누르면 `Admin required` | 로그아웃 → 다시 로그인 → 그래도 표시되면 시스템 소유자에게 알려 주세요 (계정에 서버 측 권한이 아직 없음) |
| 🔮 버튼에 "not loaded yet" 표시 | 페이지를 새로고침하세요 |
| 숫자 / 목록이 오래되어 보임 | 새로고침(Ctrl+F5) — 버전이 바뀐 뒤 브라우저가 예전 파일을 쓸 수 있습니다. Nika 이름 옆의 버전 번호를 확인하세요 |
