import { BrowserMultiFormatReader } from '@zxing/browser';
import { BarcodeFormat, DecodeHintType } from '@zxing/library';

const authTokenStorageKey = 'biblioCasa.authToken';
const appTabStorageKey = 'biblioCasa.appTab';
const statusLabels = {
    pending: 'Per llegir',
    reading: 'Llegint',
    read: 'Llegit',
    loaned: 'Deixat',
};

setupLibraryApp();

function setupLibraryApp() {
    const root = document.querySelector('[data-api-base-url]');

    if (!root) {
        return;
    }

    const apiBaseUrl = resolveApiBaseUrl(root.dataset.apiBaseUrl ?? '/api');
    const authForm = document.querySelector('#auth-form');
    const authStatus = document.querySelector('#auth-status');
    const authNameField = document.querySelector('#auth-name-field');
    const authPasswordConfirmField = document.querySelector('#auth-password-confirm-field');
    const authSubmit = document.querySelector('#auth-submit');
    const authTitle = document.querySelector('#auth-title');
    const authSwitchCopy = document.querySelector('#auth-switch-copy');
    const authModeTriggers = Array.from(document.querySelectorAll('[data-auth-mode-trigger]'));
    const authGuest = document.querySelector('#auth-guest');
    const authUser = document.querySelector('#auth-user');
    const authUserName = document.querySelector('#auth-user-name');
    const authUserEmail = document.querySelector('#auth-user-email');
    const logoutButton = document.querySelector('#logout-button');
    const appContent = document.querySelector('#app-content');
    const appTabTriggers = Array.from(document.querySelectorAll('[data-app-tab-trigger]'));
    const appTabPanels = Array.from(document.querySelectorAll('[data-app-tab-panel]'));
    const photoInput = document.querySelector('#barcode-photo');
    const lookupForm = document.querySelector('#lookup-form');
    const barcodeInput = document.querySelector('#barcode-input');
    const feedback = document.querySelector('#scan-status');
    const bookForm = document.querySelector('#book-form');
    const bookSubmit = document.querySelector('#book-submit');
    const cancelEditButton = document.querySelector('#cancel-edit');
    const resetButton = document.querySelector('#reset-form');
    const libraryGrid = document.querySelector('#library-grid');
    const libraryEmpty = document.querySelector('#library-empty');
    const librarySearch = document.querySelector('#library-search');
    const libraryStatusFilter = document.querySelector('#library-status-filter');
    const libraryLocationFilter = document.querySelector('#library-location-filter');
    const libraryPublisherFilter = document.querySelector('#library-publisher-filter');
    const libraryYearFilter = document.querySelector('#library-year-filter');
    const librarySort = document.querySelector('#library-sort');
    const libraryClearFilters = document.querySelector('#library-clear-filters');
    const libraryResultCopy = document.querySelector('#library-result-copy');
    const libraryPrevPage = document.querySelector('#library-prev-page');
    const libraryNextPage = document.querySelector('#library-next-page');
    const libraryPageInfo = document.querySelector('#library-page-info');
    const bookCount = document.querySelector('#book-count');
    const libraryTotalCount = document.querySelector('#library-total-count');
    const libraryVisibleCount = document.querySelector('#library-visible-count');
    const libraryActiveFilters = document.querySelector('#library-active-filters');
    const previewTitle = document.querySelector('#preview-title');
    const previewMeta = document.querySelector('#preview-meta');
    const previewDescription = document.querySelector('#preview-description');
    const previewSource = document.querySelector('#preview-source');
    const previewCover = document.querySelector('#preview-cover');
    const previewCoverFallback = document.querySelector('#preview-cover-fallback');

    if (
        !authForm || !authStatus || !authNameField || !authPasswordConfirmField || !authSubmit || !authTitle ||
        !authSwitchCopy || !authGuest || !authUser || !authUserName || !authUserEmail || !logoutButton ||
        !appContent || !photoInput || !lookupForm || !barcodeInput || !feedback || !bookForm || !bookSubmit || !cancelEditButton || !resetButton ||
        !libraryGrid || !libraryEmpty || !librarySearch || !libraryStatusFilter || !libraryLocationFilter ||
        !libraryPublisherFilter || !libraryYearFilter || !librarySort || !libraryClearFilters || !libraryResultCopy ||
        !libraryPrevPage || !libraryNextPage || !libraryPageInfo || !bookCount || !libraryTotalCount ||
        !libraryVisibleCount || !libraryActiveFilters || !previewTitle || !previewMeta || !previewDescription ||
        !previewSource || !previewCover || !previewCoverFallback
    ) {
        return;
    }

    const hints = new Map();
    hints.set(DecodeHintType.POSSIBLE_FORMATS, [
        BarcodeFormat.EAN_13,
        BarcodeFormat.EAN_8,
        BarcodeFormat.UPC_A,
        BarcodeFormat.UPC_E,
        BarcodeFormat.CODE_128,
    ]);

    const reader = new BrowserMultiFormatReader(hints);
    let authMode = 'login';
    let authToken = loadStoredToken();
    let currentUser = null;
    let editingBookId = null;
    let library = [];
    let libraryMeta = defaultLibraryMeta();
    let libraryState = createDefaultLibraryState();
    let searchDebounceId = null;

    const libraryElements = {
        libraryGrid,
        libraryEmpty,
        bookCount,
        libraryResultCopy,
        libraryPageInfo,
        libraryPrevPage,
        libraryNextPage,
        libraryTotalCount,
        libraryVisibleCount,
        libraryActiveFilters,
    };

    setAuthMode('login');
    setFeedback(authStatus, "Identifica't per veure i guardar els teus llibres.", 'neutral');
    setFeedback(feedback, 'Inicia sessio per carregar la teva biblioteca.', 'neutral');
    updatePreview(collectFormBook(bookForm), { previewTitle, previewMeta, previewDescription, previewSource, previewCover, previewCoverFallback });
    updateLibraryFilterControls();
    setActiveAppTab(loadStoredAppTab(), appTabTriggers, appTabPanels);
    renderSessionState();
    renderLibrary(library, libraryMeta, libraryElements, libraryState);

    if (authToken) {
        void hydrateSession();
    }

    authModeTriggers.forEach((trigger) => {
        trigger.addEventListener('click', () => setAuthMode(trigger.dataset.authModeTrigger === 'register' ? 'register' : 'login'));
    });
    appTabTriggers.forEach((trigger) => {
        trigger.addEventListener('click', () => setActiveAppTab(trigger.dataset.appTabTrigger === 'library' ? 'library' : 'capture', appTabTriggers, appTabPanels));
    });
    authForm.addEventListener('submit', (event) => {
        event.preventDefault();
        void submitAuthForm();
    });
    logoutButton.addEventListener('click', () => {
        void logout();
    });
    photoInput.addEventListener('change', () => {
        void lookupFromPhoto();
    });
    lookupForm.addEventListener('submit', (event) => {
        event.preventDefault();
        void lookupBarcode(barcodeInput.value);
    });
    bookForm.addEventListener('submit', (event) => {
        event.preventDefault();
        void saveBook();
    });
    resetButton.addEventListener('click', () => {
        resetBookForm();
        setFeedback(feedback, 'Fitxa buidada. Pots escanejar un altre llibre.', 'neutral');
    });
    cancelEditButton.addEventListener('click', () => {
        resetBookForm();
        setFeedback(feedback, 'Edicio cancel lada.', 'neutral');
    });
    bookForm.addEventListener('input', () => {
        updatePreview(collectFormBook(bookForm), { previewTitle, previewMeta, previewDescription, previewSource, previewCover, previewCoverFallback });
    });

    librarySearch.addEventListener('input', () => {
        window.clearTimeout(searchDebounceId);
        searchDebounceId = window.setTimeout(() => {
            updateLibraryState({ search: librarySearch.value.trim(), page: 1 });
            void loadLibrary();
        }, 220);
    });
    libraryStatusFilter.addEventListener('change', () => changeLibraryFilter({ status: libraryStatusFilter.value }));
    libraryLocationFilter.addEventListener('change', () => changeLibraryFilter({ location: libraryLocationFilter.value }));
    libraryPublisherFilter.addEventListener('change', () => changeLibraryFilter({ publisher: libraryPublisherFilter.value }));
    libraryYearFilter.addEventListener('change', () => changeLibraryFilter({ year: libraryYearFilter.value }));
    librarySort.addEventListener('change', () => {
        const [sort, direction] = librarySort.value.split(':');
        changeLibraryFilter({ sort, direction });
    });
    libraryClearFilters.addEventListener('click', () => {
        libraryState = createDefaultLibraryState();
        updateLibraryFilterControls();
        void loadLibrary();
    });
    libraryPrevPage.addEventListener('click', () => {
        if (libraryState.page > 1) {
            updateLibraryState({ page: libraryState.page - 1 });
            void loadLibrary();
        }
    });
    libraryNextPage.addEventListener('click', () => {
        if (libraryState.page < (libraryMeta.last_page || 1)) {
            updateLibraryState({ page: libraryState.page + 1 });
            void loadLibrary();
        }
    });
    libraryGrid.addEventListener('click', (event) => {
        const target = event.target instanceof HTMLElement ? event.target : null;

        if (!target) {
            return;
        }

        const editTrigger = target.closest('[data-edit-book-id]');

        if (editTrigger) {
            const bookId = Number(editTrigger.getAttribute('data-edit-book-id'));
            const book = library.find((item) => item.id === bookId);

            if (!book) {
                return;
            }

            startEditingBook(book);
            return;
        }

        const deleteTrigger = target.closest('[data-delete-book-id]');

        if (!deleteTrigger) {
            return;
        }

        const bookId = Number(deleteTrigger.getAttribute('data-delete-book-id'));
        const book = library.find((item) => item.id === bookId);

        if (!book) {
            return;
        }

        void deleteBook(book);
    });

    async function hydrateSession() {
        try {
            const payload = await apiFetch('auth/me');

            if (!payload.user) {
                throw new Error("No s'ha pogut recuperar la sessio.");
            }

            currentUser = payload.user;
            renderSessionState();
            setFeedback(authStatus, 'Sessio recuperada correctament.', 'success');
            setFeedback(feedback, "Prepara la captura fent una foto del codi o entrant l'ISBN manualment.", 'neutral');
            await loadLibrary();
            await hydrateFromQueryString();
        } catch (error) {
            clearSession();
            setFeedback(authStatus, getErrorMessage(error, 'La sessio guardada ja no es valida.'), 'error');
        }
    }

    async function submitAuthForm() {
        const payload = collectPayload(authForm);
        const endpoint = authMode === 'register' ? 'auth/register' : 'auth/login';

        if (!payload.email || !payload.password) {
            setFeedback(authStatus, 'Email i contrasenya son obligatoris.', 'error');
            return;
        }

        if (authMode === 'register' && !payload.name) {
            setFeedback(authStatus, 'El nom es obligatori per crear el compte.', 'error');
            return;
        }

        setFeedback(authStatus, authMode === 'register' ? 'Creant compte...' : 'Entrant...', 'neutral');

        try {
            const response = await fetch(buildApiUrl(apiBaseUrl, endpoint), {
                method: 'POST',
                headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            const result = (await parseJson(response)) ?? {};

            if (!response.ok || !result.data?.token || !result.data.user) {
                throw new Error(extractApiError(result, authMode === 'register' ? "No s'ha pogut crear el compte." : "No s'ha pogut iniciar sessio."));
            }

            authToken = result.data.token;
            currentUser = result.data.user;
            storeToken(authToken);
            authForm.reset();
            setAuthMode('login');
            renderSessionState();
            setFeedback(authStatus, authMode === 'register' ? 'Compte creat correctament.' : 'Sessio iniciada.', 'success');
            setFeedback(feedback, "Prepara la captura fent una foto del codi o entrant l'ISBN manualment.", 'neutral');
            setActiveAppTab('capture', appTabTriggers, appTabPanels);
            await loadLibrary();
            await hydrateFromQueryString();
        } catch (error) {
            setFeedback(authStatus, getErrorMessage(error, "No s'ha pogut completar l'autenticacio."), 'error');
        }
    }

    async function logout() {
        try {
            if (authToken) {
                await apiFetch('auth/logout', { method: 'POST' });
            }
        } catch {
            // Ignore logout errors and clear the session locally.
        }

        clearSession();
        setFeedback(authStatus, 'Sessio tancada.', 'neutral');
        setFeedback(feedback, 'Inicia sessio per carregar la teva biblioteca.', 'neutral');
    }

    async function lookupFromPhoto() {
        const file = photoInput.files?.[0];

        if (!file) {
            return;
        }

        setFeedback(feedback, 'Analitzant la foto del codi...', 'neutral');

        try {
            const code = await decodeBarcodeFromPhoto(file, reader);

            barcodeInput.value = code;
            await lookupBarcode(code);
        } catch (error) {
            setFeedback(feedback, getErrorMessage(error, "No s'ha pogut detectar cap codi a la foto. Torna-la a fer amb mes llum i el codi ocupant quasi tota l'amplada."), 'error');
        }
    }

    async function lookupBarcode(rawBarcode) {
        const barcode = rawBarcode.trim();

        if (!barcode) {
            setFeedback(feedback, "Introdueix o escaneja un ISBN abans de buscar.", 'error');
            return;
        }

        setFeedback(feedback, 'Consultant Open Library i Google Books...', 'neutral');

        try {
            const payload = await apiFetch('books/lookup', undefined, { barcode });

            if (!payload) {
                throw new Error("No s'ha trobat cap llibre amb aquest codi.");
            }

            fillForm(bookForm, payload);
            updatePreview(payload, { previewTitle, previewMeta, previewDescription, previewSource, previewCover, previewCoverFallback });
            setFeedback(feedback, "Fitxa localitzada. Revisa-la i desa-la quan vulguis.", 'success');
        } catch (error) {
            setFeedback(feedback, getErrorMessage(error, "No s'ha pogut recuperar la fitxa del llibre."), 'error');
        }
    }

    async function saveBook() {
        const payload = collectPayload(bookForm);

        if (!payload.title) {
            setFeedback(feedback, 'El titol es obligatori per desar el llibre.', 'error');
            return;
        }

        setFeedback(feedback, 'Desant llibre a la biblioteca...', 'neutral');

        try {
            const endpoint = editingBookId ? `books/${editingBookId}` : 'books';
            const method = editingBookId ? 'PATCH' : 'POST';
            const result = await apiFetch(endpoint, { method, body: JSON.stringify(payload) });

            fillForm(bookForm, result);
            updatePreview(result, { previewTitle, previewMeta, previewDescription, previewSource, previewCover, previewCoverFallback });
            setFeedback(feedback, editingBookId ? 'Canvis guardats correctament.' : 'Llibre desat correctament.', 'success');
            resetBookForm();
            setActiveAppTab('library', appTabTriggers, appTabPanels);
            await loadLibrary();
        } catch (error) {
            setFeedback(feedback, getErrorMessage(error, "No s'ha pogut desar el llibre."), 'error');
        }
    }

    async function deleteBook(book) {
        const confirmed = window.confirm(`Vols eliminar "${book.title ?? 'aquest llibre'}"? Aquesta accio no es pot desfer.`);

        if (!confirmed || !book.id) {
            return;
        }

        setFeedback(feedback, 'Eliminant llibre...', 'neutral');

        try {
            await apiFetchEnvelope(`books/${book.id}`, { method: 'DELETE' });

            if (editingBookId === book.id) {
                resetBookForm();
            }

            setFeedback(feedback, 'Llibre eliminat correctament.', 'success');
            await loadLibrary();
        } catch (error) {
            setFeedback(feedback, getErrorMessage(error, "No s'ha pogut eliminar el llibre."), 'error');
        }
    }

    async function loadLibrary() {
        if (!authToken) {
            return;
        }

        libraryResultCopy.textContent = 'Carregant biblioteca...';

        try {
            const envelope = await apiFetchEnvelope('books', undefined, buildLibraryQueryParams(libraryState));

            library = Array.isArray(envelope.data) ? envelope.data : [];
            libraryMeta = {
                library_total: envelope.meta?.library_total ?? library.length,
                total: envelope.meta?.total ?? library.length,
                current_page: envelope.meta?.current_page ?? 1,
                last_page: envelope.meta?.last_page ?? 1,
                from: envelope.meta?.from ?? null,
                to: envelope.meta?.to ?? null,
                options: {
                    statuses: envelope.meta?.options?.statuses ?? [],
                    locations: envelope.meta?.options?.locations ?? [],
                    publishers: envelope.meta?.options?.publishers ?? [],
                    years: envelope.meta?.options?.years ?? [],
                },
            };

            populateLibraryFilters(libraryMeta.options);
            renderLibrary(library, libraryMeta, libraryElements, libraryState);
        } catch (error) {
            library = [];
            libraryMeta = defaultLibraryMeta();
            renderLibrary(library, libraryMeta, libraryElements, libraryState);
            setFeedback(feedback, getErrorMessage(error, "No s'ha pogut carregar la biblioteca."), 'error');
        }
    }

    async function hydrateFromQueryString() {
        const params = new URLSearchParams(window.location.search);
        const barcode = params.get('barcode')?.trim();

        if (!barcode) {
            return;
        }

        barcodeInput.value = barcode;
        await lookupBarcode(barcode);
    }

    function setAuthMode(mode) {
        authMode = mode;
        setHiddenValue(authForm, 'mode', mode);
        authNameField.hidden = mode !== 'register';
        authPasswordConfirmField.hidden = mode !== 'register';
        authSubmit.textContent = mode === 'register' ? 'Crear compte' : 'Entrar';
        authTitle.textContent = mode === 'register' ? 'Crear compte' : 'Entrar';
        authSwitchCopy.textContent = mode === 'register' ? 'Ja tens compte?' : 'No tens compte encara?';

        authModeTriggers.forEach((trigger) => {
            trigger.hidden = (trigger.dataset.authModeTrigger === 'register' ? 'register' : 'login') === mode;
        });

        const passwordInput = authForm.elements.namedItem('password');
        const passwordConfirmInput = authForm.elements.namedItem('password_confirmation');

        if (passwordInput instanceof HTMLInputElement) {
            passwordInput.autocomplete = mode === 'register' ? 'new-password' : 'current-password';
        }

        if (passwordConfirmInput instanceof HTMLInputElement) {
            passwordConfirmInput.required = mode === 'register';
        }
    }

    function renderSessionState() {
        const isAuthenticated = currentUser !== null && authToken !== null;

        authGuest.hidden = isAuthenticated;
        authUser.hidden = !isAuthenticated;
        appContent.hidden = !isAuthenticated;

        if (isAuthenticated && currentUser) {
            authUserName.textContent = currentUser.name;
            authUserEmail.textContent = currentUser.email;
        }
    }

    function clearSession() {
        authToken = null;
        currentUser = null;
        library = [];
        libraryMeta = defaultLibraryMeta();
        libraryState = createDefaultLibraryState();
        removeStoredToken();
        renderSessionState();
        updateLibraryFilterControls();
        renderLibrary(library, libraryMeta, libraryElements, libraryState);
        authForm.reset();
        setAuthMode('login');
        resetBookForm();
        setActiveAppTab('capture', appTabTriggers, appTabPanels);
    }

    function resetBookForm() {
        editingBookId = null;
        bookForm.reset();
        photoInput.value = '';
        barcodeInput.value = '';
        setHiddenValue(bookForm, 'book_id', '');
        setHiddenValue(bookForm, 'source', 'manual');
        bookSubmit.textContent = 'Guardar a la biblioteca';
        cancelEditButton.hidden = true;
        updatePreview(collectFormBook(bookForm), { previewTitle, previewMeta, previewDescription, previewSource, previewCover, previewCoverFallback });
    }

    function startEditingBook(book) {
        editingBookId = book.id ?? null;
        fillForm(bookForm, book);
        setHiddenValue(bookForm, 'book_id', String(book.id ?? ''));
        bookSubmit.textContent = 'Guardar canvis';
        cancelEditButton.hidden = false;
        updatePreview(book, { previewTitle, previewMeta, previewDescription, previewSource, previewCover, previewCoverFallback });
        setActiveAppTab('capture', appTabTriggers, appTabPanels);
        window.scrollTo({ top: 0, behavior: 'smooth' });
        setFeedback(feedback, 'Editant llibre existent. Modifica la fitxa i guarda els canvis.', 'neutral');
    }

    async function apiFetch(path, init, params) {
        const envelope = await apiFetchEnvelope(path, init, params);

        return envelope.data;
    }

    async function apiFetchEnvelope(path, init, params) {
        const headers = new Headers(init?.headers ?? {});

        headers.set('Accept', 'application/json');

        if (init?.body && !headers.has('Content-Type')) {
            headers.set('Content-Type', 'application/json');
        }

        if (authToken) {
            headers.set('Authorization', `Bearer ${authToken}`);
        }

        const response = await fetch(buildApiUrl(apiBaseUrl, path, params), { ...init, headers });
        const result = (await parseJson(response)) ?? {};

        if (response.status === 401) {
            clearSession();
            throw new Error(result.message ?? "La sessio ha caducat. Torna a entrar.");
        }

        if (!response.ok) {
            throw new Error(extractApiError(result, 'La peticio ha fallat.'));
        }

        return result;
    }

    function changeLibraryFilter(nextState) {
        updateLibraryState({ ...nextState, page: 1 });
        void loadLibrary();
    }

    function updateLibraryState(nextState) {
        libraryState = { ...libraryState, ...nextState };
        updateLibraryFilterControls();
    }

    function updateLibraryFilterControls() {
        librarySearch.value = libraryState.search;
        libraryStatusFilter.value = libraryState.status;
        libraryLocationFilter.value = libraryState.location;
        libraryPublisherFilter.value = libraryState.publisher;
        libraryYearFilter.value = libraryState.year;
        librarySort.value = `${libraryState.sort}:${libraryState.direction}`;
    }

    function populateLibraryFilters(options) {
        populateSelect(libraryStatusFilter, options.statuses ?? [], libraryState.status, 'Tots');
        populateSelect(libraryLocationFilter, options.locations ?? [], libraryState.location, 'Totes');
        populateSelect(libraryPublisherFilter, options.publishers ?? [], libraryState.publisher, 'Totes');
        populateSelect(libraryYearFilter, (options.years ?? []).map((year) => ({ value: String(year), label: String(year) })), libraryState.year, 'Tots');
        updateLibraryFilterControls();
    }
}

function defaultLibraryMeta() {
    return {
        library_total: 0,
        total: 0,
        current_page: 1,
        last_page: 1,
        from: null,
        to: null,
        options: {
            statuses: [],
            locations: [],
            publishers: [],
            years: [],
        },
    };
}

function createDefaultLibraryState() {
    return {
        search: '',
        status: '',
        location: '',
        publisher: '',
        year: '',
        sort: 'created_at',
        direction: 'desc',
        page: 1,
        per_page: 12,
    };
}

function buildLibraryQueryParams(state) {
    return {
        search: state.search || undefined,
        status: state.status || undefined,
        location: state.location || undefined,
        publisher: state.publisher || undefined,
        year: state.year || undefined,
        sort: state.sort,
        direction: state.direction,
        page: String(state.page),
        per_page: String(state.per_page),
    };
}

function populateSelect(select, values, selectedValue, emptyLabel) {
    const items = values.map((item) => (typeof item === 'string' ? { value: item, label: item } : item));

    select.innerHTML = [`<option value="">${escapeHtml(emptyLabel)}</option>`, ...items.map((item) => `<option value="${escapeHtml(String(item.value))}">${escapeHtml(item.label)}</option>`)].join('');
    select.value = selectedValue;
}

function setActiveAppTab(tab, triggers, panels) {
    const activeTab = tab === 'library' ? 'library' : 'capture';

    triggers.forEach((trigger) => {
        const isActive = trigger.dataset.appTabTrigger === activeTab;

        trigger.classList.toggle('is-active', isActive);
        trigger.setAttribute('aria-pressed', isActive ? 'true' : 'false');
    });
    panels.forEach((panel) => {
        panel.hidden = panel.dataset.appTabPanel !== activeTab;
    });
    storeAppTab(activeTab);
}

function resolveApiBaseUrl(configuredBase) {
    const normalizedBase = configuredBase.trim();

    if (/^https?:\/\//.test(normalizedBase)) {
        return normalizedBase.replace(/\/+$/, '');
    }

    return new URL(normalizedBase.replace(/\/?$/, '/'), window.location.origin).toString().replace(/\/+$/, '');
}

function buildApiUrl(baseUrl, path, params) {
    const url = new URL(path, `${baseUrl}/`);

    Object.entries(params ?? {}).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
            url.searchParams.set(key, value);
        }
    });

    return url.toString();
}

