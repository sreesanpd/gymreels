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

dom.window.document.addEventListener('DOMContentLoaded', () => {
    try {
        console.log("DOMContentLoaded fired!");
        // dispatch events or simulate clicks to test
    } catch (e) {
        console.error(e);
    }
});

try {
    // Inject script
    const script = dom.window.document.createElement('script');
    script.textContent = js;
    dom.window.document.body.appendChild(script);
    
    console.log("Script executed without crashing globally.");
    
    // Trigger DOMContentLoaded
    dom.window.document.dispatchEvent(new dom.window.Event('DOMContentLoaded'));
} catch (e) {
    console.error("Global crash:", e);
}
