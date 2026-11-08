NICFLIX project

This archive contains the NICFLIX frontend and Supabase Edge Function source.

Preview:
1. Open the NICFLIX folder in VS Code.
2. Run the project using VS Code Live Server (do not open index.html with file://).
3. The frontend uses the existing Supabase project and its get-media Edge Function.

Advanced Search:
- Live suggestions for movies, TV series and people.
- Search modes for movies, TV series, actors, directors, genres and categories.
- Filters for content type, genre, category and release year.
- Search requests are processed by the get-media Supabase Edge Function using TMDB_API_KEY stored as a Supabase secret.

Deploy the updated backend function from the NICFLIX project folder:
npx supabase functions deploy get-media

Keep TMDB_API_KEY in Supabase Edge Function secrets. Never put the TMDB key in browser JavaScript.

Note: TMDB provides catalogue metadata, posters, credits and discovery results. It does not grant streaming rights or provide licensed full-length playback streams.