async function parseJson(response) {
    const text = await response.text();

    if (!text) {
        return null;
    }

    return JSON.parse(text);
}

function extractApiError(payload, fallback) {
    if (payload.message) {
        return payload.message;
    }

    const firstError = Object.values(payload.errors ?? {}).flat()[0];

    return firstError ?? fallback;
}

function loadStoredToken() {
    try {
        return window.localStorage.getItem(authTokenStorageKey);
    } catch {
        return null;
    }
}

function storeToken(token) {
    try {
        window.localStorage.setItem(authTokenStorageKey, token);
    } catch {
        // Ignore storage errors.
    }
}

function removeStoredToken() {
    try {
        window.localStorage.removeItem(authTokenStorageKey);
    } catch {
        // Ignore storage errors.
    }
}

function loadStoredAppTab() {
    try {
        return window.localStorage.getItem(appTabStorageKey) ?? 'capture';
    } catch {
        return 'capture';
    }
}

function storeAppTab(tab) {
    try {
        window.localStorage.setItem(appTabStorageKey, tab);
    } catch {
        // Ignore storage errors.
    }
}

function setFeedback(element, message, tone) {
    element.textContent = message;
    element.dataset.tone = tone;
}

function getErrorMessage(error, fallback) {
    return error instanceof Error ? error.message : fallback;
}

