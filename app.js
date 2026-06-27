let plan = []; // Current active plan's array
let allPlans = {}; // Dictionary of all plans {"Leg Day": [...], "Arm Day": [...]}
let currentPlanName = "Default Plan";

let currentWorkoutIndex = 0;
let currentSet = 1;
let restTimerInterval = null;
let workoutActive = false;
let isScrolling = false;
let editingId = null;
let isLandscapeMode = false;

let githubConfig = { username: '', repo: '', token: '', lastSha: null };
let githubSyncTimeout = null;

// PWA & Service Worker Registration
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(console.error);
}

// Screen Wake Lock API
let wakeLock = null;
let noSleep = null;

try {
    noSleep = new NoSleep();
} catch (e) {
    console.error("NoSleep.js could not be initialized");
}

async function requestWakeLock() {
    try {
        if ('wakeLock' in navigator) {
            wakeLock = await navigator.wakeLock.request('screen');
        }
    } catch (err) {
        console.error(`Wake Lock error: ${err.message}`);
    }
    
    // Fallback for iOS
    if (noSleep) {
        noSleep.enable();
    }
}

function releaseWakeLock() {
    if (wakeLock !== null) {
        wakeLock.release().then(() => { wakeLock = null; });
    }
    if (noSleep) {
        noSleep.disable();
    }
}

document.addEventListener('visibilitychange', async () => {
    if (wakeLock !== null && document.visibilityState === 'visible' && workoutActive) {
        requestWakeLock();
    }
});

// DOM Elements
const navTabs = document.querySelectorAll('.nav-tab');
const views = document.querySelectorAll('.view');
const workoutView = document.getElementById('workout-view');
const manageView = document.getElementById('manage-view');

const ytLinkInput = document.getElementById('yt-link');
const exerciseNameInput = document.getElementById('exercise-name');
const loopDurationInput = document.getElementById('loop-duration');
const targetSetsInput = document.getElementById('target-sets');
const restSetsInput = document.getElementById('rest-sets');
const restExerciseInput = document.getElementById('rest-exercise');
const btnAddExercise = document.getElementById('btn-add-exercise');
const exerciseList = document.getElementById('exercise-list');

const workoutScrollContainer = document.getElementById('workout-scroll-container');
const emptyState = document.getElementById('workout-empty-state');
const startWorkoutOverlay = document.getElementById('start-workout-overlay');
const btnStartWorkout = document.getElementById('btn-start-workout');

const restTimerOverlay = document.getElementById('rest-timer-overlay');
const restTimeRemainingEl = document.getElementById('rest-time-remaining');
const nextSetInfoEl = document.getElementById('next-set-info');
const btnSkipRest = document.getElementById('btn-skip-rest');
const timerProgressCircle = document.querySelector('.timer-progress');

const btnImportPlan = document.getElementById('btn-import-plan');
const btnExportPlan = document.getElementById('btn-export-plan');
const importFileInput = document.getElementById('import-file');
const btnShareWhatsapp = document.getElementById('btn-share-whatsapp');

const btnCopySyncCode = document.getElementById('btn-copy-sync-code');
const syncCodeInput = document.getElementById('sync-code-input');
const btnImportSyncCode = document.getElementById('btn-import-sync-code');
const btnToggleAspect = document.getElementById('btn-toggle-aspect');
let isSoundEnabled = false;
const activeWorkoutTimer = document.getElementById('active-workout-timer');

const githubUsernameInput = document.getElementById('github-username');
const githubRepoInput = document.getElementById('github-repo');
const githubTokenInput = document.getElementById('github-token');
const btnSaveGithubSettings = document.getElementById('btn-save-github-settings');
const btnGithubSyncNow = document.getElementById('btn-github-sync-now');
const btnGithubRestore = document.getElementById('btn-github-restore');
const syncStatusIndicator = document.getElementById('sync-status-indicator');

// YouTube Players Dictionary
const players = {}; 
let poller = null;

// --- INITIALIZATION ---
function init() {
    loadPlan();
    renderManageList();
    setupEventListeners();
    buildWorkoutSlides();
}

