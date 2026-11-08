import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const allowedTypes = ["movie", "tv"];
const allowedCategories = ["popular", "top_rated", "now_playing", "upcoming", "on_the_air", "airing_today"];

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function tmdb(path: string, apiKey: string, params: Record<string, string> = {}) {
  const url = new URL(`https://api.themoviedb.org/3${path}`);
  url.searchParams.set("api_key", apiKey);
  for (const [key, value] of Object.entries(params)) {
    if (value) url.searchParams.set(key, value);
  }
  const response = await fetch(url);
  const data = await response.json();
  if (!response.ok) throw new Error(data?.status_message || "TMDB request failed.");
  return data;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { status: 200, headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const body = await req.json();
    const action = String(body.action || "catalog");
    const apiKey = Deno.env.get("TMDB_API_KEY");
    if (!apiKey) return json({ error: "TMDB_API_KEY is missing from Supabase secrets." }, 500);

    let data: any;

    if (action === "genres") {
      const type = allowedTypes.includes(String(body.type)) ? String(body.type) : "movie";
      data = await tmdb(`/genre/${type}/list`, apiKey, { language: "en-US" });
      return json(data);
    }

    if (action === "advanced_search") {
      const query = String(body.query || "").trim().slice(0, 100);
      const searchType = String(body.searchType || "all");
      const mediaType = allowedTypes.includes(String(body.mediaType)) ? String(body.mediaType) : "movie";
      const genreId = /^\d+$/.test(String(body.genreId || "")) ? String(body.genreId) : "";
      const year = /^\d{4}$/.test(String(body.year || "")) ? String(body.year) : "";
      const category = allowedCategories.includes(String(body.category || "")) ? String(body.category) : "";
      const page = "1";
      let results: any[] = [];

      if (searchType === "genre" || genreId) {
        let selectedGenre = genreId;
        if (!selectedGenre && query.length >= 2) {
          const genres = await tmdb(`/genre/${mediaType}/list`, apiKey, { language: "en-US" });
          const match = (genres.genres || []).find((g: any) => String(g.name).toLowerCase().includes(query.toLowerCase()));
          selectedGenre = match ? String(match.id) : "";
        }
        if (selectedGenre) {
          const params: Record<string, string> = { with_genres: selectedGenre, page, sort_by: "popularity.desc" };
          if (year) params[mediaType === "movie" ? "primary_release_year" : "first_air_date_year"] = year;
          const found = await tmdb(`/discover/${mediaType}`, apiKey, params);
          results = (found.results || []).map((item: any) => ({ ...item, media_type: mediaType }));
        }
      } else if (searchType === "category" || category) {
        const selectedCategory = category || "popular";
        if (selectedCategory === "popular" || selectedCategory === "top_rated" ||
            (mediaType === "movie" && ["now_playing", "upcoming"].includes(selectedCategory)) ||
            (mediaType === "tv" && ["on_the_air", "airing_today"].includes(selectedCategory))) {
          const found = await tmdb(`/${mediaType}/${selectedCategory}`, apiKey, { page });
          results = (found.results || []).map((item: any) => ({ ...item, media_type: mediaType }));
        } else {
          const found = await tmdb(`/discover/${mediaType}`, apiKey, {
            sort_by: selectedCategory === "top_rated" ? "vote_average.desc" : "popularity.desc",
            page,
          });
          results = (found.results || []).map((item: any) => ({ ...item, media_type: mediaType }));
        }
        if (query) results = results.filter((item: any) => String(item.title || item.name || "").toLowerCase().includes(query.toLowerCase()));
      } else if (searchType === "actor" || searchType === "director") {
        if (query.length < 2) return json({ results: [] });
        const people = await tmdb("/search/person", apiKey, { query, include_adult: "false", page });
        const person = (people.results || []).find((p: any) =>
          searchType === "actor" ? p.known_for_department === "Acting" : p.known_for_department === "Directing"
        ) || (people.results || [])[0];
        if (person?.id) {
          const credits = await tmdb(`/person/${person.id}/${mediaType}_credits`, apiKey);
          const list = searchType === "actor" ? (credits.cast || []) : (credits.crew || []).filter((c: any) => c.job === "Director");
          results = [
            { ...person, media_type: "person" },
            ...list.map((item: any) => ({ ...item, media_type: mediaType })),
          ];
          if (year) results = results.filter((item: any) => item.media_type === "person" || String(item.release_date || item.first_air_date || "").startsWith(year));
        }
      } else if (query.length >= 2) {
        const endpoint = searchType === "movie" ? "/search/movie" :
          searchType === "tv" ? "/search/tv" : "/search/multi";
        const found = await tmdb(endpoint, apiKey, { query, include_adult: "false", page });
        results = (found.results || []).filter((item: any) =>
          searchType === "all" ? ["movie", "tv", "person"].includes(item.media_type || (endpoint === "/search/movie" ? "movie" : endpoint === "/search/tv" ? "tv" : "")) :
          true
        ).map((item: any) => ({
          ...item,
          media_type: item.media_type || (searchType === "movie" ? "movie" : searchType === "tv" ? "tv" : "movie"),
        }));
        if (searchType === "all") {
          results = results.filter((item: any) => item.media_type === "person" || item.media_type === mediaType);
        }
        if (year) results = results.filter((item: any) => {
          if (item.media_type === "person") return true;
          const date = item.release_date || item.first_air_date || "";
          return date.startsWith(year);
        });
      } else if (genreId || category) {
        const found = await tmdb(`/discover/${mediaType}`, apiKey, {
          with_genres: genreId,
          sort_by: "popularity.desc",
          page,
        });
        results = (found.results || []).map((item: any) => ({ ...item, media_type: mediaType }));
      } else {
        return json({ results: [] });
      }

      if (genreId && searchType !== "genre") {
        results = results.filter((item: any) => item.media_type === "person" || true);
      }
      return json({ results: results.slice(0, 40), total_results: results.length });
    }

    if (action === "search") {
      const query = String(body.query || "").trim().slice(0, 100);
      if (query.length < 2) return json({ error: "Enter at least 2 characters to search." }, 400);
      data = await tmdb("/search/multi", apiKey, { query, include_adult: "false", page: "1" });
      return json(data);
    }

    if (action === "details" || action === "providers") {
      const type = String(body.type || "");
      const id = String(body.id || "");
      if (!allowedTypes.includes(type)) return json({ error: "Type must be movie or tv." }, 400);
      if (!/^\d+$/.test(id) || Number(id) <= 0) return json({ error: "A valid TMDB ID is required." }, 400);
      if (action === "details") {
        data = await tmdb(`/${type}/${id}`, apiKey, { append_to_response: "videos,credits" });
      } else {
        data = await tmdb(`/${type}/${id}/watch/providers`, apiKey);
        const regions = await tmdb("/watch/providers/regions", apiKey);
        data.ugandaSupported = (regions.results || []).some((region: any) => region.iso_3166_1 === "UG");
      }
      return json(data);
    }

    if (action === "catalog") {
      const type = allowedTypes.includes(String(body.type)) ? String(body.type) : "movie";
      const category = allowedCategories.includes(String(body.category)) ? String(body.category) : "popular";
      const page = String(Math.min(500, Math.max(1, Number.parseInt(String(body.page || "1"), 10) || 1)));
      data = await tmdb(`/${type}/${category}`, apiKey, { page });
      return json(data);
    }

    return json({ error: "Unsupported action. Use catalog, search, advanced_search, genres, details or providers." }, 400);
  } catch (error) {
    console.error("get-media error:", error);
    return json({ error: error instanceof Error ? error.message : "The catalogue request failed." }, 500);
  }
});