function collectPayload(form) {
    const formData = new FormData(form);
    const payload = {};

    for (const [key, value] of formData.entries()) {
        const normalizedValue = String(value).trim();

        if (normalizedValue !== '') {
            payload[key] = normalizedValue;
        }
    }

    if (!payload.status && form.id === 'book-form') {
        payload.status = 'pending';
    }

    return payload;
}

function fillForm(form, book) {
    const assignments = [
        ['barcode', 'barcode'],
        ['isbn10', 'isbn10'],
        ['isbn13', 'isbn13'],
        ['title', 'title'],
        ['author', 'author'],
        ['publisher', 'publisher'],
        ['published_at', 'published_at'],
        ['cover_url', 'cover_url'],
        ['description', 'description'],
        ['status', 'status'],
        ['location', 'location'],
        ['notes', 'notes'],
        ['source', 'source'],
    ];

    assignments.forEach(([field, name]) => {
        const input = form.elements.namedItem(name);
        const value = String(book[field] ?? '');

        if (input instanceof HTMLInputElement || input instanceof HTMLTextAreaElement || input instanceof HTMLSelectElement) {
            input.value = value;
        }
    });
}

function collectFormBook(form) {
    const payload = collectPayload(form);

    return {
        barcode: payload.barcode,
        isbn10: payload.isbn10,
        isbn13: payload.isbn13,
        title: payload.title,
        author: payload.author,
        publisher: payload.publisher,
        published_at: payload.published_at,
        cover_url: payload.cover_url,
        description: payload.description,
        status: payload.status,
        location: payload.location,
        notes: payload.notes,
        source: payload.source,
    };
}

