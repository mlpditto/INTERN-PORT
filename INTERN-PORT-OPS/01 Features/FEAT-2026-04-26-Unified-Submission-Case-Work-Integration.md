# Unified Submission Model Implementation Plan
## Case 케이스 / Work 워크 Integration

---

## 📋 Overview

This document outlines the implementation of a unified submission system that merges **Case 케이스** and **Work 워크** into a single, scalable architecture while maintaining backward compatibility.

---

## 🎯 Goals

1. ✅ Unified data model for all submission types
2. ✅ Preserve Korean characters (케이스/워크) in UI
3. ✅ Backward compatibility with existing collections
4. ✅ Enhanced scoring and analytics
5. ✅ Better user experience with unified history view

---

## 🏗️ Architecture

### New Data Model: `submissions` Collection

```javascript
{
  // Core Fields
  id: string,                    // Auto-generated
  submissionType: 'case' | 'work' | 'quiz' | 'quest' | 'reflective',
  userId: string,                // User identifier
  authUid: string,               // Firebase auth UID
  displayName: string,           // User display name
  pictureUrl: string,            // User profile picture
  
  // Common Fields
  title: string,                 // Display title
  description: string,           // Main content/description
  status: 'pending' | 'reviewed' | 'approved' | 'rejected',
  score: number,                 // Assigned score
  adminComment: string,          // Admin feedback
  adminReviewedBy: string,       // Admin who reviewed
  adminUpdatedAt: timestamp,     // When admin reviewed
  adminBonus: number,            // Bonus points from admin
  
  // Type-Specific Metadata
  metadata: {
    // For 'case' type
    caseId?: string,             // HN / Case number
    customer?: string,           // Patient name
    disease?: string,            // Disease description
    diseaseSystemKey?: string,   // System category key
    diseaseSystemLabel?: string, // System category label
    symptomTags?: string[],      // Selected symptoms
    
    // For 'work' type
    link?: string,               // Work submission link
    
    // For all types
    sourceType?: string,         // Original collection (for migration)
    sourceId?: string,           // Original document ID
  },
  
  // Timestamps
  timestamp: timestamp,          // Created at
  updatedAt: timestamp,          // Last updated
  
  // Gamification
  pointsAwarded: boolean,        // Whether points were awarded
  pointsAmount: number,          // Points given for this submission
}
```

---

## 📊 Migration Strategy

### Phase 1: Dual-Write System (Week 1-2)

**Approach**: Write to both old and new collections simultaneously

```javascript
// Enhanced submitCase() function
async function submitCase(formData) {
  const authUser = await ensureFirebaseAuthReady();
  
  const caseData = {
    authUid: authUser.uid,
    userId,
    displayName: userProfile.displayName,
    pictureUrl: userProfile.pictureUrl || "",
    caseId: formData.caseId,
    customer: formData.customer,
    disease: formData.disease,
    diseaseSystemKey: formData.systemKey,
    diseaseSystemLabel: formData.systemLabel,
    symptomTags: formData.symptomTags,
    note: formData.note,
    status: "pending",
    timestamp: firebase.firestore.FieldValue.serverTimestamp()
  };
  
  // 1. Write to legacy collection (backward compatibility)
  const legacyRef = await db.collection("cases").add(caseData);
  
  // 2. Write to new unified collection
  const unifiedData = {
    submissionType: 'case',
    ...caseData,
    title: `${formData.caseId} - ${formData.disease}`,
    description: formData.note,
    metadata: {
      caseId: formData.caseId,
      customer: formData.customer,
      disease: formData.disease,
      diseaseSystemKey: formData.systemKey,
      diseaseSystemLabel: formData.systemLabel,
      symptomTags: formData.symptomTags,
      sourceType: 'cases',
      sourceId: legacyRef.id
    },
    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    pointsAwarded: false,
    pointsAmount: 0.01 // Auto bonus
  };
  
  await db.collection("submissions").add(unifiedData);
  
  return { legacyId: legacyRef.id, unified: true };
}

// Enhanced submitWork() function
async function submitWork(formData) {
  const workData = {
    userId,
    displayName: userProfile.displayName,
    pictureUrl: userProfile.pictureUrl || "",
    title: formData.title,
    link: formData.link,
    status: "รอตรวจ",
    score: 0,
    timestamp: firebase.firestore.FieldValue.serverTimestamp()
  };
  
  // 1. Write to legacy collection
  const legacyRef = await db.collection("works").add(workData);
  
  // 2. Write to new unified collection
  const unifiedData = {
    submissionType: 'work',
    ...workData,
    description: formData.link,
    metadata: {
      link: formData.link,
      sourceType: 'works',
      sourceId: legacyRef.id
    },
    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    pointsAwarded: false,
    pointsAmount: 0
  };
  
  await db.collection("submissions").add(unifiedData);
  
  return { legacyId: legacyRef.id, unified: true };
}
```