function setupEventListeners() {
    // Tab Navigation
    navTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            navTabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            
            const target = tab.getAttribute('data-target');
            views.forEach(v => {
                if(v.id === target) {
                    v.classList.add('active');
                    v.classList.remove('hidden');
                } else {
                    v.classList.remove('active');
                    setTimeout(() => v.classList.add('hidden'), 300); // Wait for fade out
                }
            });
        });
    });

    // Add Exercise
    btnAddExercise.addEventListener('click', addExercise);

    // Workout Controls
    btnStartWorkout.addEventListener('click', startWorkout);
    btnSkipRest.addEventListener('click', skipRest);
    
    const btnFinishWorkout = document.getElementById('btn-finish-workout');
    const workoutCompleteOverlay = document.getElementById('workout-complete-overlay');
    if (btnFinishWorkout) {
        btnFinishWorkout.addEventListener('click', () => {
            workoutCompleteOverlay.classList.add('hidden');
            startWorkoutOverlay.classList.remove('hidden');
            workoutScrollContainer.scrollTo(0,0);
            navTabs[1].click(); // Simulate click on Manage tab to return user there
        });
    }

    // Scroll snapping detection
    let scrollTimeout;
    workoutScrollContainer.addEventListener('scroll', () => {
        isScrolling = true;
        clearTimeout(scrollTimeout);
        scrollTimeout = setTimeout(handleScrollEnd, 150);
    });

    // GitHub Auto-Sync Listeners
    if (btnSaveGithubSettings) {
        btnSaveGithubSettings.addEventListener('click', () => {
            githubConfig.username = githubUsernameInput.value.trim();
            githubConfig.repo = githubRepoInput.value.trim();
            githubConfig.token = githubTokenInput.value.trim();
            // We do not reset lastSha here so it can continue updating the existing file if the repo is the same.
            localStorage.setItem('gymreels_github_config', JSON.stringify(githubConfig));
            updateGithubStatus("Settings saved");
            alert("GitHub settings saved! Auto-sync is active.");
        });
    }

    if (btnGithubSyncNow) {
        btnGithubSyncNow.addEventListener('click', () => pushToGitHub(true));
    }

    if (btnGithubRestore) {
        btnGithubRestore.addEventListener('click', restoreFromGitHub);
    }

    // Import/Export functionality
    const btnExportLibrary = document.getElementById('btn-export-library');
    if (btnExportLibrary) {
        btnExportLibrary.addEventListener('click', () => {
            const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(allPlans));
            const dlAnchorElem = document.createElement('a');
            dlAnchorElem.setAttribute("href", dataStr);
            dlAnchorElem.setAttribute("download", "gymreels_full_library.json");
            dlAnchorElem.click();
        });
    }

    if (btnExportPlan) {
        btnExportPlan.addEventListener('click', () => {
            const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(plan));
            const dlAnchorElem = document.createElement('a');
            dlAnchorElem.setAttribute("href", dataStr);
            dlAnchorElem.setAttribute("download", `gymreels_${currentPlanName.replace(/[^a-zA-Z0-9]/g, '_')}.json`);
            dlAnchorElem.click();
        });
    }

    if (btnImportPlan && importFileInput) {
        btnImportPlan.addEventListener('click', () => {
            importFileInput.click();
        });
        
        importFileInput.addEventListener('change', (event) => {
            const file = event.target.files[0];
            if (!file) return;
            
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const importedData = JSON.parse(e.target.result);
                    if (Array.isArray(importedData)) {
                        const newName = "Imported Plan " + Math.floor(Math.random() * 1000);
                        allPlans[newName] = importedData;
                        currentPlanName = newName;
                        plan = allPlans[currentPlanName];
                        savePlan();
                        renderManageList();
                        buildWorkoutSlides();
                        updatePlanSelector();
                        alert(`Workout plan imported as "${newName}"!`);
                    } else if (typeof importedData === 'object' && importedData !== null) {
                        if (confirm("This will overwrite your entire workout library. Are you sure?")) {
                            allPlans = importedData;
                            currentPlanName = Object.keys(allPlans)[0] || "Default Plan";
                            plan = allPlans[currentPlanName] || [];
                            if (!allPlans[currentPlanName]) allPlans[currentPlanName] = plan;
                            savePlan();
                            renderManageList();
                            buildWorkoutSlides();
                            updatePlanSelector();
                            alert("Full workout library restored successfully!");
                        }
                    } else {
                        alert("Invalid plan format.");
                    }
                } catch (error) {
                    alert("Error parsing file. Please select a valid JSON file.");
                }
                importFileInput.value = ""; // reset file input so same file can be imported again if needed
            };
            reader.readAsText(file);
        });
    }

    if (btnShareWhatsapp) {
        btnShareWhatsapp.addEventListener('click', () => {
            if (plan.length === 0) {
                alert("Your plan is empty! Add exercises first.");
                return;
            }
            // Create a safe base64 encoding that handles unicode/emojis
            const safeB64 = btoa(unescape(encodeURIComponent(JSON.stringify(plan))));
            const syncUrl = window.location.origin + window.location.pathname + "?plan=" + encodeURIComponent(safeB64);
            const textMsg = "Here is my GymReels workout plan! Click the link to load it instantly: \n\n" + syncUrl + "\n\nFor iOS PWA, copy & paste this Sync Code:\n" + safeB64;
            window.open("https://api.whatsapp.com/send?text=" + encodeURIComponent(textMsg), "_blank");
        });
    }

    if (btnCopySyncCode) {
        btnCopySyncCode.addEventListener('click', () => {
            if (Object.keys(allPlans).length === 0) { alert("Library is empty!"); return; }
            const safeB64 = btoa(unescape(encodeURIComponent(JSON.stringify(allPlans))));
            
            if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(safeB64).then(() => {
                    alert("Sync code copied to clipboard! Paste it on your other device. 📋");
                }).catch(err => {
                    alert("Failed to copy code. Please copy manually.");
                });
            } else {
                // Fallback for non-HTTPS or older browsers
                const textArea = document.createElement("textarea");
                textArea.value = safeB64;
                document.body.appendChild(textArea);
                textArea.focus();
                textArea.select();
                try {
                    document.execCommand('copy');
                    alert("Sync code copied to clipboard! Paste it on your other device. 📋");
                } catch (err) {
                    alert("Failed to copy code. Please copy manually.");
                }
                document.body.removeChild(textArea);
            }
        });
    }

    if (btnImportSyncCode) {
        btnImportSyncCode.addEventListener('click', () => {
            const code = syncCodeInput.value.trim();
            if (!code) return;
            try {
                const importedData = JSON.parse(decodeURIComponent(escape(atob(code))));
                if (Array.isArray(importedData)) {
                    const newName = "Imported Plan " + Math.floor(Math.random() * 1000);
                    allPlans[newName] = importedData;
                    currentPlanName = newName;
                    plan = allPlans[currentPlanName];
                    savePlan();
                    renderManageList();
                    buildWorkoutSlides();
                    updatePlanSelector();
                    syncCodeInput.value = "";
                    alert(`PWA Sync successful! Plan loaded as "${newName}".`);
                } else if (typeof importedData === 'object' && importedData !== null) {
                    if (confirm("This will overwrite your entire workout library. Are you sure?")) {
                        allPlans = importedData;
                        currentPlanName = Object.keys(allPlans)[0] || "Default Plan";
                        plan = allPlans[currentPlanName] || [];
                        if (!allPlans[currentPlanName]) allPlans[currentPlanName] = plan;
                        savePlan();
                        renderManageList();
                        buildWorkoutSlides();
                        updatePlanSelector();
                        syncCodeInput.value = "";
                        alert("Full workout library restored successfully!");
                    }
                } else {
                    alert("Invalid code format.");
                }
            } catch (e) {
                alert("Error parsing sync code. Make sure you copied the entire string without any spaces.");
            }
        });
    }

    // Edit/Delete Exercise Delegation
    exerciseList.addEventListener('click', (e) => {
        const editBtn = e.target.closest('.edit-btn');
        const deleteBtn = e.target.closest('.delete-btn');
        if (editBtn) {
            editExercise(editBtn.closest('.exercise-item').dataset.id);
        } else if (deleteBtn) {
            removeExercise(deleteBtn.closest('.exercise-item').dataset.id);
        }
    });

    // Workout View Dynamic Clicks (Sound Toggle)
    workoutScrollContainer.addEventListener('click', (e) => {
        const soundBtn = e.target.closest('.btn-toggle-sound');
        if (soundBtn) {
            isSoundEnabled = !isSoundEnabled;
            // Update all sound buttons on the screen
            document.querySelectorAll('.btn-toggle-sound').forEach(btn => {
                btn.innerHTML = isSoundEnabled ? '🔊 Sound On' : '🔇 Sound Off';
            });
            if (workoutActive && players[currentWorkoutIndex] && typeof players[currentWorkoutIndex].unMute === 'function') {
                if (isSoundEnabled) {
                    players[currentWorkoutIndex].unMute();
                } else {
                    players[currentWorkoutIndex].mute();
                }
            }
        }
    });

    if (btnToggleAspect) {
        btnToggleAspect.addEventListener('click', () => {
            isLandscapeMode = !isLandscapeMode;
            if (isLandscapeMode) {
                workoutScrollContainer.classList.add('landscape-mode');
                btnToggleAspect.innerHTML = '📱 Portrait';
            } else {
                workoutScrollContainer.classList.remove('landscape-mode');
                btnToggleAspect.innerHTML = '⛶ Landscape';
            }
        });
    }
}

