# GymReels 🏋️‍♀️📱

GymReels is an immersive, TikTok-style workout companion app that lets you build, manage, and seamlessly play your fitness routines using standard YouTube videos. 

Say goodbye to complex fitness apps—GymReels perfectly crops and aligns your favorite YouTube exercises into a beautifully smooth, full-screen vertical swipe experience.

## ✨ Features

- **Hands-Free Auto-Scrolling:** When your rest timer finishes, the app automatically scrolls to the next exercise and starts playing! No need to manually swipe or touch your phone during your workout.
- **Multiple Workout Plans:** Create and manage distinct workout routines (e.g., "Leg Day", "Push Day"). Switch between them instantly.
- **Drag & Drop Reordering:** Smooth, touch-friendly UI for reordering your exercises in a flash (powered by SortableJS).
- **Custom Workout Builder:** Paste any YouTube link (including Shorts), define your target duration, set counts, and distinct rest times (between sets vs. after an exercise).
- **Smart Rest Timers:** The app automatically pauses the video and overlays a full-screen rest countdown between your sets.
- **Library Syncing & Sharing:** Generate a secure "Sync Code" to backup your entire workout library and transfer it to a mobile PWA, or easily share individual workout plans with friends via WhatsApp.
- **Progressive Web App (PWA):** Install GymReels directly to your iOS or Android home screen for a completely native, full-screen app experience.
- **Screen Wake Lock:** Your screen will never dim or fall asleep during your workout, even during long 60-second rest timers, utilizing a robust `NoSleep.js` fallback!
- **Toggle View Mode:** Swap instantly between immersive Portrait (cropped) and native Landscape (letterboxed) modes to prevent instructors' heads from being cut off.

## 🚀 Getting Started / Onboarding

GymReels runs entirely in the browser using the YouTube IFrame API and HTML5 Local Storage. No database or backend server is required!

### Hosting on GitHub Pages
Because there is no backend, you can host GymReels for free using GitHub Pages:

1. Fork or clone this repository.
2. Go to your repository **Settings** > **Pages**.
3. Under **Build and deployment**, set the Source to **Deploy from a branch**.
4. Select the `master` (or `main`) branch and save.
5. Your app will be live and ready to use in about a minute!

### Installing on iOS (Home Screen)
1. Navigate to your live GitHub Pages URL in **Safari**.
2. Tap the **Share** button at the bottom of the screen.
3. Tap **Add to Home Screen**.
4. Launch GymReels from your home screen to enjoy the immersive, URL-bar-free experience!
5. **To sync your workouts:** On your Desktop, click "Copy Sync Code", copy the resulting text, and paste it into the "PWA Sync" input on your phone to instantly restore your entire library!

### 💡 Pro Tip: Removing Ads
Because GymReels uses the official YouTube IFrame API, **YouTube ads may play** before your workout videos if you are not signed in. To completely remove ads for a seamless workout experience, you can either:
- **Use YouTube Premium:** Ensure you are signed into your YouTube account in the browser you use to create the PWA (e.g., Safari on iOS). The PWA will inherit your ad-free session!
- **Use an Ad-Blocking Browser:** Alternatively, use a mobile browser like Brave that automatically strips YouTube ads natively.

## 🛠️ Technology Stack
- Vanilla HTML, CSS, and JavaScript
- YouTube IFrame API
- Screen Wake Lock API + NoSleep.js
- SortableJS (for mobile-friendly reordering)
- Modern CSS Container Queries
- Base64 URL Encoding (for stateless WhatsApp sharing)

## 🧑‍💻 Development & Architecture
If you are looking to contribute to the codebase or understand the underlying technical decisions and bug fixes, please see [DEVELOPMENT.md](DEVELOPMENT.md).

## 📝 License
This project is open-source and available under the MIT License.
