// Kanban Board Module - V88.83
// Handles Kanban board functionality

// Global variables
let sideQuestsCache = {};
let questsCache = [];
let reflectiveLogsCache = [];
let accessRequestsCache = [];
let pendingQuizzesCache = [];
let pointsClaimedCache = [];
let activeBoardGroup = 'All';

// Initialize Kanban board
function initKanban() {
    ["Backlog", "Doing", "Review", "Done"].forEach(id => {
        const el = document.getElementById(id);
        if (el && !el.dataset.sortable) {
            new Sortable(el, {
                group: 'kanban',
                animation: 150,
                onEnd: async (evt) => {
                    const id = evt.item.dataset.id;
                    const newStatus = evt.to.id;
                    if (id && newStatus) {
                        await db.collection("side_quests").doc(id).update({ status: newStatus });
                        showToast(`Moved to ${newStatus}`);
                    }
                }
            });
            el.dataset.sortable = "true";
        }
    });
    
    // Load initial data
    loadKanbanData();
}

// Load data for Kanban board
function loadKanbanData() {
    // Load Side Quests
    db.collection("side_quests").onSnapshot((snapshot) => {
        sideQuestsCache = {};
        snapshot.forEach(doc => sideQuestsCache[doc.id] = doc.data());
        drawKanban();
    });

    // Load Reflective Logs
    db.collection("reflective_logs").onSnapshot((snapshot) => {
        reflectiveLogsCache = [];
        snapshot.forEach(doc => reflectiveLogsCache.push({ id: doc.id, ...doc.data() }));
        drawKanban();
    });

    // Load Access Requests
    db.collection("access_requests").onSnapshot((snapshot) => {
        accessRequestsCache = [];
        snapshot.forEach(doc => accessRequestsCache.push({ id: doc.id, ...doc.data() }));
        drawKanban();
    });

    // Load Pending Quizzes
    db.collection("quiz_attempts").onSnapshot((snapshot) => {
        pendingQuizzesCache = [];
        snapshot.forEach(doc => pendingQuizzesCache.push({ id: doc.id, ...doc.data() }));
        drawKanban();
    });

    // Load Points Claimed
    db.collection("points_claimed").onSnapshot((snapshot) => {
        pointsClaimedCache = [];
        snapshot.forEach(doc => pointsClaimedCache.push({ id: doc.id, ...doc.data() }));
        drawKanban();
    });
}

// Draw Kanban board
function drawKanban() {
    const cols = { 
        "Backlog": document.getElementById("Backlog"), 
        "Doing": document.getElementById("Doing"), 
        "Review": document.getElementById("Review"), 
        "Done": document.getElementById("Done") 
    };
    
    // Safety Check
    if (!cols.Backlog || !cols.Review) return;

    // Clear all columns
    Object.values(cols).forEach(e => { if (e) e.innerHTML = ""; });
    const cnt = { "Backlog": 0, "Doing": 0, "Review": 0, "Done": 0 };
    
    // 1. Render Side Quests
    Object.keys(sideQuestsCache).forEach(id => {
        const q = sideQuestsCache[id];
        if (!q || q.status === 'Archived') return;
        
        if (cols[q.status]) {
            cnt[q.status]++;
            const isProj = q.isProject === true;
            const d = document.createElement('div');
            d.className = `kanban-card card-${q.status} ${q.isScored ? 'scored' : ''} ${isProj ? 'project' : ''}`;
            d.dataset.id = id;
            
            // Build card content
            let content = `
                <div class="card-header-row">
                    <span class="badge" style="background: var(--primary);">${q.title || 'Quest'}</span>
                    <div class="card-header-right">
                        ${q.assignees ? q.assignees.map(u => `<img src="${u.pic || ''}" class="assignee-img" title="${u.name || ''}">`).join('') : ''}
                    </div>
                </div>
                <div style="font-weight:bold; font-size:0.9em; margin-bottom:4px;">${q.title || 'Untitled Quest'}</div>
                <div style="font-size:0.85em; color:#444;">${q.description || 'No description'}</div>
            `;
            
            // Add action buttons
            if (q.status === 'Done' && q.doneAt) {
                content += `<button class="btn-sm btn-dark" style="width:100%;margin-top:5px;" onclick="archiveSQ('${id}')">📥 Archive</button>`;
            } else if (!q.isScored && q.status !== 'Backlog' && q.status !== 'Done') {
                content += `<button class="btn-sm btn-success" style="width:100%;margin-top:5px;" onclick="giveScore('${id}')">💰 Give Score</button>`;
            }
            
            d.innerHTML = content;
            cols[q.status].appendChild(d);
        }
    });

    // Update column counts
    Object.keys(cnt).forEach(k => {
        const badge = document.getElementById(`cnt-${k}`);
        if (badge) badge.innerText = cnt[k];
    });
}

// Helper functions
function archiveSQ(id) {
    if (confirm('Archive this quest?')) {
        db.collection("side_quests").doc(id).update({ status: 'Archived' });
        showToast('Quest archived');
    }
}

function giveScore(id) {
    const score = prompt('Enter score:');
    if (score && !isNaN(score)) {
        db.collection("side_quests").doc(id).update({ 
            isScored: true,
            score: parseFloat(score)
        });
        showToast('Score assigned');
    }
}

function showToast(message) {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.classList.add('show');
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

// Expose functions to global scope
window.initKanban = initKanban;
window.drawKanban = drawKanban;
window.archiveSQ = archiveSQ;
window.giveScore = giveScore;