// --- MANAGE VIEW LOGIC ---
function extractYouTubeInfo(url) {
    let videoId = null;
    let startTime = 0;
    
    // Extract ID
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|shorts\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = url.match(regExp);
    if (match && match[2].length === 11) {
        videoId = match[2];
    }
    
    // Extract t= parameter
    try {
        const safeUrl = url.startsWith('http') ? url : `https://${url}`;
        const urlParams = new URL(safeUrl.replace('#', '?')).searchParams; // Handle #t= too
        if (urlParams.has('t')) {
            let tStr = urlParams.get('t');
            if (tStr.includes('s')) {
                startTime = parseInt(tStr.replace('s', ''));
            } else {
                startTime = parseInt(tStr);
            }
        }
    } catch(e) {
        // If URL parsing fails, default to 0
    }
    
    return { videoId, startTime: isNaN(startTime) ? 0 : startTime };
}

function addExercise() {
    const url = ytLinkInput.value.trim();
    const name = exerciseNameInput.value.trim() || "Exercise";
    const duration = parseInt(loopDurationInput.value) || 10;
    const sets = parseInt(targetSetsInput.value) || 4;
    const restSets = parseInt(restSetsInput.value) || 0;
    const restExercise = parseInt(restExerciseInput.value) || 0;

    if (!url) {
        alert("Please enter a YouTube Link.");
        return;
    }

    const info = extractYouTubeInfo(url);
    if (!info.videoId) {
        alert("Invalid YouTube Link. Could not extract Video ID.");
        return;
    }

    if (editingId) {
        const exIndex = plan.findIndex(e => e.id === editingId);
        if (exIndex > -1) {
            plan[exIndex] = {
                ...plan[exIndex],
                videoId: info.videoId,
                startTime: info.startTime,
                name,
                duration,
                sets,
                restSets,
                restExercise
            };
        }
        editingId = null;
        btnAddExercise.innerText = "Add to Plan";
    } else {
        const ex = {
            id: 'ex_' + Date.now(),
            videoId: info.videoId,
            startTime: info.startTime,
            name,
            duration,
            sets,
            restSets,
            restExercise
        };
        plan.push(ex);
    }

    savePlan();
    renderManageList();
    buildWorkoutSlides();
    
    // Clear inputs
    ytLinkInput.value = '';
    exerciseNameInput.value = '';
}

