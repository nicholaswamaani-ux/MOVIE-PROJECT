
import { supabase } from './supabase.js';
import { openPlayer } from './player.js';

/* =========================================
   NICFLIX MOVIE DETAILS
========================================= */

const IMAGE_BASE = 'https://image.tmdb.org/t/p/';
const FALLBACK_POSTER =
    'https://placehold.co/500x750/171717/ffffff?text=NICFLIX';

const content = document.getElementById('detailsContent');


function createElement(tag, className = '', text = '') {
    const element = document.createElement(tag);

    if (className) element.className = className;
    if (text !== '') element.textContent = text;

    return element;
}


function displayDetails(item, type) {

    content.replaceChildren();

    // CINEMATIC BACKDROP
    content.style.setProperty(
        '--backdrop-image',
        item.backdrop_path
            ? `url("${IMAGE_BASE}original${item.backdrop_path}")`
            : 'none'
    );

    // MAIN HERO
    const hero = createElement('section', 'details-hero');

    const posterWrapper = createElement(
        'div',
        'details-poster-wrapper'
    );

    const poster = createElement('img', 'details-poster');

    poster.src = item.poster_path
        ? `${IMAGE_BASE}w500${item.poster_path}`
        : FALLBACK_POSTER;

    poster.alt = `${item.title || item.name || 'Movie'} poster`;

    poster.onerror = () => {
        poster.onerror = null;
        poster.src = FALLBACK_POSTER;
    };

    posterWrapper.append(poster);

    // MOVIE INFORMATION
    const information = createElement(
        'div',
        'details-information'
    );

    const title = createElement(
        'h1',
        'details-title',
        item.title || item.name || 'Untitled'
    );

    const date = item.release_date || item.first_air_date;
    const year = date ? date.substring(0, 4) : 'Year unknown';

    const runtime = type === 'movie'
        ? item.runtime
        : item.episode_run_time?.[0];

    const metadata = createElement(
        'div',
        'details-metadata'
    );

    const rating = createElement(
        'span',
        'details-rating',
        `★ ${Number(item.vote_average || 0).toFixed(1)}/10`
    );

    const yearElement = createElement('span', '', year);

    const runtimeElement = createElement(
        'span',
        '',
        runtime ? `${runtime} min` : 'Runtime unavailable'
    );

    metadata.append(rating, yearElement, runtimeElement);

    // GENRES
    const genres = createElement(
        'div',
        'details-genres'
    );

    if (item.genres?.length) {
        item.genres.forEach(genre => {
            genres.append(
                createElement(
                    'span',
                    'genre-tag',
                    genre.name
                )
            );
        });
    } else {
        genres.append(
            createElement('span', 'genre-tag', 'Genre unavailable')
        );
    }

    // OVERVIEW
    const overview = createElement(
        'p',
        'details-overview',
        item.overview || 'No description is available for this title.'
    );

    // ACTION BUTTONS
    const actions = createElement(
        'div',
        'details-actions'
    );

    // WATCH NOW
    const watchButton = createElement(
        'button',
        'watch-now-btn',
        '▶ Watch Now'
    );

    watchButton.type = 'button';

    watchButton.addEventListener('click', () => {

        const playbackUrl = item.playback_url;

        if (!playbackUrl) {
            alert(
                'No licensed playback source is available for this title yet.'
            );
            return;
        }

        openPlayer(
            playbackUrl,
            item.title || item.name || 'Now Playing'
        );
    });

    // MY LIST
    const listButton = createElement(
        'button',
        'add-list-btn',
        '＋ My List'
    );

    listButton.type = 'button';

    listButton.addEventListener('click', () => {
        alert(
            'My List functionality will be implemented in a later task.'
        );
    });

    actions.append(watchButton, listButton);

    information.append(
        title,
        metadata,
        genres,
        overview,
        actions
    );

    hero.append(posterWrapper, information);

    content.append(hero);

    // OFFICIAL TRAILER
    const trailer = item.videos?.results?.find(video =>
        video.site === 'YouTube' &&
        ['Trailer', 'Teaser'].includes(video.type) &&
        video.key
    );

    if (trailer) {

        const trailerSection = createElement(
            'section',
            'trailer-section'
        );

        const trailerHeading = createElement(
            'h2',
            'section-heading',
            'Official Trailer'
        );

        const iframe = document.createElement('iframe');

        iframe.src =
            `https://www.youtube.com/embed/${encodeURIComponent(trailer.key)}`;

        iframe.title =
            `${item.title || item.name || 'Movie'} official trailer`;

        iframe.allow =
            'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';

        iframe.allowFullscreen = true;
        iframe.loading = 'lazy';

        trailerSection.append(trailerHeading, iframe);

        content.append(trailerSection);
    }

    // STREAMING PROVIDERS
    loadProviders(item.id, type);
}


