const fs = require('fs');
if (!process.env.GOOGLE_API_KEY) {
  try {
    const env = fs.readFileSync('.env', 'utf8');
    const m = env.match(/GOOGLE_API_KEY=(.+)/);
    if (m) process.env.GOOGLE_API_KEY = m[1].trim();
  } catch (e) {}
}

const API_KEY = process.env.GOOGLE_API_KEY;

(async () => {
  if (!API_KEY) {
    console.error('GOOGLE_API_KEY missing');
    process.exit(1);
  }

  try {
    console.log('Fetching available models from Google API...\n');
    
    // Try v1 endpoint
    console.log('Trying v1/models endpoint...');
    let res = await fetch(`https://generativelanguage.googleapis.com/v1/models?key=${API_KEY}`);
    if (!res.ok) {
      console.log(`v1 failed: ${res.status}`);
      // Try v1beta
      console.log('Trying v1beta/models endpoint...');
      res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${API_KEY}`);
    }
    
    if (!res.ok) {
      console.error(`HTTP ${res.status}: ${await res.text()}`);
      process.exit(1);
    }

    const data = await res.json();
    const models = data.models || [];
    
    console.log(`Found ${models.length} available model(s):\n`);
    models.forEach((m) => {
      console.log(`  - ${m.name}`);
      if (m.displayName) console.log(`    (${m.displayName})`);
      if (m.supportedGenerationMethods) {
        console.log(`    Methods: ${m.supportedGenerationMethods.join(', ')}`);
      }
    });
  } catch (err) {
    console.error('Error:', err && err.message ? err.message : err);
    process.exit(1);
  }
})();
