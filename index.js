require('dotenv').config();

const qrcode = require('qrcode');
const fs = require('fs');
const path = require('path');
const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const pdfParse = require('pdf-parse');
const ai = require('./gemini');
const formatter = require('./responseFormatter');
const { downloadVideo } = require('./tools/ytdl');
const { getPendingDownload, removePendingDownload, hasPendingDownload } = require('./downloadQueue');

const client = new Client({
  authStrategy: new LocalAuth(),
  puppeteer: {
    headless: true,
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    timeout: 180000,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--disable-blink-features=AutomationControlled',
      '--disable-web-resources',
      '--disable-media-session-api',
      '--mute-audio'
    ]
  }
});

// Debug output
console.log('⏳ Starting WhatsApp Bot...');
console.log('Initializing client connection...');

// Error handling
client.on('error', (error) => {
  console.error('Client error:', error.message);
});

process.on('unhandledRejection', (error) => {
  console.error('Unhandled rejection:', error && error.message ? error.message : error);
});

client.on('qr', (qr) => {
  console.log('QR Code generated! Saving to qr.png...');
  qrcode.toFile('./qr.png', qr, (err) => {
    if (err) {
      console.error('Error saving QR:', err);
      console.log('QR Code (try copying to browser):');
      console.log(qr);
    } else {
      console.log('✓ QR Code saved to: qr.png');
      console.log('Instructions:');
      console.log('1. Open qr.png file (in this project folder)');
      console.log('2. Scan with WhatsApp (Settings → Linked Devices → Link Device)');
    }
  });
});

client.on('ready', () => {
  console.log('WhatsApp ready');
});

