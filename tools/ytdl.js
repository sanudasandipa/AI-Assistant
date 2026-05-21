const { spawn } = require('child_process');
const path = require('path');
const os = require('os');

async function downloadVideo(url, format = 'video') {
  const timestamp = Date.now();
  const tmpDir = os.tmpdir();
  
  // Determine output format
  const isAudio = format === 'mp3' || format === 'audio' || format === 'mp3' || format === 'song';
  const outputExt = isAudio ? 'mp3' : 'mp4';
  const outputPath = path.join(tmpDir, `ytdl_${timestamp}.${outputExt}`);

  return new Promise((resolve, reject) => {
    try {
      // Validate URL
      if (!url || !url.includes('youtu')) {
        reject(new Error('Invalid YouTube URL'));
        return;
      }
      
      let args;
      if (isAudio) {
        // Download audio as MP3 using android player client
        args = [
          '-m', 'yt_dlp',
          '--extractor-args', 'youtube:player_client=android',
          '-x',
          '--audio-format', 'mp3',
          '--audio-quality', '192',
          '--max-filesize', '16M',
          '-o', outputPath,
          url
        ];
        console.log(`🎵 Starting MP3 download...`);
      } else {
        // Download video as MP4 using android player client
        args = [
          '-m', 'yt_dlp',
          '--extractor-args', 'youtube:player_client=android',
          '-f', 'best',
          '--max-filesize', '16M',
          '-o', outputPath,
          url
        ];
        console.log(`📹 Starting MP4 download...`);
      }
      
      const python = spawn('python', args, {
        stdio: ['pipe', 'pipe', 'pipe']
      });

      let errorOutput = '';

      python.stdout.on('data', (data) => {
        console.log(data.toString());
      });

      python.stderr.on('data', (data) => {
        const output = data.toString();
        console.error(output);
        errorOutput += output;
        
        // Check for specific errors in stderr
        if (output.includes('larger than max-filesize')) {
          reject(new Error('File too large (>16MB) - Try a shorter video or audio'));
        }
      });

      python.on('close', (code) => {
        if (code === 0) {
          console.log(`✓ Downloaded to: ${outputPath}`);
          resolve(outputPath);
        } else {
          // Provide better error messages
          if (errorOutput.includes('Requested format is not available')) {
            reject(new Error('Video format not available - Try different quality or video'));
          } else if (errorOutput.includes('Private')) {
            reject(new Error('Video is private - Cannot download'));
          } else if (errorOutput.includes('not found')) {
            reject(new Error('Video not found - Check URL'));
          } else {
            reject(new Error(`Download failed with code ${code}`));
          }
        }
      });

      python.on('error', (err) => {
        reject(new Error(`Failed to start download: ${err.message}`));
      });
    } catch (err) {
      reject(err);
    }
  });
}

module.exports = {
  downloadVideo
};
