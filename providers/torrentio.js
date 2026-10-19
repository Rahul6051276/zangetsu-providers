// providers/torrentio.js
// Zangetsu Provider for Torrentio (CommonJS / QuickJS Compatible)

const TMDB_API_KEY = "1865f43a0549ca50d341dd9ab8b29f49";
const TORRENTIO_MIRRORS = [
  "https://torrentio.strem.fun",
  "https://torrentio.whalepool.site",
  "https://knightcrawler.elfhosted.com"
];

async function search(query) {
  const results = [];
  try {
    const url = "https://api.themoviedb.org/3/search/multi?api_key=" + TMDB_API_KEY + "&query=" + encodeURIComponent(query) + "&page=1";
    const res = await fetch(url);
    const data = await res.json();

    if (data && data.results) {
      data.results.forEach(function(item) {
        if (item.media_type === "movie" || item.media_type === "tv") {
          results.push({
            id: String(item.id),
            title: item.title || item.name,
            poster: item.poster_path ? "https://image.tmdb.org/t/p/w500" + item.poster_path : null,
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

async function resolveImdbId(detail) {
  if (detail.imdbId && String(detail.imdbId).startsWith("tt")) {
    return detail.imdbId;
  }

  const tmdbId = detail.tmdbId || detail.id;
  if (!tmdbId) return null;

  try {
    const isTv = detail.tmdbIsTv || Boolean(detail.season && detail.episode);
    const typePath = isTv ? "tv" : "movie";
    const extUrl = "https://api.themoviedb.org/3/" + typePath + "/" + tmdbId + "/external_ids?api_key=" + TMDB_API_KEY;
    const extRes = await fetch(extUrl);
    const extData = await extRes.json();
    return extData.imdb_id || null;
  } catch (e) {
    return null;
  }
}

async function getStreams(detail) {
  const streams = [];

  try {
    const imdbId = await resolveImdbId(detail);
    if (!imdbId) return [];

    const isTv = detail.tmdbIsTv || Boolean(detail.season && detail.episode);
    let path = "stream/movie/" + imdbId + ".json";
    if (isTv && detail.season && detail.episode) {
      path = "stream/series/" + imdbId + ":" + detail.season + ":" + detail.episode + ".json";
    }

    let data = null;
    for (const mirror of TORRENTIO_MIRRORS) {
      try {
        const response = await fetch(mirror + "/" + path, {
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
          }
        });
        if (response.ok) {
          data = await response.json();
          if (data && Array.isArray(data.streams) && data.streams.length > 0) {
            break;
          }
        }
      } catch (err) {
        // try next mirror
      }
    }

    if (data && Array.isArray(data.streams)) {
      data.streams.forEach(function(item) {
        let streamUrl = item.url;
        if (!streamUrl && item.infoHash) {
          streamUrl = "magnet:?xt=urn:btih:" + item.infoHash + "&dn=" + encodeURIComponent(item.title || "Stream");
        }

        if (streamUrl) {
          const rawTitle = item.title || item.name || "";
          const isHindi = /(hindi|dual audio|dubbed|hin)/i.test(rawTitle);

          streams.push({
            name: (isHindi ? "🇮🇳 HINDI | " : "") + "Torrentio",
            title: rawTitle,
            url: streamUrl,
            quality: parseQuality(rawTitle),
            isTorrent: Boolean(item.infoHash),
            isHindi: isHindi
          });
        }
      });
    }

    streams.sort(function(a, b) {
      if (a.isHindi !== b.isHindi) return b.isHindi ? 1 : -1;
      return 0;
    });

  } catch (err) {
    console.error("Torrentio getStreams failed:", err);
  }

  return streams;
}

function parseQuality(text) {
  if (/2160p|4k/i.test(text)) return "4K";
  if (/1080p/i.test(text)) return "1080p";
  if (/720p/i.test(text)) return "720p";
  return "Auto";
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    search,
    getDetail,
    getStreams
  };
}
