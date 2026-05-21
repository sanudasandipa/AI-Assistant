try { require('dotenv').config(); } catch (e) { /* dotenv not installed — .env may be loaded manually */ }
const session = require('./session');
const tools = require('./tools');
const { dispatchToolCall } = require('./tools/dispatcher');
const formatter = require('./responseFormatter');
const { addPendingDownload, getPendingDownload, removePendingDownload, hasPendingDownload } = require('./downloadQueue');

const API_KEY = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
const MODEL = process.env.GEMINI_MODEL || 'gemini-3.1-flash-lite';
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GROQ_MODEL = 'llama-3.1-8b-instant'; // Stable, lightweight Groq model

if (!API_KEY) {
  // We'll throw at runtime if missing
}

// Rate limiting configuration
const RATE_LIMIT_PER_MINUTE = 12; // Leave buffer below 15 limit
const REQUEST_QUEUE = [];
let requestsThisMinute = 0;
let lastMinuteReset = Date.now();

// Request queue management
async function addToQueue(fn) {
  return new Promise((resolve, reject) => {
    REQUEST_QUEUE.push({ fn, resolve, reject });
    processQueue();
  });
}

async function processQueue() {
  // Reset counter every minute
  const now = Date.now();
  if (now - lastMinuteReset >= 60000) {
    requestsThisMinute = 0;
    lastMinuteReset = now;
  }

  if (REQUEST_QUEUE.length === 0) return;
  
  if (requestsThisMinute >= RATE_LIMIT_PER_MINUTE) {
    // Wait before processing next request
    setTimeout(processQueue, 1000);
    return;
  }

  const { fn, resolve, reject } = REQUEST_QUEUE.shift();
  requestsThisMinute++;

  try {
    const result = await fn();
    resolve(result);
  } catch (error) {
    reject(error);
  }

  // Continue processing queue
  setTimeout(processQueue, 100);
}

// Exponential backoff retry logic
async function callGeminiWithRetry(prompt, maxRetries = 3, initialDelay = 2000) {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await addToQueue(() => callGeminiDirect(prompt));
    } catch (error) {
      const errorMsg = error.message || '';
      const is429 = errorMsg.includes('429') || errorMsg.includes('Too Many Requests') || errorMsg.includes('RESOURCE_EXHAUSTED');
      
      if (!is429 || attempt === maxRetries - 1) {
        throw error;
      }

      // Exponential backoff: 2s, 4s, 8s
      const delayMs = initialDelay * Math.pow(2, attempt);
      console.log(`⏳ Rate limit hit. Retrying in ${delayMs / 1000}s (attempt ${attempt + 1}/${maxRetries - 1})`);
      await new Promise(r => setTimeout(r, delayMs));
    }
  }
}

