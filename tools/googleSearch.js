const SERPAPI_ENDPOINT = 'https://serpapi.com/search.json';

async function search(query) {
  const apiKey = process.env.SERPAPI_KEY;
  if (!apiKey) {
    throw new Error('SERPAPI_KEY missing from .env');
  }

  const params = new URLSearchParams({
    q: query,
    engine: 'google',
    api_key: apiKey,
    num: '10'
  });

  const url = `${SERPAPI_ENDPOINT}?${params.toString()}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`SerpAPI request failed: ${res.status} ${res.statusText}`);
  }

  const data = await res.json();

  const results = data.organic_results || [];
  if (!results.length) {
    return '❌ No results found.';
  }

  const top = results.slice(0, 4);
  const lines = top.map((r, i) => {
    const title = r.title || 'No title';
    let snippet = '';
    if (r.snippet) snippet = r.snippet.substring(0, 150);
    else if (r.rich_snippet && r.rich_snippet.top && r.rich_snippet.top.entries && r.rich_snippet.top.entries[0] && r.rich_snippet.top.entries[0].list) {
      snippet = r.rich_snippet.top.entries[0].list.substring(0, 150);
    }
    const link = r.link || r.url || r.displayed_link || '';
    return `*${i + 1}. ${title}*\n${snippet}...\n🔗 ${link}`;
  });

  return lines.join('\n\n');
}

module.exports = {
  search
};
