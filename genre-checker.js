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

async function getSpotifyToken() {
  try {
    const data = await spotifyApi.clientCredentialsGrant();
    spotifyApi.setAccessToken(data.body['access_token']);
    console.log('Spotify token obtained');
  } catch (error) {
    console.error('Error getting Spotify token:', error);
  }
}

async function getGenresFromSpotify(trackName) {
  try {
    const searchResult = await spotifyApi.searchTracks(trackName, { limit: 1 });
    if (searchResult.body.tracks.items.length > 0) {
      const track = searchResult.body.tracks.items[0];
      const artistId = track.artists[0].id;
      const artistResult = await spotifyApi.getArtist(artistId);
      const genres = artistResult.body.genres;
      
      return {
        found: true,
        trackName: track.name,
        artist: track.artists[0].name,
        genres: genres,
        spotifyUrl: track.external_urls.spotify
      };
    }
    return { found: false };
  } catch (error) {
    return { found: false, error: error.message };
  }
}

async function searchWithTavily(query) {
  try {
    const response = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: TAVILY_API_KEY,
        query: `${query} music genre`,
        search_depth: 'basic',
        include_answer: true
      })
    });
    return await response.json();
  } catch (error) {
    console.error(`Tavily error for "${query}":`, error.message);
    return null;
  }
}

async function checkGenres() {
  const musicPath = path.join(__dirname, 'music');
  const outputPath = path.join(__dirname, 'music-genres.json');
  
  if (!SPOTIFY_CLIENT_ID || !SPOTIFY_CLIENT_SECRET) {
    console.error('Set SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET env vars');
    return;
  }
  
  await getSpotifyToken();
  
  const files = fs.readdirSync(musicPath).filter(f => f.endsWith('.mp3'));
  const results = [];
  
  for (const file of files) {
    const trackName = path.basename(file, '.mp3');
    console.log(`Processing: ${trackName}`);
    
    const spotifyResult = await getGenresFromSpotify(trackName);
    const result = { fileName: file, trackName, spotify: spotifyResult };
    
    if (!spotifyResult.found && TAVILY_API_KEY) {
      console.log(`  Not found on Spotify, trying Tavily...`);
      result.tavily = await searchWithTavily(trackName);
    }
    
    results.push(result);
    await new Promise(r => setTimeout(r, 100));
  }
  
  fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));
  console.log(`\nResults saved to ${outputPath}`);
}

checkGenres().catch(console.error);
