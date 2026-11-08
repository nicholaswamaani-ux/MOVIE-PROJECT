
import { supabase } from './supabase.js';

// ==========================================
// NICFLIX ADMIN ELEMENTS
// ==========================================

const loginScreen = document.getElementById('loginScreen');
const dashboard = document.getElementById('dashboard');
const loginForm = document.getElementById('loginForm');

const loginMessage = document.getElementById('loginMessage');
const providerMessage = document.getElementById('providerMessage');

const offerForm = document.getElementById('offerForm');

let currentUser = null;

// ==========================================
// SCREEN MANAGEMENT
// ==========================================

function showDashboard() {
    loginScreen.classList.add('hidden');
    dashboard.classList.remove('hidden');
}

function showLogin() {
    dashboard.classList.add('hidden');
    loginScreen.classList.remove('hidden');
}

// ==========================================
// ADMIN AUTHORIZATION
// ==========================================

async function checkAdmin(user) {
    const { data, error } = await supabase
        .from('admin_users')
        .select('user_id, is_active')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .maybeSingle();

    if (error) throw error;

    if (!data) {
        throw new Error(
            'This account is not authorized as a NICFLIX administrator.'
        );
    }

    currentUser = user;
}

// ==========================================
// LOAD DASHBOARD
// ==========================================

async function loadDashboard() {

    const { data: providers, error: providerError } = await supabase
        .from('streaming_providers')
        .select('*')
        .order('created_at', { ascending: false });

    if (providerError) throw providerError;

    const { data: offers, error: offerError } = await supabase
        .from('provider_offers')
        .select('id');

    if (offerError) throw offerError;

    // Dashboard statistics

    document.getElementById('providerCount').textContent =
        providers.length;

    document.getElementById('pendingCount').textContent =
        providers.filter(p => p.partner_status === 'pending').length;

    document.getElementById('offerCount').textContent =
        offers.length;

    // Provider table

    const table = document.getElementById('providerTable');

    const headerRow = table.closest('table')?.querySelector('thead tr');

    if (headerRow && !headerRow.querySelector('.actions-heading')) {
        const heading = document.createElement('th');

        heading.textContent = 'Actions';
        heading.className = 'actions-heading';

        headerRow.appendChild(heading);
    }

    table.replaceChildren();

    if (!providers.length) {

        const row = document.createElement('tr');
        const cell = document.createElement('td');

        cell.colSpan = 5;
        cell.className = 'empty';
        cell.textContent = 'No providers registered yet.';

        row.appendChild(cell);
        table.appendChild(row);

    } else {

        providers.forEach(provider => {

            const row = document.createElement('tr');

            const name = document.createElement('td');
            name.textContent = provider.name;

            const website = document.createElement('td');

            const link = document.createElement('a');
            link.href = provider.website_url;
            link.target = '_blank';
            link.rel = 'noopener noreferrer';
            link.textContent = 'Visit website';
            link.style.color = '#e50914';

            website.appendChild(link);

            const partnership = document.createElement('td');
            partnership.textContent = provider.partner_status;

            const status = document.createElement('td');
            status.textContent = provider.status;

            const actions = document.createElement('td');

            if (provider.partner_status !== 'approved') {
                actions.appendChild(
                    createActionButton(
                        'Approve',
                        'approve',
                        provider.id,
                        '#16834a'
                    )
                );
            }

            if (provider.partner_status !== 'rejected') {
                actions.appendChild(
                    createActionButton(
                        'Reject',
                        'reject',
                        provider.id,
                        '#b32626'
                    )
                );
            }

            const activeLabel =
                provider.status === 'active' ? 'Deactivate' : 'Activate';

            actions.appendChild(
                createActionButton(
                    activeLabel,
                    'toggle',
                    provider.id,
                    '#555'
                )
            );

            row.append(name, website, partnership, status, actions);

            table.appendChild(row);
        });
    }

    // Load offer management data

    await loadOfferProviders(providers);
    await loadOffers(providers);
}

// ==========================================
// CREATE PROVIDER ACTION BUTTONS
// ==========================================

function createActionButton(label, action, providerId, color) {

    const button = document.createElement('button');

    button.type = 'button';
    button.textContent = label;

    button.dataset.action = action;
    button.dataset.id = providerId;

    button.style.cssText = `
        background: ${color};
        color: white;
        border: none;
        padding: 8px 12px;
        margin: 3px;
        border-radius: 5px;
        cursor: pointer;
        font-size: 12px;
    `;

    return button;
}

// ==========================================
// PROVIDER APPROVAL MANAGEMENT
// ==========================================