async function callGeminiDirect(prompt) {
  if (!API_KEY) throw new Error('GOOGLE_API_KEY is missing from .env');

  const modelName = MODEL.startsWith('models/') ? MODEL : `models/${MODEL}`;
  const url = `https://generativelanguage.googleapis.com/v1/${modelName}:generateContent?key=${API_KEY}`;

  const body = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0.2,
      maxOutputTokens: 1024
    }
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Gemini API error: ${res.status} ${res.statusText} - ${txt}`);
  }

  const data = await res.json();
  // Extract text from candidates[0].content.parts[0].text
  if (data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts && data.candidates[0].content.parts[0] && data.candidates[0].content.parts[0].text) {
    return data.candidates[0].content.parts[0].text.trim();
  }
  return '';
}

function truncateMessage(text, maxLength = 4096) {
  if (!text || typeof text !== 'string') return 'No response';
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + '...';
}

// Groq API function (fast, reliable alternative)
async function callGroqAPI(prompt) {
  if (!GROQ_API_KEY) throw new Error('GROQ_API_KEY is missing');

  const url = 'https://api.groq.com/openai/v1/chat/completions';

  const body = {
    model: GROQ_MODEL,
    messages: [
      {
        role: 'user',
        content: prompt
      }
    ],
    temperature: 0.2,
    max_tokens: 1024,
    top_p: 1,
    stream: false
  };

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body),
      timeout: 30000
    });

    if (!res.ok) {
      const txt = await res.text();
      console.error('❌ Groq API Response Error:', res.status, txt);
      throw new Error(`Groq API error: ${res.status} ${res.statusText}`);
    }

    const data = await res.json();
    
    if (data.error) {
      console.error('❌ Groq API Error Object:', data.error);
      throw new Error(`Groq API: ${data.error.message || JSON.stringify(data.error)}`);
    }
    
    if (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) {
      return data.choices[0].message.content.trim();
    }
    
    throw new Error('Groq API: No valid response received');
  } catch (err) {
    console.error('❌ Groq API call failed:', err.message);
    throw err;
  }
}

// PDF Summarization function
async function summarizePDF(pdfText, fileName) {
  if (!pdfText || pdfText.trim().length === 0) {
    throw new Error('PDF text is empty');
  }

  // Limit PDF text to avoid exceeding API limits
  const textToSummarize = pdfText.trim().substring(0, 10000);
  
  const prompt = `Please provide a concise summary of the following document (${fileName}):\n\n---\n${textToSummarize}\n---\n\nProvide:\n1. Main topics covered\n2. Key points (bullet format)\n3. Brief conclusion`;

  try {
    // Try Gemini API first (most reliable)
    console.log('📡 Using Gemini API for PDF summary...');
    try {
      const summary = await callGeminiWithRetry(prompt);
      console.log('✅ Gemini API succeeded for PDF summary');
      return summary;
    } catch (geminiErr) {
      console.log('⚠️  Gemini API failed:', geminiErr.message);
      console.log('🔄 Attempting Groq API (model: ' + GROQ_MODEL + ') as fallback...');
      // Fallback to Groq if Gemini fails
      try {
        const summary = await callGroqAPI(prompt);
        console.log('✅ Groq API succeeded (fallback) for PDF summary');
        return summary;
      } catch (groqErr) {
        // Both failed, log both errors
        console.error('❌ Groq API also failed:', groqErr.message);
        console.error('Gemini Error:', geminiErr.message);
        throw new Error(`Both APIs failed - Gemini: ${geminiErr.message.substring(0, 50)} | Groq: ${groqErr.message.substring(0, 50)}`);
      }
    }
  } catch (err) {
    console.error('❌ PDF summarization error:', err.message);
    throw new Error(`Failed to summarize PDF: ${err.message}`);
  }
}

function sanitizeInput(text) {
  if (!text) return '';
  return text.trim().substring(0, 5000); // Limit input size
}

async function sendMessage(phoneNumber, userText) {
  if (!API_KEY) throw new Error('GOOGLE_API_KEY is missing from .env');
  
  // Sanitize input
  userText = sanitizeInput(userText);
  if (!userText) {
    return formatter.error('Empty Message', 'I didn\'t receive any text.\n\nTry sending a message or command! 😊');
  }

  // Extract YouTube URLs from the message
  const youtubeUrlRegex = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com|youtu\.be|youtube-nocookie\.com)\/(?:watch\?v=|embed\/|v\/|shorts\/)?([a-zA-Z0-9_-]+)/gi;
  const urlMatches = userText.match(youtubeUrlRegex);
  
  // If user is asking for download and provided URL
  const isDownloadRequest = userText.toLowerCase().includes('download') || 
                           userText.toLowerCase().includes('video') || 
                           userText.toLowerCase().includes('get me');
  
  if (isDownloadRequest && urlMatches && urlMatches.length > 0) {
    console.log(`🎬 Video download request detected`);
    const videoUrl = urlMatches[0];
    
    // Check if user specified format (video or mp3/audio)
    const wantsVideo = userText.toLowerCase().includes('video') || userText.toLowerCase().includes('mp4');
    const wantsAudio = userText.toLowerCase().includes('mp3') || userText.toLowerCase().includes('audio') || userText.toLowerCase().includes('song');
    
    if (wantsAudio) {
      // User wants audio/mp3
      console.log(`🎵 Audio download format requested`);
      try {
        session.addMessage(phoneNumber, 'user', userText);
        session.addMessage(phoneNumber, 'assistant', `🎵 **Extracting Audio...**\n⏳ Processing your audio request\n\n_Downloading... 0%_`);
        
        const filePath = await dispatchToolCall('download_video', { url: videoUrl, format: 'mp3' });
        
        const msg = `✅ **Audio Extracted!**\n🎵 Ready to send to WhatsApp\n\n📊 Download completed successfully`;
        session.addMessage(phoneNumber, 'assistant', msg);
        return filePath;
      } catch (err) {
        const errorMsg = err && err.message ? err.message : String(err);
        let errMsg = `❌ **Download Failed**`;
        if (errorMsg.includes('larger than max-filesize') || errorMsg.includes('16M')) {
          errMsg = `❌ **File Too Large** 📁\n\n🎵 Audio exceeds 16MB limit\n\n💡 **Solutions:**\n• Try shorter audio\n• Select lower quality\n• Different video`;
        } else if (errorMsg.includes('Private')) {
          errMsg = `❌ **Video is Private** 🔒\n\n⚠️ Cannot download\n\n💡 **Try:**\n• Ask creator to make public\n• Different video`;
        } else if (errorMsg.includes('not found') || errorMsg.includes('not available')) {
          errMsg = `❌ **Video Not Found** 🔍\n\n📺 Unavailable\n\n💡 **Check:**\n• Video link\n• If it still exists`;
        } else {
          errMsg = `❌ **Error:** ${errorMsg.substring(0, 50)}\n\n💡 Try again`;
        }
        session.addMessage(phoneNumber, 'user', userText);
        session.addMessage(phoneNumber, 'assistant', errMsg);
        return errMsg;
      }
    } else if (wantsVideo) {
      // User wants video
      console.log(`📹 Video download format requested`);
      try {
        session.addMessage(phoneNumber, 'user', userText);
        session.addMessage(phoneNumber, 'assistant', `📹 **Downloading Video...**\n⏳ Processing your video request\n\n_Downloading... 0%_`);
        
        const filePath = await dispatchToolCall('download_video', { url: videoUrl, format: 'video' });
        
        const msg = `✅ **Video Downloaded!**\n📹 Ready to send to WhatsApp\n\n📊 Download completed successfully`;
        session.addMessage(phoneNumber, 'assistant', msg);
        return filePath;
      } catch (err) {
        const errorMsg = err && err.message ? err.message : String(err);
        let errMsg = `❌ Download failed`;
        if (errorMsg.includes('larger than max-filesize') || errorMsg.includes('16M')) {
          errMsg = `❌ **File Too Large** 📁\n\n📹 Video exceeds 16MB limit\n\n💡 **Solutions:**\n• Try shorter video\n• Select lower quality\n• Different video`;
        } else if (errorMsg.includes('Private')) {
          errMsg = `❌ **Video is Private** 🔒\n\n⚠️ Cannot download\n\n💡 **Try:**\n• Ask creator to make public\n• Different video`;
        } else if (errorMsg.includes('not found') || errorMsg.includes('not available')) {
          errMsg = `❌ **Video Not Found** 🔍\n\n📺 Unavailable\n\n💡 **Check:**\n• Video link\n• If it still exists`;
        } else {
          errMsg = `❌ **Error:** ${errorMsg.substring(0, 50)}\n\n💡 Try again`;
        }
        session.addMessage(phoneNumber, 'user', userText);
        session.addMessage(phoneNumber, 'assistant', errMsg);
        return errMsg;
      }
    } else {
      // User didn't specify format, ask them
      console.log(`❓ Asking user for format preference`);
      addPendingDownload(phoneNumber, videoUrl);
      const askMsg = formatter.videoFormatChoice();
      session.addMessage(phoneNumber, 'user', userText);
      session.addMessage(phoneNumber, 'assistant', askMsg);
      return askMsg;
    }
  }
  
  // Check for search request patterns: "search", "find", "what is", "who is", "how to", "tell me about", etc.
  const searchPatterns = /\b(search|find|look for|look up|google|what is|who is|how to|tell me about|info about|information about)\b/i;
  const isSearchRequest = searchPatterns.test(userText) && !urlMatches;
  
  if (isSearchRequest) {
    console.log(`🔧 Auto-detected search request`);
    try {
      const result = await dispatchToolCall('google_search', { query: userText });
      const formatted = formatter.searchResults(userText, result);
      session.addMessage(phoneNumber, 'user', userText);
      session.addMessage(phoneNumber, 'assistant', formatted);
      return truncateMessage(formatted);
    } catch (err) {
      const errMsg = formatter.error('Search Failed', 'Unable to fetch search results right now.\n\nTry rephrasing your question or ask me directly!');
      session.addMessage(phoneNumber, 'user', userText);
      session.addMessage(phoneNumber, 'assistant', errMsg);
      return errMsg;
    }
  }

  // Regular conversational response
  const history = session.getHistory(phoneNumber) || [];
  
  let prompt = `You are a helpful WhatsApp AI assistant.\n`;
  const recentHistory = history.slice(-10);
  for (const m of recentHistory) {
    const role = m.role === 'user' ? 'User' : 'Assistant';
    prompt += `${role}: ${m.content}\n`;
  }
  prompt += `User: ${userText}\nAssistant:`;

  try {
    const finalReply = await callGeminiWithRetry(prompt);
    
    // Check if AI response indicates uncertainty or lack of information
    const uncertaintyPatterns = /\b(i don't know|not sure|don't have|not familiar|can't find|no information|i'm unable|not available|beyond my knowledge)\b/i;
    const hasUncertainty = uncertaintyPatterns.test(finalReply);
    
    // If AI doesn't know and user asked a question, try Google Search as fallback
    if (hasUncertainty && /[?]/.test(userText)) {
      console.log(`🔍 AI uncertain, attempting Google Search fallback`);
      try {
        const searchResult = await dispatchToolCall('google_search', { query: userText });
        const enhancedReply = `${finalReply}\n\n📍 Found online:\n${searchResult}`;
        const truncated = truncateMessage(enhancedReply);
        session.addMessage(phoneNumber, 'user', userText);
        session.addMessage(phoneNumber, 'assistant', truncated);
        return truncated;
      } catch (err) {
        // If search fails, just return the original response
        console.log(`🔍 Search fallback failed: ${err.message}`);
        const truncated = truncateMessage(finalReply);
        session.addMessage(phoneNumber, 'user', userText);
        session.addMessage(phoneNumber, 'assistant', truncated);
        return truncated;
      }
    }
    
    const truncated = truncateMessage(finalReply);
    session.addMessage(phoneNumber, 'user', userText);
    session.addMessage(phoneNumber, 'assistant', truncated);
    return truncated;
  } catch (err) {
    let errMsg = formatter.error('Oops! Something Went Wrong', 'Failed to process your request.\n\nTry again or type /help for assistance.');
    
    if (err.message && err.message.includes('rate limit')) {
      errMsg = formatter.error('Too Many Requests', 'The bot is getting many requests.\n\nPlease wait a moment and try again! ⏳');
    } else if (err.message && err.message.includes('timeout')) {
      errMsg = formatter.error('Request Timeout', 'Your request took too long.\n\nTry with a shorter message or simpler question.');
    } else if (err.message && err.message.includes('API')) {
      errMsg = formatter.error('API Error', 'Service is temporarily unavailable.\n\nTry again in a moment!');
    }
    
    console.error('Gemini error:', err.message);
    session.addMessage(phoneNumber, 'user', userText);
    session.addMessage(phoneNumber, 'assistant', errMsg);
    return errMsg;
  }
}

module.exports = { sendMessage, summarizePDF };
