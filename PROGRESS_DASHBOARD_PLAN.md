# 📊 Progress Dashboard "My Journey" - Implementation Plan

> **Phase 1: Audit & Design**  
> Created: 2026-04-25  
> Target: Complete visual KPI dashboard for interns

---

## 🔍 **Phase 1.1 - Firestore Collections Audit**

### Available Data Collections:

| Collection | Key Fields | Use for Dashboard |
|------------|------------|-------------------|
| **users** | `score`, `startDate`, `endDate`, `firstName`, `lastName`, `displayName`, `lastSeen`, `certRequested` | Profile info, total score, internship dates |
| **quiz_attempts** | `quizId`, `userId`, `score`, `status`, `timestamp`, `startTime` | Quiz performance, pass rate, completion time |
| **quizzes** | `title`, `points`, `deadline`, `isActive`, `questions` | Quiz metadata, deadlines, total available points |
| **reflective_logs** | `mood`, `timestamp`, `adminComment`, `adminBonus`, `isArchived` | Reflection frequency, mood trends, admin feedback |
| **cases** | `timestamp`, `status`, `adminScore`, `tags` | Case submissions count, review status |
| **works** | `timestamp`, `status`, `tags`, `adminScore` | Work submissions, project completion |
| **quests** | `title`, `deadline`, `priority`, `status` | Available quests, deadlines |
| **quest_submissions** | `questId`, `userId`, `timestamp`, `status` | Quest completion tracking |

---

## 🎨 **Phase 1.2 - Card Layout Design**

### Visual Hierarchy (Mobile-First):
```
┌─────────────────────────────┐
│ 🎯 My Journey - [User Name] │
├─────────────────────────────┤
│ 📅 Internship Progress      │ <- Hero Card (Large)
│    ████████░░ 80% (48/60d)  │
├─────────────────────────────┤
│ 🏆 Score & Rank             │ <- Medium Card
│    1,250 pts | #3 of 12     │
├─────────────────────────────┤
│ 📚 Quiz Performance         │ <- Medium Card  
│    85% pass rate (17/20)    │
├─────────────────────────────┤
│ 📝 Reflection Streak        │ <- Small Card
│    🔥 7 days in a row       │
├─────────────────────────────┤
│ 🎯 Quest Completion         │ <- Small Card
│    ⚡ 12/15 completed        │
├─────────────────────────────┤
│ 📋 Cases & Works            │ <- Small Card
│    📁 8 cases, 3 projects   │
└─────────────────────────────┘
```

### Card Types & Sizes:
- **Hero Card** (Full width): Internship Progress Timeline
- **Medium Cards** (Half width): Score/Rank, Quiz Performance  
- **Small Cards** (Quarter width): Streaks, Counts, Status

---

## 📱 **Phase 1.3 - LIFF Interface Placement**

### Recommended Location: **New Tab in Main Navigation**

Current LIFF Navigation:
```
[🏠 Home] [📋 Missions] [📚 Learn] [🎯 Quiz] [👤 Profile]
```

**Proposed New Navigation:**
```
[🏠 Home] [📊 Journey] [📋 Missions] [📚 Learn] [🎯 Quiz] [👤 Profile]
```

### Alternative: **Enhanced Profile Tab**
- Add "My Journey" section as expandable area in existing Profile tab
- Less navigation overhead, but more crowded

**Recommendation:** New dedicated "📊 Journey" tab for maximum visibility

---

## 📈 **Phase 1.4 - Metrics & Color Thresholds**

### Metric Definitions:

| Metric | Formula | Green | Yellow | Red |
|--------|---------|-------|--------|-----|
| **Internship Progress** | `(days_passed / total_days) * 100` | ≥60% | 30-59% | <30% |
| **Quiz Pass Rate** | `(passed_quizzes / total_attempts) * 100` | ≥80% | 60-79% | <60% |
| **Reflection Streak** | `consecutive_days_with_reflection` | ≥7 days | 3-6 days | <3 days |
| **Quest Completion** | `(completed_quests / assigned_quests) * 100` | ≥80% | 60-79% | <60% |
| **Score Ranking** | `user_score / cohort_top_score` | Top 25% | 25-75% | Bottom 25% |

### Color System:
- **🟢 Green**: `#10b981` (Excellent)
- **🟡 Yellow**: `#f59e0b` (Good/Warning)  
- **🔴 Red**: `#ef4444` (Needs Attention)
- **🔵 Blue**: `#3b82f6` (Neutral/Info)