function setHiddenValue(form, name, value) {
    const input = form.elements.namedItem(name);

    if (input instanceof HTMLInputElement) {
        input.value = value;
    }
}

function updatePreview(book, elements) {
    const title = book.title?.trim() || "Escaneja un llibre o entra l'ISBN manualment";
    const meta = [book.author, book.publisher, book.published_at].filter(Boolean).join(' / ') || 'La fitxa es pot revisar abans de guardar.';
    const description = book.description?.trim() || '';
    const source = book.source ? `Font: ${formatSource(book.source)}` : 'Cap llibre carregat encara';
    const coverUrl = book.cover_url?.trim() || '';

    elements.previewTitle.textContent = title;
    elements.previewMeta.textContent = meta;
    elements.previewDescription.textContent = description;
    elements.previewSource.textContent = source;

    if (coverUrl) {
        elements.previewCover.src = coverUrl;
        elements.previewCover.alt = book.title ? `Portada de ${book.title}` : 'Portada del llibre';
        elements.previewCover.hidden = false;
        elements.previewCoverFallback.hidden = true;
    } else {
        elements.previewCover.src = '';
        elements.previewCover.alt = '';
        elements.previewCover.hidden = true;
        elements.previewCoverFallback.hidden = false;
    }
}

function renderLibrary(books, meta, elements, state) {
    const visibleCount = books.length;
    const total = meta.total ?? visibleCount;
    const libraryTotal = meta.library_total ?? total;
    const from = meta.from ?? (visibleCount > 0 ? 1 : 0);
    const to = meta.to ?? visibleCount;
    const currentPage = meta.current_page ?? 1;
    const lastPage = meta.last_page ?? 1;
    const activeFilters = countActiveFilters(state);

    elements.bookCount.textContent = `${total} ${total === 1 ? 'resultat' : 'resultats'}`;
    elements.libraryTotalCount.textContent = String(libraryTotal);
    elements.libraryVisibleCount.textContent = String(total);
    elements.libraryActiveFilters.textContent = String(activeFilters);
    elements.libraryEmpty.hidden = visibleCount > 0;
    elements.libraryPrevPage.disabled = currentPage <= 1;
    elements.libraryNextPage.disabled = currentPage >= lastPage;
    elements.libraryPageInfo.textContent = total > 0 ? `Pagina ${currentPage} de ${lastPage}` : 'Sense resultats';
    elements.libraryResultCopy.textContent = total > 0
        ? `Mostrant ${from}-${to} de ${total} llibres.`
        : activeFilters > 0 ? 'Cap llibre coincideix amb els filtres actuals.' : 'Encara no tens llibres desats.';

    elements.libraryGrid.innerHTML = books.map((book) => {
        const metaLine = [book.author, book.publisher, book.published_year ?? book.published_at].filter(Boolean).join(' / ');
        const tags = [statusLabels[book.status ?? 'pending'] ?? 'Per llegir', book.location, book.source ? formatSource(book.source) : null].filter(Boolean);
        const identifiers = [book.isbn13, book.isbn10, book.barcode].filter(Boolean).join(' / ');
        const description = truncate(book.description ?? '', 200);
        const notes = truncate(book.notes ?? '', 120);

        return `
            <article class="book-card">
                <div class="book-card-cover">
                    ${book.cover_url ? `<img src="${escapeHtml(book.cover_url)}" alt="Portada de ${escapeHtml(book.title ?? 'llibre')}" loading="lazy" />` : '<div class="book-card-cover-fallback">Sense portada</div>'}
                </div>
                <div class="book-card-body">
                    <p class="book-card-status">${escapeHtml(statusLabels[book.status ?? 'pending'] ?? 'Per llegir')}</p>
                    <h3>${escapeHtml(book.title ?? 'Sense titol')}</h3>
                    <p class="book-card-meta">${escapeHtml(metaLine || 'Autor, editorial o any pendents')}</p>
                    <div class="book-card-tags">${tags.map((tag) => `<span class="book-tag">${escapeHtml(tag)}</span>`).join('')}</div>
                    ${identifiers ? `<p class="book-card-isbn">${escapeHtml(identifiers)}</p>` : ''}
                    <p class="book-card-description">${escapeHtml(description || 'Sense descripcio')}</p>
                    ${notes ? `<p class="book-card-notes">${escapeHtml(notes)}</p>` : ''}
                    <div class="book-card-actions">
                        <button class="button button-ghost button-small" type="button" data-edit-book-id="${Number(book.id ?? 0)}">Editar</button>
                        <button class="button button-ghost button-small" type="button" data-delete-book-id="${Number(book.id ?? 0)}">Eliminar</button>
                    </div>
                </div>
            </article>
        `;
    }).join('');
}