document.getElementById('providerTable').addEventListener(
    'click',
    async (event) => {

        const button = event.target.closest('button[data-action]');

        if (!button) return;

        const providerId = button.dataset.id;
        const action = button.dataset.action;

        if (!currentUser) {
            alert('Please sign in again.');
            return;
        }

        let updates = {};
        let confirmation = '';

        if (action === 'approve') {
            updates = { partner_status: 'approved' };
            confirmation = 'Approve this provider partnership?';
        }

        if (action === 'reject') {
            updates = { partner_status: 'rejected' };
            confirmation = 'Reject this provider partnership?';
        }

        if (action === 'toggle') {

            const { data, error } = await supabase
                .from('streaming_providers')
                .select('status')
                .eq('id', providerId)
                .single();

            if (error) {
                alert(error.message);
                return;
            }

            updates = {
                status: data.status === 'active' ? 'inactive' : 'active'
            };

            confirmation =
                `Are you sure you want to ${updates.status === 'active' ? 'activate' : 'deactivate'} this provider?`;
        }

        if (!confirm(confirmation)) return;

        button.disabled = true;

        try {

            const { error } = await supabase
                .from('streaming_providers')
                .update(updates)
                .eq('id', providerId);

            if (error) throw error;

            await loadDashboard();

            alert('Provider updated successfully!');

        } catch (error) {

            console.error('Provider update:', error);

            alert(error.message);

            button.disabled = false;
        }
    }
);

// ==========================================
// REGISTER PROVIDER
// ==========================================

document.getElementById('providerForm').addEventListener(
    'submit',
    async (event) => {

        event.preventDefault();

        providerMessage.textContent = 'Registering provider...';

        try {

            if (!currentUser) {
                throw new Error('Please sign in again.');
            }

            const provider = {

                name: document.getElementById('providerName')
                    .value.trim(),

                slug: document.getElementById('providerSlug')
                    .value.trim().toLowerCase(),

                website_url: document.getElementById('providerWebsite')
                    .value.trim(),

                logo_url: document.getElementById('providerLogo')
                    .value.trim() || null,

                description: document.getElementById('providerDescription')
                    .value.trim() || null,

                partner_status: 'pending',

                status: 'active'
            };

            const { error } = await supabase
                .from('streaming_providers')
                .insert(provider);

            if (error) throw error;

            document.getElementById('providerForm').reset();

            providerMessage.style.color = '#65d68a';

            providerMessage.textContent =
                'Provider registered successfully. Partnership approval is pending.';

            await loadDashboard();

        } catch (error) {

            console.error('Provider registration:', error);

            providerMessage.style.color = '#ff7777';

            providerMessage.textContent = error.message;
        }
    }
);

// ==========================================
// LOAD APPROVED PROVIDERS INTO DROPDOWN
// ==========================================

async function loadOfferProviders(providers) {

    const select = document.getElementById('offerProvider');

    if (!select) return;

    select.replaceChildren();

    const defaultOption = document.createElement('option');

    defaultOption.value = '';
    defaultOption.textContent = 'Select an approved provider';

    select.appendChild(defaultOption);

    const approvedProviders = providers.filter(provider =>
        provider.partner_status === 'approved' &&
        provider.status === 'active'
    );

    approvedProviders.forEach(provider => {

        const option = document.createElement('option');

        option.value = provider.id;
        option.textContent = provider.name;

        select.appendChild(option);
    });

    if (!approvedProviders.length) {
        defaultOption.textContent = 'No approved providers available';
    }
}

// ==========================================
// LOAD REGISTERED LICENSED OFFERS
// ==========================================

async function loadOffers(providers) {

    const container = document.getElementById('offersTableContainer');

    if (!container) return;

    const { data: offers, error } = await supabase
        .from('provider_offers')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) {
        container.textContent = error.message;
        return;
    }

    container.replaceChildren();

    if (!offers.length) {

        container.textContent = 'No licensed offers registered yet.';

        return;
    }

    const providerMap = new Map(
        providers.map(provider => [provider.id, provider.name])
    );

    const table = document.createElement('table');

    table.style.width = '100%';
    table.style.borderCollapse = 'collapse';

    const headings = [
        'Provider',
        'TMDB ID',
        'Type',
        'Country',
        'Offer',
        'Status',
        'Link'
    ];

    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');

    headings.forEach(heading => {

        const th = document.createElement('th');

        th.textContent = heading;
        th.style.padding = '12px';
        th.style.textAlign = 'left';

        headerRow.appendChild(th);
    });

    thead.appendChild(headerRow);
    table.appendChild(thead);

    const tbody = document.createElement('tbody');

    offers.forEach(offer => {

        const row = document.createElement('tr');

        const values = [
            providerMap.get(offer.provider_id) || 'Unknown provider',
            offer.tmdb_id,
            offer.media_type,
            offer.country_code,
            offer.offer_type,
            offer.status
        ];

        values.forEach(value => {

            const td = document.createElement('td');

            td.textContent = String(value);
            td.style.padding = '12px';

            row.appendChild(td);
        });

        const linkCell = document.createElement('td');
        const link = document.createElement('a');

        link.href = offer.availability_url;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.textContent = 'Visit provider';
        link.style.color = '#e50914';

        linkCell.appendChild(link);
        row.appendChild(linkCell);

        tbody.appendChild(row);
    });

    table.appendChild(tbody);
    container.appendChild(table);
}