/* =========================================
   STREAMING PROVIDERS
========================================= */

function displayProviderGroup(container, title, providers, link) {

    if (!providers?.length) return;

    const group = createElement(
        'div',
        'provider-group'
    );

    const heading = createElement(
        'h3',
        'provider-group-heading',
        title
    );

    const providerList = createElement(
        'div',
        'provider-list'
    );

    providers.forEach(provider => {

        const card = createElement(
            'article',
            'provider-card'
        );

        if (provider.logo_path) {

            const logo = document.createElement('img');

            logo.src = `${IMAGE_BASE}w92${provider.logo_path}`;
            logo.alt = provider.provider_name;
            logo.loading = 'lazy';

            card.append(logo);
        }

        const name = createElement(
            'span',
            'provider-name',
            provider.provider_name
        );

        card.append(name);

        if (link) {

            const anchor = document.createElement('a');

            anchor.href = link;
            anchor.target = '_blank';
            anchor.rel = 'noopener noreferrer';

            anchor.textContent = 'View availability →';
            anchor.className = 'provider-link';

            card.append(anchor);
        }

        providerList.append(card);
    });

    group.append(heading, providerList);

    container.append(group);
}


async function loadProviders(id, type) {

    const section = createElement(
        'section',
        'streaming-section'
    );

    const heading = createElement(
        'h2',
        'section-heading',
        'Where to Watch'
    );

    const subtitle = createElement(
        'p',
        'streaming-subtitle',
        'Streaming availability in Uganda'
    );

    const status = createElement(
        'p',
        'provider-status',
        'Checking streaming availability...'
    );

    section.append(heading, subtitle, status);

    content.append(section);

    try {

        const { data, error } = await supabase.functions.invoke(
            'get-media',
            {
                body: {
                    action: 'providers',
                    id: String(id),
                    type
                }
            }
        );

        if (error) throw error;

        if (data?.error) {
            throw new Error(data.error);
        }

        status.remove();

        if (data?.ugandaSupported === false) {

            section.append(
                createElement(
                    'p',
                    'provider-status',
                    'TMDB does not currently provide streaming availability data for Uganda.'
                )
            );

            return;
        }

        const country = data?.results?.UG;

        if (!country) {

            section.append(
                createElement(
                    'p',
                    'provider-status',
                    'No streaming-provider listings are available for this title in Uganda.'
                )
            );

            return;
        }

        const categories = [
            { key: 'flatrate', title: 'Subscription' },
            { key: 'free', title: 'Free' },
            { key: 'ads', title: 'Free with Ads' },
            { key: 'rent', title: 'Rent' },
            { key: 'buy', title: 'Buy' }
        ];

        let found = false;

        categories.forEach(category => {

            const providers = country[category.key];

            if (providers?.length) {

                found = true;

                displayProviderGroup(
                    section,
                    category.title,
                    providers,
                    country.link
                );
            }
        });

        if (!found) {

            section.append(
                createElement(
                    'p',
                    'provider-status',
                    'No provider options are currently listed for Uganda.'
                )
            );
        }

        // JUSTWATCH ATTRIBUTION
        if (country.link) {

            const attribution = document.createElement('a');

            attribution.href = country.link;
            attribution.target = '_blank';
            attribution.rel = 'noopener noreferrer';

            attribution.textContent =
                'Streaming availability data provided by JustWatch';

            attribution.className = 'justwatch-credit';

            section.append(attribution);
        }

    } catch (error) {

        console.error('NICFLIX provider error:', error);

        status.textContent =
            'Streaming availability could not be loaded right now.';
    }
}


/* =========================================
   LOAD MOVIE DETAILS
========================================= */

async function loadDetails() {

    if (!content) {
        console.error(
            'NICFLIX: detailsContent element not found.'
        );
        return;
    }

    const params = new URLSearchParams(
        window.location.search
    );

    const id = params.get('id');
    const type = params.get('type');

    if (!id || !['movie', 'tv'].includes(type)) {

        content.textContent =
            'Invalid movie or TV show selection.';

        return;
    }

    content.textContent = 'Loading movie details...';

    try {

        const { data, error } = await supabase.functions.invoke(
            'get-media',
            {
                body: {
                    action: 'details',
                    id,
                    type
                }
            }
        );

        if (error) throw error;

        if (data?.error) {
            throw new Error(data.error);
        }

        displayDetails(data, type);

    } catch (error) {

        console.error('NICFLIX details error:', error);

        content.textContent =
            'Unable to load details. Please try again later.';
    }
}

loadDetails();