function editExercise(id) {
    const ex = plan.find(e => e.id === id);
    if (!ex) return;
    
    editingId = id;
    
    // Populate form
    ytLinkInput.value = `https://youtu.be/${ex.videoId}?t=${ex.startTime}`;
    exerciseNameInput.value = ex.name;
    loopDurationInput.value = ex.duration;
    targetSetsInput.value = ex.sets;
    restSetsInput.value = ex.restSets !== undefined ? ex.restSets : (ex.rest || 0);
    restExerciseInput.value = ex.restExercise !== undefined ? ex.restExercise : (ex.rest || 0);
    
    btnAddExercise.innerText = "Save Changes";
    
    // Smooth scroll to the form
    const formCard = document.querySelector('.card.form-card');
    if (formCard) {
        formCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
        setTimeout(() => ytLinkInput.focus(), 300);
    }
}

function removeExercise(id) {
    plan = plan.filter(ex => ex.id !== id);
    savePlan();
    renderManageList();
    buildWorkoutSlides();
}

function renderManageList() {
    exerciseList.innerHTML = '';
    plan.forEach((ex, index) => {
        const li = document.createElement('li');
        li.className = 'exercise-item';
        li.dataset.id = ex.id;
        li.innerHTML = `
            <div style="display: flex; align-items: center; gap: 10px;">
                <div class="drag-handle" style="cursor: grab; color: var(--text-secondary); display: flex; align-items: center;">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line></svg>
                </div>
                <div class="exercise-info">
                    <strong>${ex.name}</strong>
                    <p>${ex.duration}s loop • ${ex.sets} sets • Rest: ${ex.restSets !== undefined ? ex.restSets : (ex.rest || 0)}s / ${ex.restExercise !== undefined ? ex.restExercise : (ex.rest || 0)}s</p>
                </div>
            </div>
            <div class="list-actions">
                <button class="action-btn edit-btn">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                </button>
                <button class="action-btn delete-btn">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M10 11v6M14 11v6"/></svg>
                </button>
            </div>
        `;
        exerciseList.appendChild(li);
    });
    updatePlanSelector();
    
    // Re-bind sortable since we destroyed the DOM children
    if (typeof initSortable === 'function') {
        initSortable();
    }
}

function savePlan(skipSync = false) {
    allPlans[currentPlanName] = plan;
    localStorage.setItem('gymreels_plans', JSON.stringify(allPlans));
    localStorage.setItem('gymreels_active_plan', currentPlanName);
    
    // Auto-sync if configured
    if (!skipSync && githubConfig.username && githubConfig.repo && githubConfig.token) {
        clearTimeout(githubSyncTimeout);
        githubSyncTimeout = setTimeout(() => {
            pushToGitHub();
        }, 3000);
    }
}

async function pushToGitHub(manual = false) {
    if (!githubConfig.username || !githubConfig.repo || !githubConfig.token) return;
    
    updateGithubStatus("Syncing...");
    try {
        const path = "gymreels_full_library.json";
        const url = `https://api.github.com/repos/${githubConfig.username}/${githubConfig.repo}/contents/${path}`;
        
        const contentStr = JSON.stringify(allPlans);
        const encodedContent = btoa(unescape(encodeURIComponent(contentStr)));
        
        const body = {
            message: "Auto-backup from GymReels PWA",
            content: encodedContent,
            branch: "master" // fallback to main if master fails, but will try default branch
        };
        
        if (githubConfig.lastSha) {
            body.sha = githubConfig.lastSha;
        } else {
            try {
                const getRes = await fetch(url, { headers: { 'Authorization': `token ${githubConfig.token}` } });
                if (getRes.ok) {
                    const data = await getRes.json();
                    body.sha = data.sha;
                }
            } catch(e) {}
        }
        
        const response = await fetch(url, {
            method: 'PUT',
            headers: {
                'Authorization': `token ${githubConfig.token}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(body)
        });
        
        if (response.ok) {
            const data = await response.json();
            githubConfig.lastSha = data.content.sha;
            localStorage.setItem('gymreels_github_config', JSON.stringify(githubConfig));
            const time = new Date().toLocaleTimeString();
            updateGithubStatus(`Synced at ${time}`);
            if (manual) alert("Successfully synced to GitHub!");
        } else {
            const errorData = await response.json();
            
            // If branch error, try main
            if (errorData.message && errorData.message.includes("branch")) {
                body.branch = "main";
                const response2 = await fetch(url, {
                    method: 'PUT',
                    headers: {
                        'Authorization': `token ${githubConfig.token}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(body)
                });
                if (response2.ok) {
                    const data = await response2.json();
                    githubConfig.lastSha = data.content.sha;
                    localStorage.setItem('gymreels_github_config', JSON.stringify(githubConfig));
                    const time = new Date().toLocaleTimeString();
                    updateGithubStatus(`Synced at ${time}`);
                    if (manual) alert("Successfully synced to GitHub!");
                    return;
                }
            }

            console.error(errorData);
            updateGithubStatus(`Error: ${response.status}`);
            if (manual) alert("Failed to sync: " + (errorData.message || response.statusText));
        }
    } catch (e) {
        console.error(e);
        updateGithubStatus("Network Error");
        if (manual) alert("Network error during sync.");
    }
}

