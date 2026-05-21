// Professional Response Formatter for WhatsApp Bot

const formatters = {
  // Header with emoji and title
  header: (emoji, title) => {
    return `${emoji} *${title}*`;
  },

  // Section divider
  divider: () => {
    return '━━━━━━━━━━━━━━━━━━━━━━━━━';
  },

  // Help/Commands
  helpMenu: () => {
    return `${formatters.header('📚', 'WhatsApp AI Bot')}
${formatters.divider()}

*Available Features:*
• 💬 Chat & Conversations
• 🔍 Google Search
• 📹 Video Downloads
• 📄 PDF Summarization
• 💾 Chat Memory

${formatters.divider()}

*Quick Commands:*
1️⃣ Text Questions - Ask me anything
2️⃣ Search - Say "search for [topic]"
3️⃣ Videos - Send YouTube link + "download"
4️⃣ PDFs - Upload any PDF document
5️⃣ Help - Type /help anytime

${formatters.divider()}

*Example Requests:*
📌 "What is artificial intelligence?"
📌 "Search for latest tech news"
📌 "Download this YouTube video"
📌 "Summarize this PDF"

Type any command or ask a question! 😊`;
  },

  // PDF Processing Response
  pdfProcessing: (fileName, pages) => {
    return `${formatters.header('📄', 'Processing Document')}

*File:* ${fileName}
*Pages:* ${pages}

⏳ Extracting text and generating summary...
${formatters.divider()}
_Please wait, this may take a moment..._`;
  },

  // PDF Summary Response
  pdfSummary: (fileName, summary, pages, words) => {
    return `${formatters.header('📄', 'Document Summary')}

*File:* ${fileName}
${formatters.divider()}

${summary}

${formatters.divider()}

📊 *Stats:*
• Pages: ${pages}
• Words: ~${words}
• Processed: ✅

_Need more details? Ask me specific questions about this document!_`;
  },

  // PDF Error Response
  pdfError: (errorType) => {
    const errors = {
      'encrypted': `${formatters.header('🔒', 'PDF is Password Protected')}

❌ Cannot access this PDF - it requires a password.

${formatters.divider()}

*Solutions:*
1. Remove the password protection
2. Ask the creator for the unprotected version
3. Try a different PDF

Need help? Reply with "help"`,
      'invalid': `${formatters.header('❌', 'Invalid PDF File')}

This doesn't appear to be a valid PDF file.

${formatters.divider()}

*Verify:*
✓ File is in PDF format
✓ File is not corrupted
✓ File size < 10MB

Try uploading again!`,
      'empty': `${formatters.header('⚠️', 'No Text Found')}

This PDF contains no readable text (possibly images only).

${formatters.divider()}

*Solutions:*
• PDF with text content
• Not image-only PDFs
• OCR-processed documents

Try a different PDF!`
    };
    return errors[errorType] || `❌ Error processing PDF. Please try again.`;
  },

  // Video Download Response
  videoDownloading: (format) => {
    const formatName = format === 'mp3' ? '🎵 Audio (MP3)' : '📹 Video (MP4)';
    return `${formatters.header('⏳', 'Downloading Media')}

*Format:* ${formatName}
${formatters.divider()}

🔄 Preparing download...
📦 Retrieving file...
⏬ Processing content...

_Estimated time: 10-30 seconds_`;
  },

  // Video Download Success
  videoSuccess: (format, size) => {
    const emoji = format === 'mp3' ? '🎵' : '📹';
    const type = format === 'mp3' ? 'Audio' : 'Video';
    return `${formatters.header('✅', `${type} Ready`)}

${emoji} *${type} Downloaded Successfully!*
${formatters.divider()}

📊 *File Details:*
• Type: ${type}
• Size: ${size}MB
• Quality: Best available

📤 Sending to WhatsApp...
_This will arrive in a moment!_`;
  },

  // Video Error Response
  videoError: (errorType) => {
    const errors = {
      'too_large': `${formatters.header('📁', 'File Too Large')}

❌ This file exceeds WhatsApp's 16MB limit.

${formatters.divider()}

*Solutions:*
1. Download a shorter video
2. Choose lower quality
3. Try a different video

Try again! 🎬`,
      'private': `${formatters.header('🔒', 'Video is Private')}

❌ This video is not publicly available.

${formatters.divider()}

*What to do:*
• Check your access
• Ask creator to make it public
• Try another video

Need help? Ask me!`,
      'not_found': `${formatters.header('🔍', 'Video Not Found')}

❌ This video is no longer available.

${formatters.divider()}

*Possible Reasons:*
🗑️ Video was deleted
🚫 Link is broken
🌍 Region blocked
⏰ Video removed

Try another link!`,
      'generic': `${formatters.header('❌', 'Download Failed')}

Something went wrong downloading this media.

${formatters.divider()}

*Try:*
• Check the link is valid
• Use a different video
• Wait and try again

Having issues? Type /help`
    };
    return errors[errorType] || errors['generic'];
  },

  // Search Results Response
  searchResults: (query, results) => {
    return `${formatters.header('🔍', 'Search Results')}

*Query:* "${query}"
${formatters.divider()}

${results}

${formatters.divider()}

_Found what you needed? Ask me follow-up questions!_`;
  },

  // Video Format Choice
  videoFormatChoice: () => {
    return `${formatters.header('🎥', 'Choose Format')}

Which format would you like?

${formatters.divider()}

*Option 1:* 📹 *VIDEO*
• MP4 format
• Both video & audio
• Reply: "video" or "mp4"

*Option 2:* 🎵 *AUDIO*
• MP3 format
• Audio only (smaller)
• Reply: "audio" or "mp3"

${formatters.divider()}

Which one? 👇`;
  },

  // Error Generic
  error: (title, message) => {
    return `${formatters.header('❌', title)}

${message}

${formatters.divider()}

_Need help? Type /help or try again!_`;
  },

  // Success Message
  success: (title, message) => {
    return `${formatters.header('✅', title)}

${message}`;
  },

  // Processing Message
  processing: (title) => {
    return `${formatters.header('⏳', title)}

Processing your request...
_Please wait a moment..._`;
  },

  // Chat Response Header (for AI responses)
  chatResponse: (response) => {
    return response; // Keep natural for chat
  },

  // Greeting
  greeting: (name) => {
    const hour = new Date().getHours();
    const greeting = hour < 12 ? '🌅 Good Morning' : hour < 18 ? '☀️ Good Afternoon' : '🌙 Good Evening';
    return `${greeting}, ${name}! 👋

How can I help you today? 😊`;
  }
};

module.exports = formatters;
