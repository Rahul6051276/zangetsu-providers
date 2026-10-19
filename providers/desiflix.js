// providers/desiflix.js
// Zangetsu Provider for DesiFlix (Hindi & Regional Content)

const TMDB_API_KEY = "1865f43a0549ca50d341dd9ab8b29f49";
// Desiflix base stream provider endpoint
const DESIFLIX_BASE = "https://desiflix.stream";

async function search(query) {
  var results = [];
  try {
    var cleanQuery = query.replace(/[^\w\s]/gi, " ").trim();
    var url = "https://api.themoviedb.org/3/search/multi?api_key=" + TMDB_API_KEY + "&query=" + encodeURIComponent(cleanQuery);
    var res = await fetch(url);
    var data = await res.json();

    if (data && data.results) {
      for (var i = 0; i < data.results.length; i++) {
        var item = data.results[i];
        if (item.media_type === "movie" || item.media_type === "tv") {
          var titleName = item.title || item.name || "";
          var releaseYear = (item.release_date || item.first_air_date || "").substring(0, 4);

          results.push({
            id: String(item.id),
            title: releaseYear ? (titleName + " (" + releaseYear + ")") : titleName,
            url: item.media_type + "/" + item.id,
            poster: item.poster_path ? "https://image.tmdb.org/t/p/w500" + item.poster_path : "",
            type: item.media_type === "tv" ? "series" : "movie",
            tmdbId: item.id,
            tmdbIsTv: item.media_type === "tv"
          });
        }
      }
    }
  } catch (err) {
    // Ignore error
  }
  return results;
}

async function getDetail(item) {
  var tmdbId = item.tmdbId || item.id;
  var isTv = item.tmdbIsTv || item.type === "series";

  if (item.url && item.url.includes("/")) {
    var parts = item.url.split("/");
    isTv = parts[0] === "tv";
    tmdbId = parts[1];
  }

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

  var tmdbId = detail.tmdbId || detail.id;
  if (!tmdbId) return null;

  try {
    var isTv = detail.tmdbIsTv || Boolean(detail.season && detail.episode);
    var typePath = isTv ? "tv" : "movie";
    var extUrl = "https://api.themoviedb.org/3/" + typePath + "/" + tmdbId + "/external_ids?api_key=" + TMDB_API_KEY;
    var extRes = await fetch(extUrl);
    var extData = await extRes.json();
    return extData.imdb_id || null;
  } catch (e) {
    return null;
  }
}

async function getStreams(detail) {
  var streams = [];

  try {
    var imdbId = await resolveImdbId(detail);
    if (!imdbId) return [];

    var isTv = detail.tmdbIsTv || Boolean(detail.season && detail.episode);
    var endpoint = DESIFLIX_BASE + "/stream/movie/" + imdbId + ".json";
    
    if (isTv && detail.season && detail.episode) {
      endpoint = DESIFLIX_BASE + "/stream/series/" + imdbId + ":" + detail.season + ":" + detail.episode + ".json";
    }

    var response = await fetch(endpoint, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
      }
    });

    if (response.ok) {
      var data = await response.json();
      if (data && Array.isArray(data.streams)) {
        for (var i = 0; i < data.streams.length; i++) {
          var item = data.streams[i];
          if (item.url) {
            var rawTitle = item.title || item.name || "DesiFlix Server";
            streams.push({
              name: "🇮🇳 DesiFlix",
              title: rawTitle,
              url: item.url,
              quality: extractQuality(rawTitle),
              headers: item.behaviorHints && item.behaviorHints.proxyHeaders ? item.behaviorHints.proxyHeaders.request : null
            });
          }
        }
      }
    }
  } catch (err) {
    // Silent catch
  }

  return streams;
}

function extractQuality(text) {
  if (/2160p|4k/i.test(text)) return "4K";
  if (/1080p/i.test(text)) return "1080p";
  if (/720p/i.test(text)) return "720p";
  if (/480p/i.test(text)) return "480p";
  return "HD";
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    search,
    getDetail,
    getStreams
  };
}