async function restoreFromGitHub() {
    if (!githubConfig.username || !githubConfig.repo || !githubConfig.token) {
        alert("Please save your GitHub settings first.");
        return;
    }
    
    if (!confirm("This will overwrite your entire local workout library with the backup from GitHub. Are you sure?")) return;
    
    updateGithubStatus("Restoring...");
    try {
        const path = "gymreels_full_library.json";
        const url = `https://api.github.com/repos/${githubConfig.username}/${githubConfig.repo}/contents/${path}`;
        
        const response = await fetch(url, {
            headers: {
                'Authorization': `token ${githubConfig.token}`,
                'Accept': 'application/vnd.github.v3.raw'
            }
        });
        
        if (response.ok) {
            const textContent = await response.text();
            const importedData = JSON.parse(textContent);
            
            allPlans = importedData;
            currentPlanName = Object.keys(allPlans)[0] || "Default Plan";
            plan = allPlans[currentPlanName] || [];
            if (!allPlans[currentPlanName]) allPlans[currentPlanName] = plan;
            
            try {
                const headRes = await fetch(url, { headers: { 'Authorization': `token ${githubConfig.token}` } });
                if (headRes.ok) {
                    const headData = await headRes.json();
                    githubConfig.lastSha = headData.sha;
                    localStorage.setItem('gymreels_github_config', JSON.stringify(githubConfig));
                }
            } catch(e){}
            
            savePlan(true); // skip sync when restoring
            renderManageList();
            buildWorkoutSlides();
            updatePlanSelector();
            
            updateGithubStatus("Restored successfully");
            alert("Workout library restored from GitHub!");
        } else {
            const errorData = await response.json();
            updateGithubStatus("Restore Failed");
            alert("Failed to restore: " + (errorData.message || "File might not exist yet."));
        }
    } catch (e) {
        console.error(e);
        updateGithubStatus("Network Error");
        alert("Network error during restore.");
    }
}

function updateGithubStatus(msg) {
    if (syncStatusIndicator) {
        syncStatusIndicator.textContent = msg;
        syncStatusIndicator.style.color = msg.includes("Error") || msg.includes("Failed") ? "#ff4444" : "var(--text-muted)";
    }
}

// --- STORAGE LOGIC ---
function loadPlan() {
    const savedGithubConfig = localStorage.getItem('gymreels_github_config');
    if (savedGithubConfig) {
        try {
            githubConfig = JSON.parse(savedGithubConfig);
            if (githubUsernameInput) githubUsernameInput.value = githubConfig.username;
            if (githubRepoInput) githubRepoInput.value = githubConfig.repo;
            if (githubTokenInput) githubTokenInput.value = githubConfig.token;
            if (githubConfig.lastSha) {
                updateGithubStatus("Ready to sync");
            }
        } catch(e) {}
    }

    // 1. Try to load new format
    const savedPlans = localStorage.getItem('gymreels_plans');
    const activePlan = localStorage.getItem('gymreels_active_plan');
    
    if (savedPlans) {
        try {
            allPlans = JSON.parse(savedPlans);
            currentPlanName = activePlan || Object.keys(allPlans)[0];
            plan = allPlans[currentPlanName];
            if (!plan) {
                plan = [];
                allPlans[currentPlanName] = plan;
            }
        } catch (e) {
            allPlans = { "Default Plan": [] };
            currentPlanName = "Default Plan";
            plan = allPlans[currentPlanName];
        }
    } else {
        // 2. Migration from old format
        const oldSaved = localStorage.getItem('repmax_plan');
        if (oldSaved) {
            try {
                const oldPlan = JSON.parse(oldSaved);
                allPlans = { "Default Plan": oldPlan };
            } catch (e) {
                allPlans = { "Default Plan": [] };
            }
        } else {
            allPlans = { "Default Plan": [] };
        }
        currentPlanName = "Default Plan";
        plan = allPlans[currentPlanName];
        savePlan(true); // save to new format without triggering cloud sync

    }

    // Check for shared data in URL
    const urlParams = new URLSearchParams(window.location.search);
    const sharedData = urlParams.get('plan');
    if (sharedData) {
        try {
            const importedData = JSON.parse(decodeURIComponent(escape(atob(sharedData))));
            if (Array.isArray(importedData)) {
                // Individual plan imported (from WhatsApp usually)
                const newName = "Imported Plan " + Math.floor(Math.random() * 1000);
                allPlans[newName] = importedData;
                currentPlanName = newName;
                plan = allPlans[currentPlanName];
                savePlan();
                
                window.history.replaceState({}, document.title, window.location.pathname);
                alert(`Shared workout plan loaded as "${newName}"!`);
            } else if (typeof importedData === 'object' && importedData !== null) {
                // Full library imported (from Sync Code usually)
                allPlans = importedData;
                currentPlanName = Object.keys(allPlans)[0] || "Default Plan";
                plan = allPlans[currentPlanName] || [];
                if (!allPlans[currentPlanName]) allPlans[currentPlanName] = plan;
                savePlan();
                
                window.history.replaceState({}, document.title, window.location.pathname);
                alert("Full workout library synced successfully!");
            }
        } catch(e) {
            console.error("Invalid shared plan payload.");
            alert("The shared workout link is invalid or corrupted.");
        }
    }
}

