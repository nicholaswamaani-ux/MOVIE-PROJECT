
/* =========================================
   NICFLIX PREMIUM VIDEO PLAYER
========================================= */

let currentPlayer = null;
let currentOverlay = null;

export function openPlayer(videoUrl, title = 'Now Playing') {

    if (!videoUrl) {
        alert(
            'No licensed playback source is available for this title yet.'
        );
        return;
    }

    closePlayer();

    // PLAYER OVERLAY
    const overlay = document.createElement('div');

    overlay.id = 'nicflix-player-overlay';
    overlay.className = 'nicflix-player-overlay';

    // PLAYER CONTAINER
    const container = document.createElement('div');

    container.className = 'nicflix-player-container';

    // HEADER
    const header = document.createElement('div');

    header.className = 'nicflix-player-header';

    const heading = document.createElement('h2');

    heading.textContent = title;

    const closeButton = document.createElement('button');

    closeButton.textContent = '✕';
    closeButton.setAttribute('aria-label', 'Close player');

    closeButton.addEventListener('click', closePlayer);

    header.append(heading, closeButton);

    // VIDEO
    const video = document.createElement('video');

    video.id = 'nicflix-video';
    video.className = 'nicflix-video';

    video.controls = true;
    video.playsInline = true;
    video.preload = 'metadata';

    video.src = videoUrl;

    // STATUS
    const status = document.createElement('p');

    status.className = 'nicflix-player-status';
    status.textContent = 'Loading video...';

    video.addEventListener('loadedmetadata', () => {
        status.textContent = 'Video loaded. Press play to start.';
    });

    video.addEventListener('playing', () => {
        status.textContent = '';
    });

    video.addEventListener('waiting', () => {
        status.textContent = 'Buffering video...';
    });

    video.addEventListener('error', () => {
        status.textContent =
            'Unable to play this video. Check the playback source.';
    });

    // ASSEMBLE PLAYER
    container.append(header, video, status);
    overlay.append(container);

    document.body.append(overlay);

    currentPlayer = video;
    currentOverlay = overlay;

    // CLOSE WHEN CLICKING OUTSIDE PLAYER
    overlay.addEventListener('click', event => {
        if (event.target === overlay) {
            closePlayer();
        }
    });

    // ESCAPE KEY
    document.addEventListener('keydown', handleEscape);

    // Prevent background scrolling
    document.body.style.overflow = 'hidden';
}

export function closePlayer() {

    if (currentPlayer) {
        currentPlayer.pause();
        currentPlayer.removeAttribute('src');
        currentPlayer.load();
    }

    if (currentOverlay) {
        currentOverlay.remove();
    }

    document.removeEventListener('keydown', handleEscape);

    document.body.style.overflow = '';

    currentPlayer = null;
    currentOverlay = null;
}

function handleEscape(event) {
    if (event.key === 'Escape') {
        closePlayer();
    }
}