### Phase 2: Unified History View (Week 2-3)

```javascript
// Unified history loader
let unifiedSubmissionsCache = [];

function loadUnifiedSubmissions() {
  ensureFirebaseAuthReady().then((authUser) => {
    if (!authUser) return;
    
    // Listen to unified submissions
    db.collection("submissions")
      .where("userId", "==", userId)
      .orderBy("timestamp", "desc")
      .onSnapshot(snapshot => {
        unifiedSubmissionsCache = snapshot.docs.map(d => ({
          id: d.id,
          ...d.data()
        }));
        renderUnifiedHistory();
        updateGrandLineDashboard();
      }, error => {
        console.error("Error loading unified submissions:", error);
        // Fallback to legacy system
        loadMyCases();
        loadMyWorks();
      });
  });
}

// Unified history renderer
function renderUnifiedHistory() {
  const container = document.getElementById('unified-history-list');
  if (!container) return;
  
  const items = unifiedSubmissionsCache.map(sub => {
    const baseItem = {
      id: sub.id,
      timestamp: sub.timestamp,
      status: sub.status,
      score: sub.score || 0,
      adminComment: sub.adminComment,
      adminBonus: sub.adminBonus || 0
    };
    
    // Type-specific rendering
    switch (sub.submissionType) {
      case 'case':
        return {
          ...baseItem,
          title: `🏥 ${sub.metadata.caseId} - ${sub.metadata.disease}`,
          type: 'Case 케이스',
          icon: 'fa-notes-medical',
          color: '#ef233c',
          link: null,
          detail: sub.metadata.customer || 'No patient name'
        };
      
      case 'work':
        return {
          ...baseItem,
          title: `📝 ${sub.title}`,
          type: 'Work 워크',
          icon: 'fa-file-lines',
          color: '#4361ee',
          link: sub.metadata.link,
          detail: 'General work submission'
        };
      
      case 'quiz':
        return {
          ...baseItem,
          title: `🧠 ${sub.title}`,
          type: 'Quiz ควิซ',
          icon: 'fa-brain',
          color: '#8e44ad',
          link: null,
          detail: `Score: ${sub.score}`
        };
      
      default:
        return {
          ...baseItem,
          title: sub.title,
          type: sub.submissionType,
          icon: 'fa-file',
          color: '#6c757d',
          link: null,
          detail: ''
        };
    }
  });
  
  // Sort by timestamp (newest first)
  items.sort((a, b) => {
    const tA = a.timestamp ? a.timestamp.toDate().getTime() : 0;
    const tB = b.timestamp ? b.timestamp.toDate().getTime() : 0;
    return tB - tA;
  });
  
  // Render items
  if (items.length === 0) {
    container.innerHTML = `
      <div style="text-align:center; color:#999; padding:40px 20px;">
        <i class="fa-solid fa-inbox" style="font-size:3em; margin-bottom:15px; opacity:0.3;"></i>
        <p>ยังไม่มีประวัติการส่งงาน</p>
        <p style="font-size:0.85em; opacity:0.7;">No submissions yet</p>
      </div>`;
    return;
  }
  
  container.innerHTML = items.map(item => {
    const date = item.timestamp ? item.timestamp.toDate().toLocaleString('th-TH', {
      day: 'numeric', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    }) : '-';
    
    const isPending = item.status === 'pending' || item.status === 'รอตรวจ';
    const statusBadge = isPending
      ? `<span class="badge" style="background:#fff3cd; color:#856404; font-size:0.75em;">⏳ รอตรวจ</span>`
      : `<span class="badge" style="background:#d4edda; color:#155724; font-size:0.75em;">✅ ตรวจแล้ว</span>`;
    
    const scoreDisplay = isNaN(item.score) || item.score === 0 
      ? '-' 
      : item.score.toFixed(2);
    
    const linkHtml = item.link 
      ? `<a href="${item.link}" target="_blank" style="color:${item.color}; font-size:0.85em;">
           <i class="fa-solid fa-link"></i> เปิดลิงก์
         </a>` 
      : "";
    
    const commentHtml = item.adminComment 
      ? `<div style="margin-top:10px; padding:12px; background:${item.color}08; 
                      border-left:3px solid ${item.color}; border-radius:8px; 
                      font-size:0.85em; color:#555;">
           <i class="fa-solid fa-comment" style="color:${item.color}; margin-right:5px;"></i>
           ${item.adminComment}
         </div>` 
      : "";
    
    return `
      <div style="background:#fff; border-radius:14px; padding:16px; margin-bottom:12px; 
                  border:1px solid #f0f0f0; box-shadow:0 4px 15px rgba(0,0,0,0.03);">
        <div style="display:flex; align-items:center; gap:15px;">
          <div style="width:50px; height:50px; border-radius:14px; 
                      background:${item.color}15; color:${item.color}; 
                      display:flex; align-items:center; justify-content:center; 
                      font-size:1.4em; flex-shrink:0;">
            <i class="fa-solid ${item.icon}"></i>
          </div>
          <div style="flex:1; min-width:0;">
            <div style="font-weight:700; font-size:1em; color:#2d3436; margin-bottom:4px;">
              ${item.title}
            </div>
            <div style="font-size:0.8em; color:#64748b; margin-bottom:4px;">
              ${item.detail}
            </div>
            <div style="font-size:0.75em; color:#b2bec3; display:flex; align-items:center; gap:8px;">
              <span>${date}</span>
              <span style="width:3px; height:3px; background:#dfe6e9; border-radius:50%;"></span>
              ${item.type}
              <span style="width:3px; height:3px; background:#dfe6e9; border-radius:50%;"></span>
              ${statusBadge}
            </div>
          </div>
          <div style="text-align:right; flex-shrink:0;">
            <div style="font-weight:800; color:${item.color}; font-size:1.3em;">
              ${scoreDisplay}
            </div>
            ${linkHtml}
          </div>
        </div>
        ${commentHtml}
      </div>
    `;
  }).join('');
}
```

