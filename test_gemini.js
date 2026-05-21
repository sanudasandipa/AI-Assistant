// Lightweight test runner for Gemini wrapper without requiring dotenv module
const fs = require('fs');
if (!process.env.GOOGLE_API_KEY) {
  try {
    const env = fs.readFileSync('.env', 'utf8');
    const m = env.match(/GOOGLE_API_KEY=(.+)/);
    if (m) process.env.GOOGLE_API_KEY = m[1].trim();
  } catch (e) {}
}

const ai = require('./gemini');

(async () => {
  try {
    console.log('Test 1: Simple reply\n');
    const res1 = await ai.sendMessage('test-user-1', 'Say hello');
    console.log('Reply:', res1);

    console.log('\nTest 2: Tool calling (echo test)\n');
    const res2 = await ai.sendMessage('test-user-2', 'Call the echo_test tool with input "Hello from Gemini"');
    console.log('Reply:', res2);

    console.log('\nTest 3: Google Search tool\n');
    const res3 = await ai.sendMessage('test-user-3', 'Search for "latest AI news" and tell me the top result');
    console.log('Reply:', res3);
  } catch (err) {
    console.error('Gemini test failed:', err && err.message ? err.message : err);
    process.exit(1);
  }
})();