// --- WORKOUT VIEW LOGIC ---
function buildWorkoutSlides() {
    workoutScrollContainer.innerHTML = '';
    
    // Clear old players to prevent dead references if the DOM is rebuilt
    for (let key in players) {
        delete players[key];
    }
    
    if (plan.length === 0) {
        workoutScrollContainer.appendChild(emptyState);
        startWorkoutOverlay.classList.add('hidden');
        return;
    }
    
    startWorkoutOverlay.classList.remove('hidden');

    plan.forEach((ex, index) => {
        const slide = document.createElement('div');
        slide.className = 'workout-slide';
        slide.id = `slide-${index}`;
        
        slide.innerHTML = `
            <div class="video-wrapper">
                <div id="player-container-${ex.id}"></div>
            </div>
            <div class="slide-overlay">
                <h2 class="slide-title">${ex.name}</h2>
                <div style="display: flex; align-items: center; justify-content: space-between;">
                    <div class="slide-stats" id="stats-${ex.id}">Set 1 of ${ex.sets}</div>
                    <button class="secondary-btn btn-toggle-sound" style="width: auto; padding: 4px 10px; font-size: 12px; background: rgba(0,0,0,0.5); border: 1px solid rgba(255,255,255,0.2); backdrop-filter: blur(4px);">
                        ${isSoundEnabled ? '🔊 Sound On' : '🔇 Sound Off'}
                    </button>
                </div>
            </div>
        `;
        workoutScrollContainer.appendChild(slide);
    });
}

// YouTube API Callback
function onYouTubeIframeAPIReady() {
    // API is ready, but we wait for 'Start Workout' to instantiate players to satisfy autoplay policies
}

function startWorkout() {
    if (plan.length === 0) return;
    
    workoutActive = true;
    currentWorkoutIndex = 0;
    currentSet = 1;
    
    startWorkoutOverlay.classList.add('hidden');
    if (activeWorkoutTimer) activeWorkoutTimer.classList.remove('hidden');
    requestWakeLock(); // Request lock
    
    currentSet = 1;
    updateStatsUI();
    
    // Instantiate all players if they haven't been already
    plan.forEach((ex, index) => {
        if (!players[index]) {
            players[index] = new YT.Player(`player-container-${ex.id}`, {
                videoId: ex.videoId,
                playerVars: {
                    'playsinline': 1,
                    'controls': 0,
                    'disablekb': 1,
                    'fs': 0,
                    'rel': 0,
                    'modestbranding': 1,
                    'showinfo': 0,
                    'start': ex.startTime
                },
                events: {
                    'onReady': onPlayerReady
                }
            });
        }
    });

    // If the first player is already fully initialized (from a previous workout), play it immediately!
    if (players[0] && typeof players[0].playVideo === 'function') {
        if (isSoundEnabled) { players[0].unMute(); } else { players[0].mute(); }
        players[0].seekTo(plan[0].startTime);
        players[0].playVideo();
    }

    workoutScrollContainer.scrollTo(0, 0);
    startPolling();
}

function onPlayerReady(event) {
    const index = Object.keys(players).find(k => players[k] === event.target);
    
    if (isSoundEnabled) {
        event.target.unMute();
    } else {
        event.target.mute(); // Mute by default as per requirements
    }
    
    // If this is the first player, play it
    if (index == currentWorkoutIndex && workoutActive) {
        event.target.playVideo();
    }
}