client.on('message', async (msg) => {
  const sender = (msg.author || msg.from || '').replace(/@(c|g)\.us$/, '');
  const text = msg.body || '';
  
  // Helper function to truncate for WhatsApp (4096 char limit)
  function truncateForWhatsApp(text, maxLength = 4096) {
    if (!text || text.length <= maxLength) return text;
    return text.substring(0, maxLength - 3) + '...';
  }
  
  // Ignore system messages
  if (msg.type === 'notification_group_admin' || msg.type === 'notification_group_create' || msg.type === 'notification_group_remove' || msg.type === 'notification_group_add') {
    return;
  }
  
  // Ignore channel messages
  if (msg.from && msg.from.includes('@newsletter')) {
    console.log(`⊘ Ignoring channel message`);
    return;
  }
  
  // Check for help command (respond to this even if not mentioned)
  if (text.toLowerCase().includes('/help') || text.toLowerCase() === 'help') {
    const helpMsg = formatter.helpMenu();
    msg.reply(helpMsg);
    console.log(`📖 Help command sent to: ${sender}`);
    return;
  }

  // ========================
  // PDF Document Handling
  // ========================
  if (msg.hasMedia && (msg.type === 'document' || msg.mime === 'application/pdf')) {
    console.log(`📄 PDF document received from ${sender}`);
    
    try {
      // Download the media
      const media = await msg.downloadMedia();
      
      if (!media) {
        msg.reply('❌ Failed to download PDF');
        return;
      }

      // Get file name from message
      const fileName = msg.filename || 'document.pdf';
      
      // Send processing message
      msg.reply(formatter.pdfProcessing(fileName, 'calculating...'));

      // Parse PDF
      const pdfBuffer = Buffer.from(media.data, 'base64');
      const pdfData = await pdfParse(pdfBuffer);
      
      if (!pdfData.text || pdfData.text.trim().length === 0) {
        msg.reply(formatter.pdfError('empty'));
        console.log(`⚠️  No text extracted from PDF: ${fileName}`);
        return;
      }

      console.log(`✓ Extracted ${pdfData.text.length} characters from PDF`);
      console.log(`📊 PDF has ${pdfData.numpages} pages`);

      // Summarize the PDF content
      const summary = await ai.summarizePDF(pdfData.text, fileName);

      // Format the response with statistics
      const wordCount = Math.round(pdfData.text.split(/\s+/).length);
      const summaryMsg = formatter.pdfSummary(fileName, summary, pdfData.numpages, wordCount);
      
      console.log(`✅ PDF summary sent for: ${fileName}`);
      msg.reply(truncateForWhatsApp(summaryMsg));
      return;
      
    } catch (err) {
      const errMsg = err && err.message ? err.message : String(err);
      console.error('PDF processing error:', errMsg);
      
      let friendlyMsg = `❌ **PDF Processing Failed**\n\n⚠️ Error: ${errMsg.substring(0, 80)}`;
      
      if (errMsg.includes('encrypted') || errMsg.includes('password')) {
        friendlyMsg = formatter.pdfError('encrypted');
      } else if (errMsg.includes('not a pdf') || errMsg.includes('invalid')) {
        friendlyMsg = formatter.pdfError('invalid');
      }
      
      msg.reply(friendlyMsg);
      return;
    }
  }
  
  // Check if message is from a group
  const isGroup = msg.isGroupMsg;
  
  // Bot responds ONLY if explicitly mentioned/tagged in groups
  if (isGroup) {
    // Check if bot is mentioned (has @mentions)
    const isBotMentioned = msg.mentionedIds && msg.mentionedIds.length > 0;
    
    // Check if message is a reply/quote to bot's previous message
    let isBotQuoted = false;
    if (msg.hasQuotedMsg) {
      try {
        const quoted = msg.quotedMsg;
        isBotQuoted = quoted && (quoted.type === 'chat' || quoted.type === 'image' || quoted.type === 'video' || quoted.type === 'document');
      } catch (e) {
        isBotQuoted = false;
      }
    }
    
    // Only respond if explicitly mentioned
    if (!isBotMentioned && !isBotQuoted) {
      console.log(`⊘ Ignoring group message (not mentioned): ${sender}: ${text.substring(0, 50)}`);
      return;
    }
    console.log(`✓ Group message with mention: ${sender}: ${text}`);
  } else {
    // Direct messages: ALWAYS respond to DMs
    console.log(`💬 Direct message: ${sender}: ${text}`);
  }

  // Check if user is responding to a pending download request
  if (hasPendingDownload(sender)) {
    const pendingDownload = getPendingDownload(sender);
    const userChoice = text.toLowerCase().trim();
    
    if (userChoice === 'video' || userChoice === 'mp4' || userChoice.includes('video')) {
      // User chose video
      console.log(`📹 User chose VIDEO format`);
      removePendingDownload(sender);
      
      try {
        msg.reply(`📹 **Downloading Video...**\n⏳ Processing your video request\n_Downloading... 0%_`);
        
        const filePath = await downloadVideo(pendingDownload.url, 'video');
        
        console.log(`📹 Sending video file: ${path.basename(filePath)}`);
        const fileBuffer = fs.readFileSync(filePath);
        const fileSize = (fileBuffer.length / (1024 * 1024)).toFixed(2);
        console.log(`   File size: ${fileSize}MB`);
        const media = new MessageMedia('video/mp4', fileBuffer.toString('base64'), path.basename(filePath));
        msg.reply(media);
        console.log(`✓ Video sent successfully`);
        setTimeout(() => {
          try { 
            fs.unlinkSync(filePath);
            console.log(`🗑️  Cleaned up temp file: ${filePath}`);
          } catch (e) {}
        }, 10000);
        return;
      } catch (err) {
        const errorMsg = err && err.message ? err.message : String(err);
        let friendlyMsg = `❌ **Download Failed**`;
        
        if (errorMsg.includes('larger than max-filesize') || errorMsg.includes('16M')) {
          friendlyMsg = `❌ **File Too Large** 📁\n\n📹 The video file exceeds 16MB limit\n\n💡 **Try this:**\n• Choose a shorter video\n• Select a lower quality\n• Try a different video`;
        } else if (errorMsg.includes('Private')) {
          friendlyMsg = `❌ **Cannot Download** 🔒\n\n📺 This video is set to private\n\n💡 **What to do:**\n• Check if you have access\n• Ask the creator to make it public\n• Try a different video`;
        } else if (errorMsg.includes('not found') || errorMsg.includes('not available')) {
          friendlyMsg = `❌ **Video Not Found** 🔍\n\n📺 This video is no longer available\n\n💡 **Possible reasons:**\n• Video was deleted\n• Link is broken\n• Video is region-blocked`;
        } else if (errorMsg.includes('format')) {
          friendlyMsg = `❌ **Format Error** 🎬\n\n⚠️ Cannot download in this format\n\n💡 **Try:**\n• Downloading as MP3 instead\n• Try a different video`;
        } else {
          friendlyMsg = `❌ **Download Error**\n\n⚠️ ${errorMsg.substring(0, 80)}\n\n💡 Please try again`;
        }
        msg.reply(friendlyMsg);
        console.error('Video download error:', errorMsg);
        return;
      }
    } else if (userChoice === 'mp3' || userChoice === 'audio' || userChoice === 'song' || userChoice.includes('audio')) {
      // User chose audio/mp3
      console.log(`🎵 User chose MP3 format`);
      removePendingDownload(sender);
      
      try {
        msg.reply(`🎵 **Extracting Audio...**\n⏳ Processing your audio request\n_Downloading... 0%_`);
        
        const filePath = await downloadVideo(pendingDownload.url, 'mp3');
        
        console.log(`🎵 Sending audio file: ${path.basename(filePath)}`);
        const fileBuffer = fs.readFileSync(filePath);
        const fileSize = (fileBuffer.length / (1024 * 1024)).toFixed(2);
        console.log(`   File size: ${fileSize}MB`);
        const media = new MessageMedia('audio/mpeg', fileBuffer.toString('base64'), path.basename(filePath));
        msg.reply(media);
        console.log(`✓ Audio sent successfully`);
        setTimeout(() => {
          try { 
            fs.unlinkSync(filePath);
            console.log(`🗑️  Cleaned up temp file: ${filePath}`);
          } catch (e) {}
        }, 10000);
        return;
      } catch (err) {
        const errorMsg = err && err.message ? err.message : String(err);
        let friendlyMsg = `❌ **Download Failed**`;
        
        if (errorMsg.includes('larger than max-filesize') || errorMsg.includes('16M')) {
          friendlyMsg = `❌ **File Too Large** 📁\n\n🎵 The audio file exceeds 16MB limit\n\n💡 **Try this:**\n• Choose a shorter audio\n• Select a different quality\n• Try a different video`;
        } else if (errorMsg.includes('Private')) {
          friendlyMsg = `❌ **Cannot Download** 🔒\n\n📺 This video is set to private\n\n💡 **What to do:**\n• Check if you have access\n• Ask the creator to make it public\n• Try a different video`;
        } else if (errorMsg.includes('not found') || errorMsg.includes('not available')) {
          friendlyMsg = `❌ **Video Not Found** 🔍\n\n📺 This video is no longer available\n\n💡 **Possible reasons:**\n• Video was deleted\n• Link is broken\n• Video is region-blocked`;
        } else if (errorMsg.includes('format')) {
          friendlyMsg = `❌ **Format Error** 🎬\n\n⚠️ Cannot extract audio in this format\n\n💡 **Try:**\n• Downloading as VIDEO instead\n• Try a different video`;
        } else {
          friendlyMsg = `❌ **Download Error**\n\n⚠️ ${errorMsg.substring(0, 80)}\n\n💡 Please try again`;
        }
        msg.reply(friendlyMsg);
        console.error('Audio download error:', errorMsg);
        return;
      }
    } else {
      // Invalid response, ask again
      const askMsg = `❌ Invalid choice!\n\n📹 Reply with: **video** or **mp3**`;
      msg.reply(askMsg);
      return;
    }
  }

  ai.sendMessage(sender, text)
    .then((reply) => {
      // Check if reply is a file path (video/image/audio)
      if (reply && typeof reply === 'string' && (reply.endsWith('.mp4') || reply.endsWith('.mkv') || reply.endsWith('.jpg') || reply.endsWith('.png') || reply.endsWith('.mp3'))) {
        try {
          if (fs.existsSync(reply)) {
            const isVideo = reply.endsWith('.mp4') || reply.endsWith('.mkv');
            const isAudio = reply.endsWith('.mp3');
            console.log(`📹 Sending media file: ${path.basename(reply)}`);
            const fileBuffer = fs.readFileSync(reply);
            const fileSize = (fileBuffer.length / (1024 * 1024)).toFixed(2);
            console.log(`   File size: ${fileSize}MB`);
            let mimeType = 'application/octet-stream';
            if (isVideo) mimeType = 'video/mp4';
            else if (isAudio) mimeType = 'audio/mpeg';
            else if (reply.endsWith('.jpg')) mimeType = 'image/jpeg';
            else if (reply.endsWith('.png')) mimeType = 'image/png';
            
            const media = new MessageMedia(mimeType, fileBuffer.toString('base64'), path.basename(reply));
            msg.reply(media);
            console.log(`✓ Media sent successfully`);
            // Clean up temp file after sending (longer delay for upload)
            setTimeout(() => {
              try { 
                fs.unlinkSync(reply);
                console.log(`🗑️  Cleaned up temp file: ${reply}`);
              } catch (e) {}
            }, 10000);
            return;
          } else {
            console.warn(`⚠️  File not found: ${reply}`);
            msg.reply(`❌ Downloaded file was not found. Please try again.`);
          }
        } catch (err) {
          console.error('Error sending media:', err.message);
          msg.reply(`❌ Error sending media: ${err.message}`);
        }
        return;
      }
      
      // Default: send as text - truncate if too long
      if (!reply || reply.length === 0) {
        msg.reply('⚠️ No response generated. Please try again.');
        return;
      }
      
      console.log(`💬 Sending reply: ${reply.substring(0, 80)}...`);
      msg.reply(reply);
    })
    .catch((error) => {
      const errorMsg = error && error.message ? error.message : String(error);
      console.error('AI error:', errorMsg);
      
      let friendlyMsg = '❌ Oops! Something went wrong. Please try again in a moment.';
      if (errorMsg.includes('GOOGLE_API_KEY')) {
        friendlyMsg = '⚠️ Bot configuration error. Contact admin.';
      } else if (errorMsg.includes('timeout')) {
        friendlyMsg = '⏱️ Request took too long. Try a simpler question.';
      } else if (errorMsg.includes('rate limit')) {
        friendlyMsg = '⏱️ Too many requests. Please wait a moment and try again.';
      }
      
      msg.reply(friendlyMsg);
    });
});

client.initialize();