### Phase 3: Unified Submission UI (Week 3-4)

```html
<!-- Unified Submission Modal -->
<div id="unified-submit-modal" class="modal" style="display:none;">
  <div class="modal-content" style="max-width:600px; border-radius:20px;">
    <div class="modal-header" style="padding:24px; border-bottom:1px solid #f0f0f0;">
      <h3 style="margin:0; font-size:1.3em; color:#2d3436;">
        <i class="fa-solid fa-paper-plane" style="color:#4361ee;"></i>
        ส่งงานใหม่ / Submit New
      </h3>
    </div>
    
    <div class="modal-body" style="padding:24px;">
      <!-- Type Selector -->
      <div style="margin-bottom:24px;">
        <label style="font-size:0.85em; font-weight:700; color:#64748b; display:block; margin-bottom:10px;">
          เลือกรูปแบบ / Select Type
        </label>
        <div class="type-selector" style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
          <button class="type-btn active" data-type="case" onclick="selectSubmissionType('case')">
            <i class="fa-solid fa-notes-medical" style="font-size:1.5em;"></i>
            <div>Case</div>
            <div style="font-size:0.75em; opacity:0.7;">เคส</div>
          </button>
          <button class="type-btn" data-type="work" onclick="selectSubmissionType('work')">
            <i class="fa-solid fa-file-lines" style="font-size:1.5em;"></i>
            <div>Work</div>
            <div style="font-size:0.75em; opacity:0.7;">เวิร์ก</div>
          </button>
        </div>
      </div>
      
      <!-- Case Form -->
      <div id="case-form-section" class="form-section">
        <div style="margin-bottom:16px;">
          <label style="font-size:0.85em; font-weight:700; color:#28a745; display:block; margin-bottom:6px;">
            🆔 Case No. (HN) *
          </label>
          <input type="text" id="u-case-id" placeholder="เช่น 12345" 
                 style="width:100%; padding:12px; border:1px solid #e2e8f0; border-radius:10px;">
        </div>
        
        <div style="margin-bottom:16px;">
          <label style="font-size:0.85em; font-weight:700; color:#28a745; display:block; margin-bottom:6px;">
            👤 Patient Name
          </label>
          <input type="text" id="u-case-customer" placeholder="ชื่อผู้ป่วย" 
                 style="width:100%; padding:12px; border:1px solid #e2e8f0; border-radius:10px;">
        </div>
        
        <div style="margin-bottom:16px;">
          <label style="font-size:0.85em; font-weight:700; color:#28a745; display:block; margin-bottom:6px;">
            🏥 Disease System *
          </label>
          <select id="u-case-system" onchange="updateCaseSymptoms()" 
                  style="width:100%; padding:12px; border:1px solid #e2e8f0; border-radius:10px;">
            <option value="">เลือกระบบ / Select system...</option>
            <option value="respiratory">🫁 Respiratory</option>
            <option value="cardio">❤️ Cardiovascular</option>
            <option value="gi">🫃 GI</option>
            <option value="neuro">🧠 Neurological</option>
            <option value="ent">👂 ENT</option>
            <option value="skin">🩹 Skin</option>
            <option value="msk">🦴 Musculoskeletal</option>
            <option value="endocrine">💊 Endocrine/NCDs</option>
            <option value="mental">🧘 Mental Health</option>
            <option value="other">📋 Other</option>
          </select>
        </div>
        
        <div id="u-case-symptoms-section" style="margin-bottom:16px; display:none;">
          <label style="font-size:0.85em; font-weight:700; color:#28a745; display:block; margin-bottom:8px;">
            🏷️ Symptoms (เลือกได้หลายข้อ)
          </label>
          <div id="u-case-symptoms-list" style="display:flex; flex-wrap:wrap; gap:8px;">
            <!-- Dynamic symptom chips -->
          </div>
        </div>
        
        <div style="margin-bottom:16px;">
          <label style="font-size:0.85em; font-weight:700; color:#28a745; display:block; margin-bottom:6px;">
            📝 Additional Note
          </label>
          <textarea id="u-case-note" rows="3" placeholder="รายละเอียดเพิ่มเติม..." 
                    style="width:100%; padding:12px; border:1px solid #e2e8f0; border-radius:10px; resize:vertical;"></textarea>
        </div>
      </div>
      
      <!-- Work Form -->
      <div id="work-form-section" class="form-section" style="display:none;">
        <div style="margin-bottom:16px;">
          <label style="font-size:0.85em; font-weight:700; color:#28a745; display:block; margin-bottom:6px;">
            📌 Work Title *
          </label>
          <input type="text" id="u-work-title" placeholder="หัวข้องาน" 
                 style="width:100%; padding:12px; border:1px solid #e2e8f0; border-radius:10px;">
        </div>
        
        <div style="margin-bottom:16px;">
          <label style="font-size:0.85em; font-weight:700; color:#28a745; display:block; margin-bottom:6px;">
            🔗 Work Link *
          </label>
          <input type="url" id="u-work-link" placeholder="https://..." 
                 style="width:100%; padding:12px; border:1px solid #e2e8f0; border-radius:10px;">
        </div>
      </div>
    </div>
    
    <div class="modal-footer" style="padding:20px 24px; border-top:1px solid #f0f0f0; display:flex; gap:12px;">
      <button onclick="closeUnifiedModal()" 
              style="flex:1; padding:14px; background:#f1f5f9; color:#64748b; border:none; border-radius:12px; font-weight:700; cursor:pointer;">
        ยกเลิก / Cancel
      </button>
      <button id="u-submit-btn" onclick="submitUnified()" 
              style="flex:2; padding:14px; background:linear-gradient(135deg, #4361ee, #3a56d4); 
                     color:white; border:none; border-radius:12px; font-weight:700; cursor:pointer;">
        🚀 ส่งงาน / Submit
      </button>
    </div>
  </div>
</div>

<style>
.type-btn {
  padding:20px;
  background:#f8f9fa;
  border:2px solid #e2e8f0;
  border-radius:14px;
  cursor:pointer;
  transition:all 0.3s ease;
  display:flex;
  flex-direction:column;
  align-items:center;
  gap:8px;
  font-weight:700;
  color:#64748b;
}

.type-btn:hover {
  background:#e8eeff;
  border-color:#4361ee;
  color:#4361ee;
  transform:translateY(-2px);
}

.type-btn.active {
  background:linear-gradient(135deg, #4361ee, #3a56d4);
  border-color:#4361ee;
  color:white;
  box-shadow:0 8px 20px rgba(67,97,238,0.3);
}

.type-btn i {
  font-size:2em;
  margin-bottom:5px;
}
</style>
```

