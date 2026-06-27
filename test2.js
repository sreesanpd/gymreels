const jsdom = require("jsdom");
const { JSDOM } = jsdom;
const fs = require('fs');

const html = fs.readFileSync('index.html', 'utf8');
const js = fs.readFileSync('app.js', 'utf8');

const dom = new JSDOM(html, { runScripts: "dangerously" });

// Polyfill window functions
dom.window.alert = console.log;
dom.window.prompt = console.log;
dom.window.confirm = () => true;

// Mock localStorage
dom.window.localStorage = {
    data: {},
    getItem(key) { return this.data[key] || null; },
    setItem(key, val) { this.data[key] = val; }
};

dom.window.document.addEventListener('DOMContentLoaded', () => {
    try {
        console.log("DOMContentLoaded fired!");
        
        // Add an exercise
        dom.window.document.getElementById('yt-link').value = "https://youtube.com/watch?v=dQw4w9WgXcQ";
        dom.window.document.getElementById('btn-add-exercise').click();
        
        // Let's check innerHTML of workoutScrollContainer
        const container = dom.window.document.getElementById('workout-scroll-container');
        console.log("Slides in container:", container.querySelectorAll('.workout-slide').length);
        
        // Click sound off
        const btn = dom.window.document.getElementById('btn-toggle-sound');
        if (!btn) {
            console.log("BTN IS NULL!");
        } else {
            console.log("Button text before:", btn.innerHTML);
            btn.click();
            console.log("Button text after:", btn.innerHTML);
        }
    } catch (e) {
        console.error("Test error:", e);
    }
});

try {
    const script = dom.window.document.createElement('script');
    script.textContent = js;
    dom.window.document.body.appendChild(script);
    dom.window.document.dispatchEvent(new dom.window.Event('DOMContentLoaded'));
} catch (e) {
    console.error("Global crash:", e);
}
