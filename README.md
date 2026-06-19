# GymReels 🏋️‍♀️📱

GymReels is an immersive, TikTok-style workout companion app that lets you build, manage, and seamlessly play your fitness routines using standard YouTube videos. 

Say goodbye to annoying ads and complex interfaces—GymReels perfectly crops and aligns your favorite YouTube exercises into a beautifully smooth, full-screen vertical swipe experience.

## ✨ Features

- **Hands-Free Auto-Scrolling:** When your rest timer finishes, the app automatically scrolls to the next exercise and starts playing! No need to manually swipe or touch your phone during your workout.
- **Custom Workout Builder:** Paste any YouTube link, define your target duration, set counts, and rest times.
- **Smart Rest Timers:** The app automatically pauses the video and overlays a full-screen rest countdown between your sets.
- **WhatsApp Syncing:** Generate a secure "Sync Code" link that you can instantly share via WhatsApp. Clicking the link automatically loads the entire workout plan!
- **Progressive Web App (PWA):** Install GymReels directly to your iOS or Android home screen for a completely native, full-screen app experience.
- **Screen Wake Lock API:** Your screen will never dim or fall asleep during your workout, even during long 60-second rest timers!
- **Toggle View Mode:** Swap instantly between immersive Portrait (cropped) and native Landscape (letterboxed) modes to prevent instructors' heads from being cut off.

## 🚀 Getting Started

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

## 🛠️ Technology Stack
- Vanilla HTML, CSS, and JavaScript
- YouTube IFrame API
- Screen Wake Lock API
- Modern CSS Container Queries
- Base64 URL Encoding (for stateless WhatsApp sharing)

## 📝 License
This project is open-source and available under the MIT License.