```javascript
// Unified submission logic
let currentSubmissionType = 'case';
let selectedSymptoms = [];

function selectSubmissionType(type) {
  currentSubmissionType = type;
  
  // Update button states
  document.querySelectorAll('.type-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.type === type);
  });
  
  // Show/hide form sections
  document.getElementById('case-form-section').style.display = type === 'case' ? 'block' : 'none';
  document.getElementById('work-form-section').style.display = type === 'work' ? 'block' : 'none';
}

function updateCaseSymptoms() {
  const systemKey = document.getElementById('u-case-system').value;
  const symptomsSection = document.getElementById('u-case-symptoms-section');
  const symptomsList = document.getElementById('u-case-symptoms-list');
  
  if (!systemKey) {
    symptomsSection.style.display = 'none';
    return;
  }
  
  symptomsSection.style.display = 'block';
  
  const symptomMap = {
    respiratory: ['Cough', 'Dyspnea', 'Sore Throat', 'Fever', 'Wheezing'],
    cardio: ['Chest Pain', 'Palpitations', 'Edema', 'Fatigue', 'High BP'],
    gi: ['Abdominal Pain', 'Nausea', 'Vomiting', 'Diarrhea', 'Constipation'],
    neuro: ['Headache', 'Dizziness', 'Numbness', 'Weakness', 'Insomnia'],
    ent: ['Ear Pain', 'Hearing Loss', 'Tinnitus', 'Nasal Congestion'],
    skin: ['Rash', 'Itching', 'Redness', 'Swelling', 'Lesion'],
    msk: ['Back Pain', 'Joint Pain', 'Stiffness', 'Sprain'],
    endocrine: ['Hyperglycemia', 'Polyuria', 'Weight Loss', 'Poor Adherence'],
    mental: ['Stress', 'Anxiety', 'Low Mood', 'Poor Sleep', 'Panic'],
    other: ['Follow-up', 'Medication Q', 'Unclear Symptom']
  };
  
  const symptoms = symptomMap[systemKey] || [];
  selectedSymptoms = [];
  
  symptomsList.innerHTML = symptoms.map(symptom => `
    <button type="button" class="symptom-chip" onclick="toggleSymptom(this, '${symptom}')" 
            style="padding:8px 14px; background:#f1f5f9; border:1px solid #e2e8f0; 
                   border-radius:20px; font-size:0.85em; cursor:pointer; transition:all 0.2s;">
      ${symptom}
    </button>
  `).join('');
}

function toggleSymptom(btn, symptom) {
  const idx = selectedSymptoms.indexOf(symptom);
  if (idx >= 0) {
    selectedSymptoms.splice(idx, 1);
    btn.style.background = '#f1f5f9';
    btn.style.borderColor = '#e2e8f0';
    btn.style.color = '#64748b';
  } else {
    selectedSymptoms.push(symptom);
    btn.style.background = '#4361ee';
    btn.style.borderColor = '#4361ee';
    btn.style.color = 'white';
  }
}

async function submitUnified() {
  const submitBtn = document.getElementById('u-submit-btn');
  submitBtn.disabled = true;
  submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> กำลังส่ง...';
  
  try {
    if (currentSubmissionType === 'case') {
      await submitUnifiedCase();
    } else if (currentSubmissionType === 'work') {
      await submitUnifiedWork();
    }
    
    // Success
    submitBtn.innerHTML = '✅ สำเร็จ / Success!';
    submitBtn.style.background = 'linear-gradient(135deg, #22c55e, #16a34a)';
    
    setTimeout(() => {
      closeUnifiedModal();
      submitBtn.disabled = false;
      submitBtn.innerHTML = '🚀 ส่งงาน / Submit';
      submitBtn.style.background = '';
    }, 2000);
    
  } catch (error) {
    alert('Error: ' + error.message);
    submitBtn.disabled = false;
    submitBtn.innerHTML = '🚀 ส่งงาน / Submit';
  }
}

async function submitUnifiedCase() {
  const caseId = document.getElementById('u-case-id').value.trim();
  const customer = document.getElementById('u-case-customer').value.trim();
  const systemKey = document.getElementById('u-case-system').value;
  const note = document.getElementById('u-case-note').value.trim();
  
  if (!caseId) throw new Error('กรุณากรอก Case No. / Please enter Case No.');
  if (!systemKey) throw new Error('กรุณาเลือกระบบโรค / Please select disease system');
  
  const systemLabels = {
    respiratory: 'Respiratory / ระบบทางเดินหายใจ',
    cardio: 'Cardiovascular / ระบบหัวใจ',
    gi: 'GI / ระบบทางเดินอาหาร',
    neuro: 'Neurological / ระบบประสาท',
    ent: 'ENT / หูคอจมูก',
    skin: 'Skin / ผิวหนัง',
    msk: 'Musculoskeletal / กล้ามเนื้อกระดูก',
    endocrine: 'Endocrine / ต่อมไร้ท่อ',
    mental: 'Mental Health / สุขภาพจิต',
    other: 'Other / อื่นๆ'
  };
  
  const formData = {
    caseId,
    customer,
    disease: systemLabels[systemKey] || systemKey,
    systemKey,
    systemLabel: systemLabels[systemKey],
    symptomTags: [...selectedSymptoms],
    note
  };
  
  // Submit using dual-write system
  await submitCase(formData);
  
  // Clear form
  document.getElementById('u-case-id').value = '';
  document.getElementById('u-case-customer').value = '';
  document.getElementById('u-case-system').value = '';
  document.getElementById('u-case-note').value = '';
  selectedSymptoms = [];
}

async function submitUnifiedWork() {
  const title = document.getElementById('u-work-title').value.trim();
  const link = document.getElementById('u-work-link').value.trim();
  
  if (!title) throw new Error('กรุณากรอกหัวข้องาน / Please enter work title');
  if (!link) throw new Error('กรุณากรอกลิงก์ / Please enter work link');
  
  const formData = { title, link };
  
  // Submit using dual-write system
  await submitWork(formData);
  
  // Clear form
  document.getElementById('u-work-title').value = '';
  document.getElementById('u-work-link').value = '';
}

function openUnifiedModal() {
  document.getElementById('unified-submit-modal').style.display = 'flex';
  selectSubmissionType('case'); // Default to case
}

function closeUnifiedModal() {
  document.getElementById('unified-submit-modal').style.display = 'none';
}
```