function countActiveFilters(state) {
    return [state.search, state.status, state.location, state.publisher, state.year].filter((value) => String(value ?? '').trim() !== '').length;
}

function formatSource(source) {
    switch (source) {
        case 'open_library':
            return 'Open Library';
        case 'google_books':
            return 'Google Books';
        case 'manual':
            return 'Manual';
        default:
            return source;
    }
}

function truncate(value, maxLength) {
    const cleaned = value.trim();

    if (cleaned.length <= maxLength) {
        return cleaned;
    }

    return `${cleaned.slice(0, maxLength - 1).trimEnd()}...`;
}

function escapeHtml(value) {
    return String(value)
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');
}

async function decodeBarcodeFromPhoto(file, reader) {
    const imageBitmap = await createImageBitmap(file);

    try {
        const detectorCode = await tryBarcodeDetector(imageBitmap);

        if (detectorCode) {
            return detectorCode;
        }

        for (const canvas of buildCanvasVariants(imageBitmap)) {
            try {
                const result = reader.decodeFromCanvas(canvas);

                if (result.getText()) {
                    return result.getText();
                }
            } catch {
                // Continue with the next variant.
            }
        }
    } finally {
        imageBitmap.close();
    }

    throw new Error("No s'ha pogut detectar cap codi a la foto.");
}