function handleScrollEnd() {
    isScrolling = false;
    if (!workoutActive) return;
    
    ignorePollingUntil = Date.now() + 1500; // Debounce poller to allow new video time to load
    
    const slideHeight = workoutScrollContainer.clientHeight;
    const newIndex = Math.round(workoutScrollContainer.scrollTop / slideHeight);
    
    if (newIndex !== currentWorkoutIndex && newIndex < plan.length) {
        // If a rest timer is actively running and the slide changes (e.g., user swiped),
        // we should instantly cancel the rest timer and yield to the new slide.
        if (!restTimerOverlay.classList.contains('hidden')) {
            clearInterval(restTimerInterval);
            restTimerOverlay.classList.add('hidden');
            pendingScrollAfterRest = false;
        }

        // Paused old video
        if (players[currentWorkoutIndex] && players[currentWorkoutIndex].pauseVideo) {
            players[currentWorkoutIndex].pauseVideo();
        }
        
        currentWorkoutIndex = newIndex;
        currentSet = 1; // Reset set count when scrolling to a new exercise
        updateStatsUI();
        const ex = plan[currentWorkoutIndex];
        
        // Play new video
        if (players[currentWorkoutIndex] && players[currentWorkoutIndex].playVideo) {
            if (isSoundEnabled) { players[currentWorkoutIndex].unMute(); } else { players[currentWorkoutIndex].mute(); }
            players[currentWorkoutIndex].seekTo(plan[currentWorkoutIndex].startTime);
            players[currentWorkoutIndex].playVideo();
        }
    }
}

let ignorePollingUntil = 0;

// Polling for loop logic
function startPolling() {
    if (poller) clearInterval(poller);
    
    poller = setInterval(() => {
        if (!workoutActive || restTimerOverlay.classList.contains('hidden') === false || isScrolling) return;
        if (Date.now() < ignorePollingUntil) return;

        const player = players[currentWorkoutIndex];
        if (!player || typeof player.getCurrentTime !== 'function') return;

        const ex = plan[currentWorkoutIndex];
        const targetDuration = parseInt(ex.duration);
        const currentTime = player.getCurrentTime();
        
        // Update Live Timer UI
        if (activeWorkoutTimer) {
            const timeLeft = Math.max(0, Math.ceil(targetDuration - (currentTime - ex.startTime)));
            const mins = Math.floor(timeLeft / 60);
            const secs = timeLeft % 60;
            activeWorkoutTimer.innerText = `${mins}:${secs.toString().padStart(2, '0')}`;
        }
        
        if (currentTime >= (ex.startTime + targetDuration)) {
            // Loop finished
            handleLoopEnd();
        }
    }, 100);
}

let pendingScrollAfterRest = false;

function handleLoopEnd() {
    const ex = plan[currentWorkoutIndex];
    const player = players[currentWorkoutIndex];
    
    if (currentSet < ex.sets) {
        player.pauseVideo();
        startRestTimer(ex.restSets !== undefined ? ex.restSets : (ex.rest || 0), false);
    } else {
        // Sets completed for this exercise
        player.pauseVideo();
        
        if (currentWorkoutIndex + 1 < plan.length) {
            // Trigger the rest timer before we scroll to the next exercise
            startRestTimer(ex.restExercise !== undefined ? ex.restExercise : (ex.rest || 0), true);
        } else {
            // Workout Complete
            workoutActive = false;
            clearInterval(poller);
            if (restTimerInterval) clearInterval(restTimerInterval);
            
            startWorkoutOverlay.classList.remove('hidden');
            restTimerOverlay.classList.add('hidden');
            if (activeWorkoutTimer) activeWorkoutTimer.classList.add('hidden');
            const workoutCompleteOverlay = document.getElementById('workout-complete-overlay');
            if (workoutCompleteOverlay) {
                workoutCompleteOverlay.classList.remove('hidden');
            }
            
            releaseWakeLock(); // Release lock

            for (const key in players) {
                if (players[key] && typeof players[key].pauseVideo === 'function') {
                    players[key].pauseVideo();
                }
            }
        }
    }
}

function startRestTimer(durationSeconds, isTransitioningExercise = false) {
    if (durationSeconds <= 0) {
        finishRest(isTransitioningExercise);
        return;
    }
    
    pendingScrollAfterRest = isTransitioningExercise;
    restTimerOverlay.classList.remove('hidden');
    
    if (isTransitioningExercise) {
        const nextEx = plan[currentWorkoutIndex + 1];
        nextSetInfoEl.innerText = `Up Next: ${nextEx.name}`;
    } else {
        const ex = plan[currentWorkoutIndex];
        nextSetInfoEl.innerText = `Next: Set ${currentSet + 1} of ${ex.sets}`;
    }
    
    let timeRemaining = durationSeconds;
    restTimeRemainingEl.innerText = timeRemaining;
    
    // Reset SVG Circle
    timerProgressCircle.style.transition = 'none';
    timerProgressCircle.style.strokeDashoffset = '0';
    // Force reflow
    timerProgressCircle.getBoundingClientRect();
    timerProgressCircle.style.transition = `stroke-dashoffset ${durationSeconds}s linear`;
    timerProgressCircle.style.strokeDashoffset = '283'; // 100%
    
    clearInterval(restTimerInterval);
    restTimerInterval = setInterval(() => {
        timeRemaining--;
        restTimeRemainingEl.innerText = timeRemaining;
        
        if (timeRemaining <= 0) {
            finishRest(pendingScrollAfterRest);
        }
    }, 1000);
}