### Phase 4: Firestore Security Rules (Week 4)

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // Unified submissions collection
    match /submissions/{submissionId} {
      // Allow read if owner or admin
      allow read: if request.auth != null && 
                     (resource.data.authUid == request.auth.uid || 
                      request.auth.token.admin == true);
      
      // Allow create if authenticated
      allow create: if request.auth != null && 
                       request.resource.data.authUid == request.auth.uid &&
                       request.resource.data.userId == request.auth.uid &&
                       request.resource.data.submissionType in ['case', 'work', 'quiz', 'quest', 'reflective'];
      
      // Allow update only by admin or owner (limited fields)
      allow update: if request.auth != null && (
        // Owner can only update specific fields
        (resource.data.authUid == request.auth.uid && 
         request.resource.data.diff(resource.data).affectedKeys().hasOnly(['updatedAt'])) ||
        // Admin can update anything
        request.auth.token.admin == true
      );
      
      // Only admin can delete
      allow delete: if request.auth != null && request.auth.token.admin == true;
    }
    
    // Legacy collections (maintain for backward compatibility)
    match /cases/{caseId} {
      allow read, write: if request.auth != null;
    }
    
    match /works/{workId} {
      allow read, write: if request.auth != null;
    }
  }
}
```

### Phase 5: Analytics & Dashboard (Week 4-5)

```javascript
// Unified analytics
function calculateUnifiedStats() {
  const submissions = unifiedSubmissionsCache;
  
  const stats = {
    total: submissions.length,
    byType: {
      case: submissions.filter(s => s.submissionType === 'case').length,
      work: submissions.filter(s => s.submissionType === 'work').length,
      quiz: submissions.filter(s => s.submissionType === 'quiz').length
    },
    byStatus: {
      pending: submissions.filter(s => s.status === 'pending' || s.status === 'รอตรวจ').length,
      approved: submissions.filter(s => s.status === 'approved' || s.status === 'ตรวจแล้ว').length
    },
    totalScore: submissions.reduce((sum, s) => sum + (s.score || 0), 0),
    thisWeek: submissions.filter(s => {
      const date = s.timestamp?.toDate();
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      return date > weekAgo;
    }).length
  };
  
  return stats;
}

