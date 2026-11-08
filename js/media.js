import { supabase } from './supabase.js';

const IMAGE_BASE = 'https://image.tmdb.org/t/p/w500';
const FALLBACK_POSTER = 'https://placehold.co/500x750/171717/ffffff?text=NICFLIX';

async function callCatalogFunction(body) {
    const { data, error } = await supabase.functions.invoke('get-media', { body });
    if (error) throw error;
    if (data?.error) throw new Error(data.error);
    return data;
}

function makeCard(item, type) {
    const isPerson = type === 'person' || item.media_type === 'person';
    const card = document.createElement('article');
    card.className = 'movie-card';
    card.tabIndex = 0;
    card.setAttribute('role', 'group');

    const image = document.createElement('img');
    const imagePath = isPerson ? item.profile_path : item.poster_path;
    image.src = imagePath ? `${IMAGE_BASE}${imagePath}` : FALLBACK_POSTER;
    image.alt = item.title || item.name || 'Media poster';
    image.loading = 'lazy';
    image.onerror = () => { image.src = FALLBACK_POSTER; };

    const overlay = document.createElement('div');
    overlay.className = 'movie-overlay';

    const title = document.createElement('h3');
    title.textContent = item.title || item.name || 'Untitled';

    const info = document.createElement('div');
    info.className = 'movie-info';
    if (isPerson) {
        const department = item.known_for_department || 'Cast and crew';
        const knownFor = (item.known_for || []).map(entry => entry.title || entry.name).filter(Boolean).slice(0, 2);
        info.textContent = [department, knownFor.join(', ')].filter(Boolean).join(' • ');
        card.setAttribute('aria-label', `Person: ${item.name || 'Unknown'}`);
    } else {
        const date = (item.release_date || item.first_air_date || '').slice(0, 4);
        info.textContent = [type === 'tv' ? 'TV Series' : 'Movie', date].filter(Boolean).join(' • ');
        card.setAttribute('aria-label', `More information about ${item.title || item.name || 'this title'}`);
    }

    const rating = document.createElement('div');
    rating.className = 'rating';
    rating.textContent = isPerson ? '' : `★ ${Number(item.vote_average || 0).toFixed(1)}/10`;
    overlay.append(title, info, rating);
    card.append(image, overlay);

    if (!isPerson && item.id) {
        const openDetails = () => {
            const params = new URLSearchParams({ id: String(item.id), type: type === 'tv' ? 'tv' : 'movie' });
            window.location.href = `movie-details.html?${params.toString()}`;
        };
        card.setAttribute('role', 'button');
        card.addEventListener('click', openDetails);
        card.addEventListener('keydown', event => {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                openDetails();
            }
        });
    }
    return card;
}

function fillGrid(id, items, type, emptyMessage = 'No content available right now.') {
    const grid = document.getElementById(id);
    if (!grid) return;
    grid.replaceChildren();
    if (!items?.length) {
        const message = document.createElement('p');
        message.textContent = emptyMessage;
        grid.append(message);
        return;
    }
    items.forEach(item => grid.append(makeCard(item, type || item.media_type || 'movie')));
}

async function fetchCategory(type, category = 'popular', page = 1) {
    return callCatalogFunction({ action: 'catalog', type, category, page });
}

async function loadHomepage() {
    const trending = document.getElementById('trendingGrid');
    const movies = document.getElementById('moviesGrid');
    if (trending) trending.textContent = 'Loading trending movies...';
    if (movies) movies.textContent = 'Loading popular movies...';

    try {
        const [movieData] = await Promise.all([fetchCategory('movie', 'popular', 1)]);
        const movieItems = movieData.results || [];
        fillGrid('trendingGrid', movieItems.slice(0, 10), 'movie');
        fillGrid('moviesGrid', movieItems, 'movie');
        console.info('NICFLIX: TMDB movie catalogue loaded.');
    } catch (error) {
        console.error('NICFLIX catalogue error:', error);
        fillGrid('trendingGrid', [], 'movie', 'Could not load trending movies. Check the connection and Supabase Function.');
        fillGrid('moviesGrid', [], 'movie', 'Could not load movies. Check the connection and Supabase Function.');
    }
}

let searchTimer;
let latestSearchId = 0;
let activeQuery = '';

function getSearchFilters() {
    return {
        searchType: document.getElementById('searchType')?.value || 'all',
        mediaType: document.getElementById('searchMediaType')?.value || 'movie',
        genreId: document.getElementById('searchGenre')?.value || '',
        category: document.getElementById('searchCategory')?.value || '',
        year: document.getElementById('searchYear')?.value || ''
    };
}

