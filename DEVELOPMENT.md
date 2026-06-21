# 🧠 Technical Decisions & Developer Gotchas

For future developers or AI agents contributing to this repository, here is a breakdown of critical architecture decisions and bug fixes. Please read this before modifying core logic.

## 1. YouTube IFrame API State Management (The "Race Condition" Bug)
* **The Issue:** The YouTube API is heavily asynchronous. When forcing a video to loop (`player.seekTo`), the API takes a few milliseconds to update its internal state. Our global `setInterval` poller was reading the state *before* the seek finished, seeing the video at the end, and falsely triggering another "Set Complete", leading to infinite loops and skipped exercises.
* **The Fix:** Implemented a debouncing mechanism (`ignorePollingUntil = Date.now() + 1500`). We explicitly halt the poller for 1.5 seconds immediately after triggering any major state change (like jumping to the next set or starting a rest timer).

## 2. iOS Safari Wake Lock API failures
* **The Issue:** The native `navigator.wakeLock` API is buggy on iOS 16.4+ and nonexistent on older versions. Because the YouTube iframe pauses during "Rest" periods, iPhones would quickly lock and go to sleep during workouts.
* **The Fix:** Implemented `NoSleep.js` as a fallback. It works by attaching a silent, 1x1 invisible HTML5 `<video>` element that loops continuously. Because the OS detects a video playing, it keeps the screen alive indefinitely.

## 3. Drag and Drop on Touch Devices
* **The Issue:** Native HTML5 drag-and-drop (`draggable="true"`) completely breaks click events on iOS Safari, rendering the "Edit" and "Delete" buttons unclickable on mobile. Furthermore, native `dragstart` events don't fire on touchscreens.
* **The Fix:** Removed native drag APIs and integrated **SortableJS**. It handles cross-platform touch emulation perfectly without hijacking the click events of child elements. A dedicated "drag handle" (☰) is used to prevent accidental dragging while scrolling.

## 4. Storage Architecture (Multi-Plan Support)
* **The Architecture:** Data is persisted in `localStorage` under `gymreels_plans`. The data structure is an Object (Dictionary) where the keys are plan names (`"Default Plan"`) and the values are Arrays of exercise objects.
* **Imports/Exports:** The app supports importing both legacy Array formats (which are loaded as a single new plan) and new Object formats (which completely overwrite/restore the entire library).

## 5. PWA Sync Code Payloads
* **The Architecture:** Because iOS Home Screen PWAs cannot open external URLs (like WhatsApp links), we allow syncing via base64 encoded strings pasted directly into the UI.
* **The Gotcha:** A plain `btoa()` call will fail on complex JSON arrays containing emojis or special characters. We must use `btoa(unescape(encodeURIComponent(JSON.stringify(data))))` to safely serialize the payload.

## 6. Service Worker Caching Traps
* **The Issue:** The app uses a network-first Service Worker with offline caching (`sw.js`). When debugging locally, the browser will persistently serve old versions of `app.js` and `index.html` from the cache even if you do a standard refresh. This can cause confusing "phantom bugs" where users test newly deployed code but execute old code.
* **The Fix:** If you modify `app.js` or `index.html`, you **MUST** bump the `CACHE_NAME` version string at the top of `sw.js` (e.g., from `v3` to `v4`). This signals the browser to invalidate the cache and pull the latest payload.

## 7. Floating UI Overlap & CSS Z-Index Stacking
* **The Issue:** Floating transparent buttons (like the `Sound Off` toggle) placed over the workout player were frequently becoming "unclickable" despite having high `z-index` values. This occurred because dynamically injected gradients (like `.slide-overlay`) were rendered *later* in the DOM tree but shared the same `z-index` stacking context, causing them to physically sit on top of the buttons like an invisible shield.
* **The Fix:** Explicitly set the UI buttons (`btn-toggle-sound`, `btn-toggle-aspect`) to an extraordinarily high `z-index` (e.g., `100`), ensuring they definitively break out of the native stacking flow and sit above all dynamically injected slides.
