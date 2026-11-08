
/* =========================================
   NICFLIX OFFICIAL TV PLAYER
   Separate from the movie player
========================================= */

let tvOverlay = null;

export function openTVPlayer(channelName, embedUrl = "", officialUrl = "") {
    closeTVPlayer();

    const overlay = document.createElement("div");
    overlay.className = "nicflix-tv-overlay";
    overlay.id = "nicflix-tv-overlay";

    const container = document.createElement("div");
    container.className = "nicflix-tv-container";

    // Header
    const header = document.createElement("div");
    header.className = "nicflix-tv-header";

    const title = document.createElement("h2");
    title.textContent = channelName || "NICFLIX Live TV";

    const closeButton = document.createElement("button");
    closeButton.textContent = "✕";
    closeButton.setAttribute("aria-label", "Close TV player");
    closeButton.addEventListener("click", closeTVPlayer);

    header.append(title, closeButton);

    // Screen
    const screen = document.createElement("div");
    screen.className = "nicflix-tv-screen";

    // Only load verified HTTPS embed links
    let validEmbedUrl = "";

    try {
        const parsedUrl = new URL(embedUrl);

        if (parsedUrl.protocol === "https:") {
            validEmbedUrl = parsedUrl.href;
        }
    } catch (error) {
        validEmbedUrl = "";
    }

    if (validEmbedUrl) {
        const frame = document.createElement("iframe");

        frame.src = validEmbedUrl;
        frame.title = channelName + " live stream";
        frame.allow = "autoplay; fullscreen; picture-in-picture";
        frame.allowFullscreen = true;
        frame.referrerPolicy = "strict-origin-when-cross-origin";

        screen.appendChild(frame);
    } else {
        const message = document.createElement("div");
        message.className = "nicflix-tv-message";

        const heading = document.createElement("h3");
        heading.textContent = "Official stream not connected yet";

        const description = document.createElement("p");
        description.textContent =
            "This channel will become available when its official streaming source is verified.";

        message.append(heading, description);

        if (officialUrl) {
            try {
                const parsedOfficialUrl = new URL(officialUrl);

                if (parsedOfficialUrl.protocol === "https:") {
                    const link = document.createElement("a");
                    link.href = parsedOfficialUrl.href;
                    link.target = "_blank";
                    link.rel = "noopener noreferrer";
                    link.textContent = "Watch on the broadcaster's website";

                    message.appendChild(link);
                }
            } catch (error) {
                // Ignore invalid official URLs.
            }
        }

        screen.appendChild(message);
    }

    container.append(header, screen);
    overlay.appendChild(container);
    document.body.appendChild(overlay);

    tvOverlay = overlay;

    overlay.addEventListener("click", event => {
        if (event.target === overlay) {
            closeTVPlayer();
        }
    });

    document.addEventListener("keydown", handleTVEscape);
    document.body.style.overflow = "hidden";
}

export function closeTVPlayer() {
    if (tvOverlay) {
        const frame = tvOverlay.querySelector("iframe");

        if (frame) {
            frame.src = "about:blank";
        }

        tvOverlay.remove();
        tvOverlay = null;
    }

    document.removeEventListener("keydown", handleTVEscape);
    document.body.style.overflow = "";
}

function handleTVEscape(event) {
    if (event.key === "Escape") {
        closeTVPlayer();
    }
}

// Make functions accessible to existing HTML onclick handlers.
window.openTVPlayer = openTVPlayer;
window.closeTVPlayer = closeTVPlayer;
