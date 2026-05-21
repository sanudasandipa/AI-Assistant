async function dispatchToolCall(toolName, args) {
  // Handle both old format (toolUse object) and new format (toolName string, args object)
  if (typeof toolName === 'object' && toolName.type === 'tool_use') {
    // Old format compatibility
    const toolUse = toolName;
    toolName = toolUse.name;
    args = toolUse.input || {};
  }

  if (toolName === 'echo_test') {
    const input = typeof args.input === 'string' ? args.input : '';
    return `Echo: ${input}`;
  }

  if (toolName === 'google_search') {
    const { search } = require('./googleSearch');
    const query = typeof args.query === 'string' ? args.query : '';
    if (!query) throw new Error('google_search requires a query parameter');
    const result = await search(query);
    return result;
  }

  if (toolName === 'download_video') {
    const { downloadVideo } = require('./ytdl');
    const url = typeof args.url === 'string' ? args.url : '';
    const format = typeof args.format === 'string' ? args.format : 'video';
    if (!url) throw new Error('download_video requires a url parameter');
    const filePath = await downloadVideo(url, format);
    return filePath;
  }

  throw new Error(`Unknown tool: ${toolName}`);
}

module.exports = {
  dispatchToolCall
};
