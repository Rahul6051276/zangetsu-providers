// providers/torrentio.js
// Zangetsu Provider for Torrentio (Movies & TV Series)

const BASE_URL = "https://torrentio.strem.fun";
const TMDB_API_KEY = "1865f43a0549ca50d341dd9ab8b29f49";

/**
 * Movie/Series Search Handler via TMDB
 */
async function search(query) {
  const results = [];
  try {
    const url = `https://api.themoviedb.org/3/search/multi?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(query)}&page=1`;
    const res = await fetch(url);
    const data = await res.json();

    if (data && data.results) {
      data.results.forEach((item) => {
        if (item.media_type === "movie" || item.media_type === "tv") {
          results.push({
            id: String(item.id),
            title: item.title || item.name,
            poster: item.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : null,
            type: item.media_type === "tv" ? "series" : "movie",
            tmdbId: item.id,
            tmdbIsTv: item.media_type === "tv"
          });
        }
      });
    }
  } catch (err) {
    console.error("Torrentio search error:", err);
  }
  return results;
}

/**
 * Metadata & TMDB Tracker Sync
 */
async function getDetail(item) {
  const tmdbId = item.tmdbId || item.id;
  const isTv = item.tmdbIsTv || item.type === "series";

  return {
    id: String(tmdbId),
    title: item.title,
    tmdbId: parseInt(tmdbId, 10),
    tmdbIsTv: Boolean(isTv)
  };
}

/**
 * Fetch Streams & Magnet Links
 */
async function getStreams(detail) {
  const streams = [];

  try {
    const tmdbId = detail.tmdbId || detail.id;
    const isTv = detail.tmdbIsTv || Boolean(detail.season && detail.episode);

    // 1. Resolve IMDb ID from TMDB
    const typePath = isTv ? "tv" : "movie";
    const extUrl = `https://api.themoviedb.org/3/${typePath}/${tmdbId}/external_ids?api_key=${TMDB_API_KEY}`;
    const extRes = await fetch(extUrl);
    const extData = await extRes.json();
    const imdbId = extData.imdb_id;

    if (!imdbId) {
      return [];
    }

    // 2. Build Torrentio endpoint path
    let streamEndpoint = `${BASE_URL}/stream/movie/${imdbId}.json`;
    if (isTv && detail.season && detail.episode) {
      streamEndpoint = `${BASE_URL}/stream/series/${imdbId}:${detail.season}:${detail.episode}.json`;
    }

    // 3. Request Torrentio
    const response = await fetch(streamEndpoint, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
      }
    });

    const data = await response.json();

    if (data && Array.isArray(data.streams)) {
      data.streams.forEach((item) => {
        let streamUrl = item.url;

        // If direct URL is absent, construct magnet link using infoHash
        if (!streamUrl && item.infoHash) {
          streamUrl = `magnet:?xt=urn:btih:${item.infoHash}&dn=${encodeURIComponent(item.title || "Stream")}`;
        }

        if (streamUrl) {
          const rawTitle = item.title || item.name || "";
          const isHindi = /(hindi|dual audio|dubbed|hin)/i.test(rawTitle);

          streams.push({
            name: `${isHindi ? "🇮🇳 HINDI | " : ""}Torrentio`,
            title: rawTitle,
            url: streamUrl,
            quality: parseQuality(rawTitle),
            isTorrent: Boolean(item.infoHash),
            isHindi: isHindi
          });
        }
      });
    }

    // Sort: Hindi dubs first, then default
    streams.sort((a, b) => {
      if (a.isHindi !== b.isHindi) return b.isHindi ? 1 : -1;
      return 0;
    });

  } catch (err) {
    console.error("Torrentio getStreams error:", err);
  }

  return streams;
}

function parseQuality(text) {
  if (/2160p|4k/i.test(text)) return "4K";
  if (/1080p/i.test(text)) return "1080p";
  if (/720p/i.test(text)) return "720p";
  if (/480p/i.test(text)) return "480p";
  return "HD";
}

export default {
  search,
  getDetail,
  getStreams
};
