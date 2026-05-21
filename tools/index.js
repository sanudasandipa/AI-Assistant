module.exports = [
  {
    name: 'echo_test',
    description: 'Echoes the provided input so the tool-calling loop can be verified.',
    input_schema: {
      type: 'object',
      properties: {
        input: {
          type: 'string',
          description: 'Text to echo back.'
        }
      },
      required: ['input'],
      additionalProperties: false
    }
  },
  {
    name: 'google_search',
    description: 'Searches Google and returns the top organic results (title, snippet, URL).',
    input_schema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Search query string'
        }
      },
      required: ['query'],
      additionalProperties: false
    }
  },
  {
    name: 'download_video',
    description: 'Downloads a video from a URL using yt-dlp. Returns the local file path to the downloaded MP4.',
    input_schema: {
      type: 'object',
      properties: {
        url: {
          type: 'string',
          description: 'Video URL (YouTube, Vimeo, etc.)'
        }
      },
      required: ['url'],
      additionalProperties: false
    }
  }
];