// ==========================================
// REGISTER LICENSED MOVIE OR TV OFFER
// ==========================================

if (offerForm) {

    offerForm.addEventListener('submit', async (event) => {

        event.preventDefault();

        const message = document.getElementById('offerMessage');

        const submitButton = offerForm.querySelector(
            'button[type="submit"]'
        );

        message.textContent = 'Saving licensed offer...';

        submitButton.disabled = true;

        try {

            if (!currentUser) {
                throw new Error('Please sign in again.');
            }

            const providerId =
                document.getElementById('offerProvider').value;

            const tmdbId = Number(
                document.getElementById('tmdbId').value
            );

            const mediaType =
                document.getElementById('mediaType').value;

            const countryCode =
                document.getElementById('countryCode')
                    .value.trim().toUpperCase();

            const offerType =
                document.getElementById('offerType').value;

            const availabilityUrl =
                document.getElementById('availabilityUrl').value.trim();

            if (!providerId) {
                throw new Error('Please select an approved provider.');
            }

            if (!Number.isSafeInteger(tmdbId) || tmdbId < 1) {
                throw new Error('Enter a valid TMDB ID.');
            }

            if (!['movie', 'tv'].includes(mediaType)) {
                throw new Error('Invalid content type.');
            }

            if (!/^[A-Z]{2}$/.test(countryCode)) {
                throw new Error('Enter a valid two-letter country code, such as UG.');
            }

            if (![
                'subscription',
                'free',
                'ads',
                'rent',
                'buy'
            ].includes(offerType)) {
                throw new Error('Invalid offer type.');
            }

            const url = new URL(availabilityUrl);

            if (url.protocol !== 'https:') {
                throw new Error('Please use a secure HTTPS provider URL.');
            }

            // Confirm provider is approved and active

            const { data: provider, error: providerError } = await supabase
                .from('streaming_providers')
                .select('id, partner_status, status')
                .eq('id', providerId)
                .single();

            if (providerError) throw providerError;

            if (
                provider.partner_status !== 'approved' ||
                provider.status !== 'active'
            ) {
                throw new Error(
                    'This provider is not approved and active.'
                );
            }

            // Create offer

            const offer = {

                provider_id: providerId,

                tmdb_id: tmdbId,

                media_type: mediaType,

                country_code: countryCode,

                offer_type: offerType,

                availability_url: url.toString(),

                status: 'pending'
            };

            const { error } = await supabase
                .from('provider_offers')
                .insert(offer);

            if (error) throw error;

            offerForm.reset();

            document.getElementById('countryCode').value = 'UG';

            message.style.color = '#65d68a';

            message.textContent =
                'Licensed offer saved successfully. It is pending verification.';

            await loadDashboard();

        } catch (error) {

            console.error('Licensed offer registration:', error);

            message.style.color = '#ff7777';

            message.textContent = error.message;

        } finally {

            submitButton.disabled = false;
        }
    });
}

// ==========================================
// PASSWORD RECOVERY EMAIL
// ==========================================

const forgotPassword = document.getElementById('forgotPassword');

if (forgotPassword) {

    forgotPassword.addEventListener('click', async (event) => {

        event.preventDefault();

        const email = document.getElementById('adminEmail').value.trim();

        const message = document.getElementById('resetMessage');

        if (!email) {
            message.textContent = 'Please enter your admin email first.';
            return;
        }

        message.textContent = 'Sending password reset email...';

        try {

            const { error } = await supabase.auth.resetPasswordForEmail(
                email,
                {
                    redirectTo: window.location.origin + '/admin.html'
                }
            );

            if (error) throw error;

            message.textContent =
                'Password reset email sent. Check your inbox.';

        } catch (error) {

            message.textContent = error.message;
        }
    });
}

// ==========================================
// LOGOUT
// ==========================================

document.getElementById('logoutButton').addEventListener(
    'click',
    async () => {

        await supabase.auth.signOut();

        currentUser = null;

        showLogin();
    }
);

// ==========================================
// INITIALIZE ADMIN DASHBOARD
// ==========================================

async function initializeAdmin() {

    try {

        const { data, error } = await supabase.auth.getSession();

        if (error) throw error;

        if (!data.session) {

            showLogin();

            return;
        }

        await checkAdmin(data.session.user);

        showDashboard();

        await loadDashboard();

    } catch (error) {

        console.error('Admin initialization:', error);

        await supabase.auth.signOut();

        currentUser = null;

        showLogin();

        loginMessage.textContent = error.message;
    }
}

initializeAdmin();
