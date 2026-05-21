const fs = require('fs');
// Load SERPAPI_KEY from .env if dotenv is not installed
if (!process.env.SERPAPI_KEY) {
  try {
    const env = fs.readFileSync('.env', 'utf8');
    const m = env.match(/SERPAPI_KEY=(.+)/);
    if (m) process.env.SERPAPI_KEY = m[1].trim();
  } catch (e) {
    // ignore
  }
}

const { search } = require('./tools/googleSearch');

(async () => {
  try {
    const q = process.argv[2] || 'latest news about AI';
    console.log('Searching SerpAPI for:', q);
    const res = await search(q);
    console.log('\n--- Search Result ---\n');
    console.log(res);
  } catch (err) {
    console.error('Search test failed:', err && err.message ? err.message : err);
    process.exit(1);
  }
})();