async function loadGenres() {
    const select = document.getElementById('searchGenre');
    if (!select) return;
    try {
        const data = await callCatalogFunction({ action: 'genres', type: 'movie' });
        (data.genres || []).forEach(genre => {
            const option = document.createElement('option');
            option.value = genre.id;
            option.textContent = genre.name;
            select.append(option);
        });
    } catch (error) {
        console.warn('NICFLIX: Could not load genre filters.', error);
    }
}

async function runSearch(query, suggestionsOnly = false) {
    const section = document.getElementById('searchResultsSection');
    const heading = document.getElementById('searchResultsHeading');
    const status = document.getElementById('searchStatus');
    const grid = document.getElementById('searchResultsGrid');
    if (!section || !heading || !status || !grid) return;

    const filters = getSearchFilters();
    const searchId = ++latestSearchId;
    section.hidden = false;
    heading.textContent = query ? `Search results for “${query}”` : 'Browse catalogue';
    status.textContent = 'Searching the NICFLIX catalogue...';
    if (!suggestionsOnly) grid.replaceChildren();

    try {
        const data = await callCatalogFunction({
            action: 'advanced_search',
            query,
            ...filters
        });
        if (searchId !== latestSearchId) return;

        const results = data.results || [];
        if (suggestionsOnly) {
            // Suggestions are presented in the same results area for keyboard and screen-reader access.
            grid.replaceChildren();
            results.slice(0, 6).forEach(item => grid.append(makeCard(item, item.media_type || filters.mediaType)));
            status.textContent = results.length ? `${results.length} live suggestions. Choose a filter or keep typing.` : 'No suggestions yet.';
        } else {
            grid.replaceChildren();
            results.forEach(item => grid.append(makeCard(item, item.media_type || filters.mediaType)));
            status.textContent = results.length
                ? `${results.length} accurate catalogue result${results.length === 1 ? '' : 's'} found.`
                : 'No matching results. Try another keyword or adjust your filters.';
        }
    } catch (error) {
        if (searchId !== latestSearchId) return;
        console.error('NICFLIX advanced search error:', error);
        status.textContent = 'Search is temporarily unavailable. Check the get-media Supabase Function and try again.';
    }
}

function setupSearch() {
    const input = document.getElementById('searchInput');
    const section = document.getElementById('searchResultsSection');
    const apply = document.getElementById('applySearchFilters');
    if (!input || !section) return;

    input.setAttribute('autocomplete', 'off');
    input.setAttribute('aria-controls', 'searchResultsGrid');

    input.addEventListener('focus', () => {
        if (input.value.trim().length >= 2) section.hidden = false;
    });

    input.addEventListener('input', () => {
        clearTimeout(searchTimer);
        const query = input.value.trim();
        activeQuery = query;
        if (!query) {
            latestSearchId++;
            section.hidden = true;
            document.getElementById('searchResultsGrid')?.replaceChildren();
            const status = document.getElementById('searchStatus');
            if (status) status.textContent = '';
            return;
        }
        if (query.length < 2) return;
        searchTimer = setTimeout(() => runSearch(query, true), 300);
    });

    input.addEventListener('keydown', event => {
        if (event.key === 'Enter') {
            event.preventDefault();
            clearTimeout(searchTimer);
            runSearch(input.value.trim(), false);
        }
        if (event.key === 'Escape') {
            section.hidden = true;
        }
    });

    apply?.addEventListener('click', () => runSearch(activeQuery || input.value.trim(), false));
    ['searchType', 'searchMediaType', 'searchGenre', 'searchCategory', 'searchYear'].forEach(id => {
        document.getElementById(id)?.addEventListener('change', () => {
            if (activeQuery.length >= 2 || getSearchFilters().genreId || getSearchFilters().category) {
                activeQuery = input.value.trim();
                runSearch(activeQuery, false);
            }
            if (id === 'searchMediaType') loadGenresForSelectedType();
        });
    });
    input.addEventListener('search', () => runSearch(input.value.trim(), false));
}

async function loadGenresForSelectedType() {
    const select = document.getElementById('searchGenre');
    const type = document.getElementById('searchMediaType')?.value || 'movie';
    if (!select) return;
    select.replaceChildren(new Option('All genres', ''));
    try {
        const data = await callCatalogFunction({ action: 'genres', type });
        (data.genres || []).forEach(genre => select.add(new Option(genre.name, genre.id)));
    } catch (error) {
        console.warn('NICFLIX: Genre filters could not be refreshed.', error);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    setupSearch();
    loadGenres();
    loadHomepage();
});
