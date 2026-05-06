require('dotenv').config();
const fs = require('fs');
const path = require('path');
const SpotifyWebApi = require('spotify-web-api-node');

const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;
const TAVILY_API_KEY = process.env.TAVILY_API_KEY;

const spotifyApi = new SpotifyWebApi({
  clientId: SPOTIFY_CLIENT_ID,
  clientSecret: SPOTIFY_CLIENT_SECRET
});

const MOOD_CATEGORIES = ['adventure', 'exciting', 'intimidating', 'chaotic', 'emotional'];
const musicPath = path.join(__dirname, 'music');
const sortedMusicPath = path.join(__dirname, 'sorted_music');
const outputPath = path.join(__dirname, 'music-moods.json');

async function getSpotifyToken() {
  try {
    const data = await spotifyApi.clientCredentialsGrant();
    spotifyApi.setAccessToken(data.body['access_token']);
    console.log('Spotify token obtained');
  } catch (error) {
    console.error('Error getting Spotify token:', error);
  }
}

async function searchWithTavily(query) {
  try {
    const response = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: TAVILY_API_KEY,
        query: `${query} music mood style tags`,
        search_depth: 'basic',
        include_answer: true
      })
    });
    const data = await response.json();
    return data.answer || '';
  } catch (error) {
    console.error(`Tavily error for "${query}":`, error.message);
    return '';
  }
}

function assignMoodCategories(audioFeatures, tavilyText) {
  const categories = [];
  const text = (tavilyText || '').toLowerCase();
  
  if (audioFeatures) {
    const { energy, valence, tempo, acousticness } = audioFeatures;
    
    if (energy > 0.7 && valence > 0.6 && tempo > 120) categories.push('exciting');
    if (valence < 0.4 && energy > 0.6 && acousticness < 0.3) categories.push('intimidating');
    if (energy > 0.8 && tempo > 130) categories.push('chaotic');
    if (energy < 0.5 && valence < 0.5 && acousticness > 0.5) categories.push('emotional');
    if (energy > 0.6 && valence > 0.5) {
      if (text.includes('adventure') || text.includes('epic') || text.includes('journey')) {
        categories.push('adventure');
      }
    }
  }
  
  MOOD_CATEGORIES.forEach(cat => {
    if (text.includes(cat) && !categories.includes(cat)) {
      categories.push(cat);
    }
  });
  
  return categories.length > 0 ? categories : ['uncategorized'];
}

async function sortMusic() {
  if (!SPOTIFY_CLIENT_ID || !SPOTIFY_CLIENT_SECRET) {
    console.error('Set SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET in .env');
    return;
  }
  
  await getSpotifyToken();
  
  if (!fs.existsSync(sortedMusicPath)) {
    fs.mkdirSync(sortedMusicPath, { recursive: true });
  }
  
  MOOD_CATEGORIES.forEach(cat => {
    const catPath = path.join(sortedMusicPath, cat);
    if (!fs.existsSync(catPath)) fs.mkdirSync(catPath);
  });
  
  const uncategorizedPath = path.join(sortedMusicPath, 'uncategorized');
  if (!fs.existsSync(uncategorizedPath)) fs.mkdirSync(uncategorizedPath);
  
  const files = fs.readdirSync(musicPath).filter(f => f.endsWith('.mp3'));
  const results = [];
  
  for (const file of files) {
    const trackName = path.basename(file, '.mp3');
    console.log(`Processing: ${trackName}`);
    
    let spotifyData = { found: false };
    let tavilyText = '';
    let categories = ['uncategorized'];
    
    try {
      const searchResult = await spotifyApi.searchTracks(trackName, { limit: 1 });
      if (searchResult.body.tracks.items.length > 0) {
        const track = searchResult.body.tracks.items[0];
        spotifyData = {
          found: true,
          trackName: track.name,
          artist: track.artists[0].name,
          spotifyUrl: track.external_urls.spotify
        };
        
        const audioFeatures = await spotifyApi.getAudioFeaturesForTrack(track.id);
        tavilyText = TAVILY_API_KEY ? await searchWithTavily(trackName) : '';
        categories = assignMoodCategories(audioFeatures.body, tavilyText);
      } else if (TAVILY_API_KEY) {
        tavilyText = await searchWithTavily(trackName);
        categories = assignMoodCategories(null, tavilyText);
      }
    } catch (error) {
      console.error(`Error processing ${trackName}:`, error.message);
    }
    
    const result = {
      fileName: file,
      trackName,
      categories,
      spotify: spotifyData,
      tavilyText: tavilyText.substring(0, 200)
    };
    results.push(result);
    
    categories.forEach(cat => {
      const destDir = path.join(sortedMusicPath, cat);
      const destPath = path.join(destDir, file);
      fs.copyFileSync(path.join(musicPath, file), destPath);
    });
    
    await new Promise(r => setTimeout(r, 100));
  }
  
  fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));
  console.log(`\nResults saved to ${outputPath}`);
  console.log(`Sorted music files in: ${sortedMusicPath}`);
}

sortMusic().catch(console.error);
