let plan = [];
let currentWorkoutIndex = 0;
let currentSet = 1;
let restTimerInterval = null;
let workoutActive = false;
let isScrolling = false;
let editingId = null;
let isLandscapeMode = false;

// PWA & Service Worker Registration
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(console.error);
}

// Screen Wake Lock API
let wakeLock = null;
async function requestWakeLock() {
    try {
        if ('wakeLock' in navigator) {
            wakeLock = await navigator.wakeLock.request('screen');
        }
    } catch (err) {
        console.error(`Wake Lock error: ${err.message}`);
    }
}

function releaseWakeLock() {
    if (wakeLock !== null) {
        wakeLock.release().then(() => { wakeLock = null; });
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
const durationInput = document.getElementById('loop-duration');
const targetSetsInput = document.getElementById('target-sets');
const restIntervalInput = document.getElementById('rest-interval');
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
const activeWorkoutTimer = document.getElementById('active-workout-timer');

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

    // Import/Export functionality
    if (btnExportPlan) {
        btnExportPlan.addEventListener('click', () => {
            const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(plan));
            const dlAnchorElem = document.createElement('a');
            dlAnchorElem.setAttribute("href", dataStr);
            dlAnchorElem.setAttribute("download", "repmax_workout.json");
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
                    const importedPlan = JSON.parse(e.target.result);
                    if (Array.isArray(importedPlan)) {
                        plan = importedPlan;
                        savePlan();
                        renderManageList();
                        buildWorkoutSlides();
                        alert("Workout plan imported successfully!");
                    } else {
                        alert("Invalid plan format. Must be a valid JSON array.");
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
            if (plan.length === 0) { alert("Plan is empty!"); return; }
            const safeB64 = btoa(unescape(encodeURIComponent(JSON.stringify(plan))));
            
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
                const importedPlan = JSON.parse(decodeURIComponent(escape(atob(code))));
                if (Array.isArray(importedPlan)) {
                    plan = importedPlan;
                    savePlan();
                    renderManageList();
                    buildWorkoutSlides();
                    syncCodeInput.value = "";
                    alert("PWA Sync successful! Plan loaded.");
                } else {
                    alert("Invalid code format.");
                }
            } catch (e) {
                alert("Error parsing sync code. Make sure you copied the entire string without any spaces.");
            }
        });
    }

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
    const regExp = /^.*((youtu.be\/)|(v\/)|(\/u\/\w\/)|(embed\/)|(watch\?))\??v?=?([^#&?]*).*/;
    const match = url.match(regExp);
    if (match && match[7].length == 11) {
        videoId = match[7];
    }
    
    // Extract t= parameter
    const urlParams = new URL(url.replace('#', '?')).searchParams; // Handle #t= too
    if (urlParams.has('t')) {
        let tStr = urlParams.get('t');
        if (tStr.includes('s')) {
            startTime = parseInt(tStr.replace('s', ''));
        } else {
            startTime = parseInt(tStr);
        }
    }
    
    return { videoId, startTime: isNaN(startTime) ? 0 : startTime };
}

function addExercise() {
    const url = ytLinkInput.value.trim();
    const name = exerciseNameInput.value.trim() || "Exercise";
    const duration = parseInt(durationInput.value) || 10;
    const sets = parseInt(targetSetsInput.value) || 4;
    const rest = parseInt(restIntervalInput.value) || 30;

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
                rest
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
            rest
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
    durationInput.value = ex.duration;
    targetSetsInput.value = ex.sets;
    restIntervalInput.value = ex.rest;
    
    btnAddExercise.innerText = "Save Changes";
    
    // Smooth scroll to top
    manageView.scrollTo({ top: 0, behavior: 'smooth' });
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
        li.innerHTML = `
            <div class="ex-details">
                <h4>${index + 1}. ${ex.name}</h4>
                <p>${ex.duration}s loop • ${ex.sets} sets • ${ex.rest}s rest</p>
            </div>
            <div class="list-actions">
                <button class="action-btn edit-btn" onclick="editExercise('${ex.id}')">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                </button>
                <button class="action-btn delete-btn" onclick="removeExercise('${ex.id}')">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M10 11v6M14 11v6"/></svg>
                </button>
            </div>
        `;
        exerciseList.appendChild(li);
    });
}

function savePlan() {
    localStorage.setItem('repmax_plan', JSON.stringify(plan));
}

// --- STORAGE LOGIC ---
function loadPlan() {
    // Check if there is a shared plan payload in the URL
    const urlParams = new URLSearchParams(window.location.search);
    const sharedData = urlParams.get('plan');
    if (sharedData) {
        try {
            // Decode the safe base64
            const importedPlan = JSON.parse(decodeURIComponent(escape(atob(sharedData))));
            if (Array.isArray(importedPlan)) {
                localStorage.setItem('repmax_plan', JSON.stringify(importedPlan));
                // Clean the URL so it doesn't stay there if we refresh
                window.history.replaceState({}, document.title, window.location.pathname);
                alert("Shared workout plan loaded successfully!");
            }
        } catch(e) {
            console.error("Invalid shared plan payload.");
            alert("The shared workout link is invalid or corrupted.");
        }
    }

    const saved = localStorage.getItem('repmax_plan');
    if (saved) {
        try {
            plan = JSON.parse(saved);
        } catch (e) {
            plan = [];
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
                <div class="slide-stats" id="stats-${ex.id}">Set 1 of ${ex.sets}</div>
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
        players[0].seekTo(plan[0].startTime);
        players[0].playVideo();
    }

    workoutScrollContainer.scrollTo(0, 0);
    startPolling();
}

function onPlayerReady(event) {
    event.target.mute(); // Mute by default as per requirements
    // If this is the first player, play it
    const index = Object.keys(players).find(k => players[k] === event.target);
    if (index == currentWorkoutIndex && workoutActive) {
        event.target.playVideo();
    }
}

function handleScrollEnd() {
    isScrolling = false;
    if (!workoutActive) return;
    
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
        
        // Play new video
        if (players[currentWorkoutIndex] && players[currentWorkoutIndex].playVideo) {
            players[currentWorkoutIndex].seekTo(plan[currentWorkoutIndex].startTime);
            players[currentWorkoutIndex].playVideo();
        }
    }
}

// Polling for loop logic
function startPolling() {
    if (poller) clearInterval(poller);
    
    poller = setInterval(() => {
        if (!workoutActive || restTimerOverlay.classList.contains('hidden') === false || isScrolling) return;

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
        // Sets remaining
        player.pauseVideo();
        startRestTimer(ex.rest, false);
    } else {
        // Sets completed for this exercise
        player.pauseVideo();
        
        if (currentWorkoutIndex < plan.length - 1) {
            // More exercises left in the plan
            // Trigger the rest timer before we scroll to the next exercise
            startRestTimer(ex.rest, true);
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