---

## 🗂️ **Phase 1.5 - Card Specifications & Data Map**

### Card 1: Internship Progress (Hero)
```javascript
// Data Query
const startDate = userDoc.startDate;
const endDate = userDoc.endDate;
const today = new Date();
const totalDays = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));
const daysPassed = Math.ceil((today - startDate) / (1000 * 60 * 60 * 24));
const progress = Math.min(100, Math.max(0, (daysPassed / totalDays) * 100));

// Visual Elements
- Progress bar with percentage
- Days remaining counter
- Status badge: "On Track", "Behind", "Completed"
```

### Card 2: Score & Rank
```javascript
// Data Query
const userScore = userDoc.score || 0;
const allUsers = await db.collection("users").orderBy("score", "desc").get();
const userRank = allUsers.docs.findIndex(doc => doc.id === userId) + 1;
const totalUsers = allUsers.docs.length;
const percentile = ((totalUsers - userRank) / totalUsers) * 100;

// Visual Elements  
- Large score display with trend arrow
- Rank badge: "🥇 Top 10%", "🥈 Good", "🥉 Keep Going"
- Comparison to cohort average
```

### Card 3: Quiz Performance
```javascript
// Data Query
const quizAttempts = await db.collection("quiz_attempts").where("userId", "==", userId).get();
const passedQuizzes = quizAttempts.filter(doc => doc.data().score >= 70).length;
const totalQuizzes = quizAttempts.length;
const passRate = totalQuizzes > 0 ? (passedQuizzes / totalQuizzes) * 100 : 0;

// Visual Elements
- Circular progress indicator
- "X/Y quizzes passed" text
- Average score display
```

### Card 4: Reflection Streak
```javascript
// Data Query
const reflections = await db.collection("reflective_logs")
    .where("userId", "==", userId)
    .orderBy("timestamp", "desc")
    .limit(30) // Last 30 days
    .get();

// Calculate streak
const streak = calculateConsecutiveDays(reflections);

// Visual Elements
- Fire emoji with streak number
- "Keep it up!" or "Time to reflect" message
- Last reflection date
```

### Card 5: Quest Completion
```javascript
// Data Query
const quests = await db.collection("quests").get();
const submissions = await db.collection("quest_submissions").where("userId", "==", userId).get();
const completedCount = submissions.filter(doc => doc.data().status === "approved").length;
const totalCount = quests.filter(q => q.deadline > new Date()).length;

// Visual Elements
- Progress bar
- "X/Y quests completed"
- Next quest deadline
```

### Card 6: Cases & Works
```javascript
// Data Query
const cases = await db.collection("cases").where("userId", "==", userId).get();
const works = await db.collection("works").where("userId", "==", userId).get();
const pendingCases = cases.filter(doc => !doc.data().adminScore).length;
const pendingWorks = works.filter(doc => !doc.data().adminScore).length;

// Visual Elements
- Icon-based display: 📁 Cases, 🎨 Projects
- Pending review indicator
- Total submissions count
```

---

## 🚀 **Implementation Dependencies**

### Technical Requirements:
1. **Firestore Query Optimization** - Use composite indexes for complex queries
2. **Real-time Updates** - Leverage existing `onSnapshot` listeners
3. **Caching Strategy** - Cache calculations to avoid repeated queries
4. **Responsive Design** - Mobile-first CSS Grid/Flexbox layout

### Integration Points:
- **LIFF Navigation** - Add new tab to existing navigation system
- **User Profile Data** - Extend existing `userProfile` object
- **Theme System** - Follow existing CSS variable patterns
- **Loading States** - Use existing `updateStatus()` pattern

---

## 📋 **Next Steps (Phase 2)**

1. **Create HTML Structure** - Build card grid layout
2. **Implement Data Queries** - Write efficient Firestore queries  
3. **Add Visual Components** - Progress bars, charts, badges
4. **Integrate Navigation** - Add Journey tab to LIFF
5. **Test & Iterate** - User testing with actual interns

---

## 🎯 **Success Metrics**

- **Engagement**: Interns visit Journey tab ≥3x/week
- **Clarity**: Users can understand their progress in <10 seconds  
- **Motivation**: Reflection completion rate increases by 20%
- **Performance**: Page loads in <2 seconds on mobile

---

*Ready for Phase 2 implementation?* 🚀