// Render stats dashboard
function renderUnifiedStats() {
  const stats = calculateUnifiedStats();
  const container = document.getElementById('unified-stats-dashboard');
  if (!container) return;
  
  container.innerHTML = `
    <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(150px, 1fr)); gap:16px; margin-bottom:24px;">
      <div style="background:linear-gradient(135deg, #4361ee, #3a56d4); color:white; padding:20px; border-radius:16px; text-align:center;">
        <div style="font-size:2em; font-weight:800;">${stats.total}</div>
        <div style="font-size:0.85em; opacity:0.9;">ทั้งหมด / Total</div>
      </div>
      <div style="background:linear-gradient(135deg, #ef233c, #d90429); color:white; padding:20px; border-radius:16px; text-align:center;">
        <div style="font-size:2em; font-weight:800;">${stats.byType.case}</div>
        <div style="font-size:0.85em; opacity:0.9;">Case เคส</div>
      </div>
      <div style="background:linear-gradient(135deg, #4361ee, #3a56d4); color:white; padding:20px; border-radius:16px; text-align:center;">
        <div style="font-size:2em; font-weight:800;">${stats.byType.work}</div>
        <div style="font-size:0.85em; opacity:0.9;">Work เวิร์ก</div>
      </div>
      <div style="background:linear-gradient(135deg, #22c55e, #16a34a); color:white; padding:20px; border-radius:16px; text-align:center;">
        <div style="font-size:2em; font-weight:800;">${stats.totalScore.toFixed(2)}</div>
        <div style="font-size:0.85em; opacity:0.9;">คะแนน / Score</div>
      </div>
    </div>
  `;
}
```

---

## 🔄 Migration Checklist

- [ ] **Week 1**: Setup dual-write system
  - [ ] Add `submissions` collection to Firestore
  - [ ] Update `submitCase()` with dual-write
  - [ ] Update `submitWork()` with dual-write
  - [ ] Test both legacy and new collections

- [ ] **Week 2**: Unified history view
  - [ ] Create `loadUnifiedSubmissions()` function
  - [ ] Build `renderUnifiedHistory()` UI
  - [ ] Add type filter controls
  - [ ] Test with real data

- [ ] **Week 3**: Unified submission form
  - [ ] Build unified modal UI
  - [ ] Implement type selector
  - [ ] Add case form with symptoms
  - [ ] Add work form with link
  - [ ] Test submission flow

- [ ] **Week 4**: Security & analytics
  - [ ] Deploy Firestore security rules
  - [ ] Build analytics dashboard
  - [ ] Add stats calculations
  - [ ] Performance testing

- [ ] **Week 5**: Data migration
  - [ ] Create migration script for old cases
  - [ ] Create migration script for old works
  - [ ] Run migration in staging
  - [ ] Verify data integrity
  - [ ] Run migration in production

- [ ] **Week 6**: Cleanup & optimization
  - [ ] Monitor error logs
  - [ ] Optimize queries
  - [ ] Update documentation
  - [ ] Train admin users

---

## 🎨 UI/UX Enhancements

### Korean Character Preservation

All UI elements will display both Thai/English and Korean:

```javascript
const TYPE_LABELS = {
  case: {
    th: 'เคส',
    en: 'Case',
    ko: '케이스',
    display: 'Case เค스 / 케이스'
  },
  work: {
    th: 'เวิร์ก',
    en: 'Work',
    ko: '워크',
    display: 'Work เวิร์ก / 워크'
  },
  quiz: {
    th: 'ควิซ',
    en: 'Quiz',
    ko: '퀴즈',
    display: 'Quiz ควิซ / 퀴즈'
  }
};

