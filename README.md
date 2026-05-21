# WhatsApp AI Bot with Gemini

A fully functional WhatsApp AI assistant powered by Google Gemini with tool calling capabilities (Google Search, video download, and more).

## Features

- **WhatsApp Integration**: Connects via `whatsapp-web.js` with QR code authentication
- **Gemini AI**: Uses Google's free Gemini 2.5 Flash model for intelligent replies
- **Per-User Memory**: SQLite conversation history (last 20 messages per user)
- **Tool Calling**: Extensible tool system with:
  - `echo_test`: Test tool
  - `google_search`: Search Google (via SerpAPI)
  - `download_video`: Download videos from YouTube, Vimeo, etc. (via yt-dlp)
- **Media Sending**: Automatically sends downloaded videos as WhatsApp messages

## Prerequisites

- **Node.js 18+** (CommonJS)
- **Python 3** (for yt-dlp)
- **yt-dlp** (YouTube downloader)
- Google API key (free tier) with Generative Language API enabled
- SerpAPI key (free tier signup: https://serpapi.com/sign-up)

## Installation

### 1. Clone/Setup

```bash
cd whatsappbot
npm install
```

### 2. Install System Dependencies

#### **Windows** (using Chocolatey or manual install)
```powershell
# Install yt-dlp via pip
pip install yt-dlp
```

#### **macOS**
```bash
brew install yt-dlp
```

#### **Ubuntu/Debian**
```bash
sudo apt-get update
sudo apt-get install -y python3 python3-pip
pip3 install yt-dlp
```

### 3. Setup Environment Variables

Create a `.env` file in the project root:

```env
GOOGLE_API_KEY=your_google_api_key_here
SERPAPI_KEY=your_serpapi_key_here
GEMINI_MODEL=gemini-2.5-flash
```

**Get your keys:**
- **Google API Key**: https://ai.google.dev (free tier available)
- **SerpAPI Key**: https://serpapi.com/sign-up (free tier: 100 queries/month)

### 4. Run the Bot

```bash
npm start
```

You'll see:
1. A QR code in the terminal
2. Scan with WhatsApp (Settings > Linked Devices > Link a Device)
3. "WhatsApp ready" message when connected

## Project Structure

```
whatsappbot/
├── index.js              # Main WhatsApp client
├── gemini.js             # Gemini AI wrapper
├── session.js            # Conversation memory (SQLite/in-memory)
├── package.json          # Dependencies
├── .env                  # API keys (git-ignored)
├── tools/
│   ├── index.js          # Tool registry
│   ├── dispatcher.js     # Tool executor
│   ├── googleSearch.js   # Google Search via SerpAPI
│   └── ytdl.js           # Video downloader via yt-dlp
└── README.md             # This file
```

## Usage

Send messages to the bot and it will:
- Understand context (remembers conversation history)
- Respond intelligently
- Call tools when appropriate (e.g., "Search for latest AI news" → uses `google_search`)
- Download and send videos (e.g., "Download [YouTube URL]")

## Testing Tools Locally

### Test Google Search
```bash
node test_google.js "your search query"
```

### Test Gemini
```bash
node test_gemini.js
```

### List Available Gemini Models
```bash
node list_models.js
```

## Deployment (Ubuntu VPS)

### 1. Fresh Ubuntu 22.04 Server Setup

```bash
# Update system
sudo apt-get update && sudo apt-get upgrade -y

# Install Node.js 18+
curl -sL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install Python & yt-dlp
sudo apt-get install -y python3 python3-pip
pip3 install yt-dlp

# Install Chromium (for whatsapp-web.js)
sudo apt-get install -y chromium-browser

# Install PM2 (process manager)
sudo npm install -g pm2
```

### 2. Deploy Project

```bash
# Clone your project
git clone <your-repo> whatsappbot
cd whatsappbot

# Install dependencies
npm install

# Create .env with keys
nano .env
# Add GOOGLE_API_KEY, SERPAPI_KEY

# Test run
node index.js
# Scan QR code with WhatsApp
```

### 3. Setup PM2 Daemon

```bash
# Start bot with PM2
pm2 start index.js --name whatsapp-bot

# Make it restart on reboot
pm2 startup
pm2 save

# View logs
pm2 logs whatsapp-bot

# Restart bot
pm2 restart whatsapp-bot

# Status
pm2 status
```

### 4. Handle Headless QR Code

On a VPS without a display, save the QR code to a file:

Edit `index.js` QR handler:
```js
client.on('qr', (qr) => {
  // Save to file instead of terminal
  const QRCode = require('qrcode');
  QRCode.toFile('./qr.png', qr, (err) => {
    if (err) console.error(err);
    else console.log('QR code saved to qr.png');
  });
});
```

Then download the `qr.png` file:
```bash
scp user@server:/path/to/whatsappbot/qr.png ./
# Open locally and scan with WhatsApp
```

### 5. Health Check Script

Create `health-check.js`:
```js
const http = require('http');

setInterval(() => {
  http.get('http://localhost:3000/health', (res) => {
    if (res.statusCode !== 200) {
      console.error('Bot health check failed');
      process.exit(1);
    }
  }).on('error', () => {
    console.error('Bot not responding');
    process.exit(1);
  });
}, 60000);
```

Run with PM2:
```bash
pm2 start health-check.js
```

## Troubleshooting

### Bot not responding to messages
```bash
pm2 logs whatsapp-bot  # Check for errors
pm2 restart whatsapp-bot
```

### yt-dlp errors
```bash
# Update yt-dlp
pip install --upgrade yt-dlp

# Test download
yt-dlp -f "best[filesize<15M]" -o "test.mp4" "https://youtube.com/watch?v=..."
```

### Google API returns 404
```bash
# Check available models
node list_models.js

# Ensure Generative Language API is enabled
# https://console.cloud.google.com/apis/library/generative-language.googleapis.com
```

## Performance Notes

- Gemini 2.5 Flash: Fast, ideal for real-time chat
- Gemini 2.5 Pro: More capable, slower
- Video downloads: Limited to 15MB (WhatsApp limit)
- SQLite: ~1MB per 1000 messages (auto-trims to last 20 per user)

## Next Steps

1. **Custom Tools**: Add more tools in `tools/` folder and register in `tools/index.js`
2. **Image Support**: Integrate Google Vision API for image analysis
3. **Web Scraping**: Add Cheerio/Puppeteer for advanced scraping
4. **Database**: Replace SQLite with PostgreSQL for larger deployments
5. **Rate Limiting**: Add per-user/per-group rate limits

## License

MIT

## Support

For issues:
1. Check `pm2 logs whatsapp-bot`
2. Run test scripts: `node test_gemini.js`
3. Verify `.env` file has all required keys