async function tryBarcodeDetector(source) {
    const Detector = getBarcodeDetector();

    if (!Detector) {
        return null;
    }

    try {
        const detector = new Detector({ formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128'] });
        const results = await detector.detect(source);
        const rawValue = results.find((result) => result.rawValue)?.rawValue?.trim();

        return rawValue || null;
    } catch {
        return null;
    }
}

function getBarcodeDetector() {
    const candidate = globalThis.BarcodeDetector;

    return typeof candidate === 'function' ? candidate : null;
}

function buildCanvasVariants(imageBitmap) {
    const variants = [];
    const baseWidths = [1800, 1400, 1000, 700];

    for (const width of baseWidths) {
        variants.push(drawCanvasVariant(imageBitmap, 0, 0, imageBitmap.width, imageBitmap.height, width));
        variants.push(drawCanvasVariant(imageBitmap, 0, Math.floor(imageBitmap.height * 0.45), imageBitmap.width, Math.floor(imageBitmap.height * 0.35), width));
        variants.push(drawCanvasVariant(imageBitmap, Math.floor(imageBitmap.width * 0.08), Math.floor(imageBitmap.height * 0.35), Math.floor(imageBitmap.width * 0.84), Math.floor(imageBitmap.height * 0.4), width));
    }

    return variants;
}

function drawCanvasVariant(imageBitmap, sourceX, sourceY, sourceWidth, sourceHeight, targetWidth) {
    const width = Math.max(320, Math.min(targetWidth, sourceWidth));
    const scale = width / sourceWidth;
    const height = Math.max(120, Math.round(sourceHeight * scale));
    const canvas = document.createElement('canvas');

    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext('2d', { willReadFrequently: true });

    if (!context) {
        return canvas;
    }

    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';
    context.drawImage(imageBitmap, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, width, height);
    applyContrastPass(context, width, height);

    return canvas;
}

function applyContrastPass(context, width, height) {
    const imageData = context.getImageData(0, 0, width, height);
    const { data } = imageData;

    for (let index = 0; index < data.length; index += 4) {
        const grayscale = data[index] * 0.299 + data[index + 1] * 0.587 + data[index + 2] * 0.114;
        const boosted = grayscale > 145 ? 255 : 0;

        data[index] = boosted;
        data[index + 1] = boosted;
        data[index + 2] = boosted;
    }

    context.putImageData(imageData, 0, 0);
}