// Usage in rendering
function getTypeLabel(type) {
  const label = TYPE_LABELS[type];
  return label ? label.display : type;
}
```

### Responsive Design

```css
/* Mobile-first responsive */
@media (max-width: 768px) {
  .type-selector {
    grid-template-columns: 1fr !important;
  }
  
  .modal-content {
    max-width: 95% !important;
    margin: 20px auto;
  }
}

@media (min-width: 769px) and (max-width: 1024px) {
  .type-selector {
    grid-template-columns: repeat(2, 1fr);
  }
}
```

---

## 🚀 Deployment Steps

1. **Deploy to Staging**
   ```bash
   firebase use staging
   firebase deploy --only firestore:rules,functions
   ```

2. **Test Migration Script**
   ```bash
   node scripts/migrate-to-unified.js --dry-run
   ```

3. **Deploy to Production**
   ```bash
   firebase use production
   firebase deploy --only firestore:rules
   ```

4. **Run Migration**
   ```bash
   node scripts/migrate-to-unified.js --production
   ```

5. **Monitor**
   - Check Firestore console
   - Monitor error logs
   - Verify user submissions

---

## 📈 Benefits

✅ **Unified Experience**: One interface for all submissions  
✅ **Better Analytics**: Cross-type insights and reporting  
✅ **Scalable**: Easy to add new submission types  
✅ **Korean Support**: Preserved 케이스/워크 labels  
✅ **Backward Compatible**: Legacy system still works  
✅ **Future-Proof**: Ready for assignments, quests, etc.  

---

## 🎯 Next Steps

1. Review this implementation plan
2. Adjust any requirements or preferences
3. Begin Phase 1 implementation
4. Set up testing environment
5. Deploy incrementally

Would you like me to:
- Start implementing Phase 1 code in your `index.html`?
- Create the migration script?
- Design the admin review interface?
- Add more features to the unified form?