function skipRest() {
    finishRest(pendingScrollAfterRest);
}

function finishRest(isTransitioning) {
    ignorePollingUntil = Date.now() + 1500; // Debounce poller to allow YouTube API time to reset
    clearInterval(restTimerInterval);
    restTimerOverlay.classList.add('hidden');
    
    if (isTransitioning) {
        // We were resting between exercises. Now scroll down to the next one!
        const nextIndex = currentWorkoutIndex + 1;
        workoutScrollContainer.scrollTo({
            top: nextIndex * workoutScrollContainer.clientHeight,
            behavior: 'smooth'
        });
        pendingScrollAfterRest = false;
    } else {
        // We were resting between sets. Just loop the same video again.
        currentSet++;
        updateStatsUI();
        
        const player = players[currentWorkoutIndex];
        const ex = plan[currentWorkoutIndex];
        
        if (player && player.seekTo) {
            if (isSoundEnabled) { player.unMute(); } else { player.mute(); }
            player.seekTo(ex.startTime);
            player.playVideo();
        }
    }
}

function updateStatsUI() {
    const ex = plan[currentWorkoutIndex];
    const statsEl = document.getElementById(`stats-${ex.id}`);
    if (statsEl) {
        statsEl.innerText = `Set ${currentSet} of ${ex.sets}`;
    }
}

// Init
document.addEventListener('DOMContentLoaded', init);

// --- MULTIPLE PLANS LOGIC ---
const planSelector = document.getElementById('plan-selector');
const btnNewPlan = document.getElementById('btn-new-plan');
const btnRenamePlan = document.getElementById('btn-rename-plan');
const btnDeletePlan = document.getElementById('btn-delete-plan');

function updatePlanSelector() {
    if (!planSelector) return;
    planSelector.innerHTML = '';
    Object.keys(allPlans).forEach(name => {
        const option = document.createElement('option');
        option.value = name;
        option.innerText = `${name} (${allPlans[name].length} exercises)`;
        if (name === currentPlanName) {
            option.selected = true;
        }
        planSelector.appendChild(option);
    });
}

if (planSelector) {
    planSelector.addEventListener('change', (e) => {
        currentPlanName = e.target.value;
        plan = allPlans[currentPlanName];
        savePlan();
        renderManageList();
        buildWorkoutSlides();
    });
}

if (btnNewPlan) {
    btnNewPlan.addEventListener('click', () => {
        const newName = prompt("Enter a name for the new workout plan:");
        if (newName && newName.trim() !== "") {
            if (allPlans[newName]) {
                alert("A plan with this name already exists.");
                return;
            }
            allPlans[newName] = [];
            currentPlanName = newName;
            plan = allPlans[currentPlanName];
            savePlan();
            renderManageList();
            buildWorkoutSlides();
        }
    });
}

if (btnRenamePlan) {
    btnRenamePlan.addEventListener('click', () => {
        const newName = prompt("Enter a new name for this plan:", currentPlanName);
        if (newName && newName.trim() !== "" && newName !== currentPlanName) {
            if (allPlans[newName]) {
                alert("A plan with this name already exists.");
                return;
            }
            allPlans[newName] = allPlans[currentPlanName];
            delete allPlans[currentPlanName];
            currentPlanName = newName;
            plan = allPlans[currentPlanName];
            savePlan();
            renderManageList(); // update dropdown
        }
    });
}

if (btnDeletePlan) {
    btnDeletePlan.addEventListener('click', () => {
        if (Object.keys(allPlans).length <= 1) {
            alert("You cannot delete your only workout plan.");
            return;
        }
        if (confirm(`Are you sure you want to delete "${currentPlanName}"?`)) {
            delete allPlans[currentPlanName];
            currentPlanName = Object.keys(allPlans)[0];
            plan = allPlans[currentPlanName];
            savePlan();
            renderManageList();
            buildWorkoutSlides();
        }
    });
}

// --- DRAG AND DROP REORDERING (SortableJS) ---
let sortableInstance = null;

function initSortable() {
    if (sortableInstance) {
        sortableInstance.destroy();
    }
    
    sortableInstance = new Sortable(exerciseList, {
        handle: '.drag-handle', // only drag using the handle icon
        animation: 150,
        ghostClass: 'dragging',
        onEnd: function (evt) {
            const items = [...exerciseList.querySelectorAll('.exercise-item')];
            const newPlan = [];
            
            items.forEach(item => {
                const id = item.dataset.id;
                const ex = plan.find(p => p.id === id);
                if (ex) newPlan.push(ex);
            });
            
            plan = newPlan;
            savePlan();
            buildWorkoutSlides();
        }
    });
}

// Call initSortable right after the DOM content loads
document.addEventListener('DOMContentLoaded', () => {
    initSortable();
});
