import { BrowserMultiFormatReader } from '@zxing/browser';
import { BarcodeFormat, DecodeHintType } from '@zxing/library';

type StatusTone = 'neutral' | 'success' | 'error';
type AuthMode = 'login' | 'register';

type User = {
	id: number;
	name: string;
	email: string;
};

type Book = {
	id?: number;
	user_id?: number | null;
	barcode?: string | null;
	isbn10?: string | null;
	isbn13?: string | null;
	title?: string | null;
	author?: string | null;
	publisher?: string | null;
	description?: string | null;
	cover_url?: string | null;
	published_at?: string | null;
	status?: string | null;
	location?: string | null;
	notes?: string | null;
	source?: string | null;
};

type ApiResponse<T> = {
	data?: T;
	message?: string;
	errors?: Record<string, string[]>;
};

type AuthPayload = {
	token: string;
	user: User;
};

type BarcodeDetectorLike = {
	detect: (source: ImageBitmapSource) => Promise<Array<{ rawValue?: string }>>;
};

const authTokenStorageKey = 'biblioCasa.authToken';
const statusLabels: Record<string, string> = {
	pending: 'Per llegir',
	reading: 'Llegint',
	read: 'Llegit',
	loaned: 'Deixat',
};

export default function setupLibraryApp(): void {
	const root = document.querySelector<HTMLElement>('[data-api-base-url]');

	if (!root) {
		return;
	}

	const apiBaseUrl = resolveApiBaseUrl(root.dataset.apiBaseUrl ?? '/api');
	const authForm = document.querySelector<HTMLFormElement>('#auth-form');
	const authStatus = document.querySelector<HTMLElement>('#auth-status');
	const authNameField = document.querySelector<HTMLElement>('#auth-name-field');
	const authPasswordConfirmField = document.querySelector<HTMLElement>('#auth-password-confirm-field');
	const authSubmit = document.querySelector<HTMLButtonElement>('#auth-submit');
	const authTitle = document.querySelector<HTMLElement>('#auth-title');
	const authSwitchCopy = document.querySelector<HTMLElement>('#auth-switch-copy');
	const authModeTriggers = Array.from(document.querySelectorAll<HTMLButtonElement>('[data-auth-mode-trigger]'));
	const authGuest = document.querySelector<HTMLElement>('#auth-guest');
	const authUser = document.querySelector<HTMLElement>('#auth-user');
	const authUserName = document.querySelector<HTMLElement>('#auth-user-name');
	const authUserEmail = document.querySelector<HTMLElement>('#auth-user-email');
	const logoutButton = document.querySelector<HTMLButtonElement>('#logout-button');
	const appContent = document.querySelector<HTMLElement>('#app-content');
	const photoInput = document.querySelector<HTMLInputElement>('#barcode-photo');
	const lookupForm = document.querySelector<HTMLFormElement>('#lookup-form');
	const barcodeInput = document.querySelector<HTMLInputElement>('#barcode-input');
	const feedback = document.querySelector<HTMLElement>('#scan-status');
	const bookForm = document.querySelector<HTMLFormElement>('#book-form');
	const resetButton = document.querySelector<HTMLButtonElement>('#reset-form');
	const libraryGrid = document.querySelector<HTMLElement>('#library-grid');
	const libraryEmpty = document.querySelector<HTMLElement>('#library-empty');
	const librarySearch = document.querySelector<HTMLInputElement>('#library-search');
	const bookCount = document.querySelector<HTMLElement>('#book-count');
	const previewTitle = document.querySelector<HTMLElement>('#preview-title');
	const previewMeta = document.querySelector<HTMLElement>('#preview-meta');
	const previewDescription = document.querySelector<HTMLElement>('#preview-description');
	const previewSource = document.querySelector<HTMLElement>('#preview-source');
	const previewCover = document.querySelector<HTMLImageElement>('#preview-cover');
	const previewCoverFallback = document.querySelector<HTMLElement>('#preview-cover-fallback');

	if (
		!authForm ||
		!authStatus ||
		!authNameField ||
		!authPasswordConfirmField ||
		!authSubmit ||
		!authTitle ||
		!authSwitchCopy ||
		!authGuest ||
		!authUser ||
		!authUserName ||
		!authUserEmail ||
		!logoutButton ||
		!appContent ||
		!photoInput ||
		!lookupForm ||
		!barcodeInput ||
		!feedback ||
		!bookForm ||
		!resetButton ||
		!libraryGrid ||
		!libraryEmpty ||
		!librarySearch ||
		!bookCount ||
		!previewTitle ||
		!previewMeta ||
		!previewDescription ||
		!previewSource ||
		!previewCover ||
		!previewCoverFallback
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
	let authMode: AuthMode = 'login';
	let authToken = loadStoredToken();
	let currentUser: User | null = null;
	let library: Book[] = [];

	setAuthMode('login');
	setFeedback(authStatus, 'Identifica t per veure i guardar els teus llibres.', 'neutral');
	setFeedback(feedback, 'Inicia sessio per carregar la teva biblioteca.', 'neutral');
	updatePreview(collectFormBook(bookForm), {
		previewTitle,
		previewMeta,
		previewDescription,
		previewSource,
		previewCover,
		previewCoverFallback,
	});
	renderSessionState();

	if (authToken) {
		void hydrateSession();
	}

	authModeTriggers.forEach((trigger) => {
		trigger.addEventListener('click', () => {
			setAuthMode(trigger.dataset.authModeTrigger === 'register' ? 'register' : 'login');
		});
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

	librarySearch.addEventListener('input', () => {
		renderLibrary(library, librarySearch.value, libraryGrid, libraryEmpty, bookCount);
	});

	bookForm.addEventListener('input', () => {
		updatePreview(collectFormBook(bookForm), {
			previewTitle,
			previewMeta,
			previewDescription,
			previewSource,
			previewCover,
			previewCoverFallback,
		});
	});

	async function hydrateSession(): Promise<void> {
		try {
			const payload = await apiFetch<{ user: User }>('auth/me');

			if (!payload.user) {
				throw new Error('No s ha pogut recuperar la sessio.');
			}

			currentUser = payload.user;
			renderSessionState();
			setFeedback(authStatus, 'Sessio recuperada correctament.', 'success');
			setFeedback(feedback, 'Prepara la captura fent una foto del codi o entrant l ISBN manualment.', 'neutral');
			await loadLibrary();
			await hydrateFromQueryString();
		} catch (error) {
			clearSession();
			setFeedback(authStatus, getErrorMessage(error, 'La sessio guardada ja no es valida.'), 'error');
		}
	}

	async function submitAuthForm(): Promise<void> {
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
				headers: {
					Accept: 'application/json',
					'Content-Type': 'application/json',
				},
				body: JSON.stringify(payload),
			});
			const result = (await parseJson<ApiResponse<AuthPayload>>(response)) ?? {};

			if (!response.ok || !result.data?.token || !result.data.user) {
				throw new Error(extractApiError(result, authMode === 'register' ? 'No s ha pogut crear el compte.' : 'No s ha pogut iniciar sessio.'));
			}

			authToken = result.data.token;
			currentUser = result.data.user;
			storeToken(authToken);
			authForm.reset();
			setAuthMode('login');
			renderSessionState();
			setFeedback(authStatus, authMode === 'register' ? 'Compte creat correctament.' : 'Sessio iniciada.', 'success');
			setFeedback(feedback, 'Prepara la captura fent una foto del codi o entrant l ISBN manualment.', 'neutral');
			await loadLibrary();
			await hydrateFromQueryString();
		} catch (error) {
			setFeedback(authStatus, getErrorMessage(error, 'No s ha pogut completar l autenticacio.'), 'error');
		}
	}

	async function logout(): Promise<void> {
		try {
			if (authToken) {
				await apiFetch<null>('auth/logout', {
					method: 'POST',
				});
			}
		} catch {
			// Ignore logout errors and clear the session locally.
		}

		clearSession();
		setFeedback(authStatus, 'Sessio tancada.', 'neutral');
		setFeedback(feedback, 'Inicia sessio per carregar la teva biblioteca.', 'neutral');
	}

	async function lookupFromPhoto(): Promise<void> {
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
			setFeedback(
				feedback,
				getErrorMessage(error, 'No s ha pogut detectar cap codi a la foto. Torna la a fer amb mes llum i el codi ocupant quasi tota l amplada.'),
				'error',
			);
		}
	}

	async function lookupBarcode(rawBarcode: string): Promise<void> {
		const barcode = rawBarcode.trim();

		if (!barcode) {
			setFeedback(feedback, 'Introdueix o escaneja un ISBN abans de buscar.', 'error');
			return;
		}

		setFeedback(feedback, 'Consultant Open Library i Google Books...', 'neutral');

		try {
			const payload = await apiFetch<Book>('books/lookup', undefined, { barcode });

			if (!payload) {
				throw new Error('No s ha trobat cap llibre amb aquest codi.');
			}

			fillForm(bookForm, payload);
			updatePreview(payload, {
				previewTitle,
				previewMeta,
				previewDescription,
				previewSource,
				previewCover,
				previewCoverFallback,
			});
			setFeedback(feedback, 'Fitxa localitzada. Revisa la i desa la quan vulguis.', 'success');
		} catch (error) {
			setFeedback(feedback, getErrorMessage(error, 'No s ha pogut recuperar la fitxa del llibre.'), 'error');
		}
	}

	async function saveBook(): Promise<void> {
		const payload = collectPayload(bookForm);

		if (!payload.title) {
			setFeedback(feedback, 'El titol es obligatori per desar el llibre.', 'error');
			return;
		}

		setFeedback(feedback, 'Desant llibre a la biblioteca...', 'neutral');

		try {
			const result = await apiFetch<Book>('books', {
				method: 'POST',
				body: JSON.stringify(payload),
			});

			fillForm(bookForm, result);
			updatePreview(result, {
				previewTitle,
				previewMeta,
				previewDescription,
				previewSource,
				previewCover,
				previewCoverFallback,
			});
			setFeedback(feedback, 'Llibre desat correctament.', 'success');
			await loadLibrary();
		} catch (error) {
			setFeedback(feedback, getErrorMessage(error, 'No s ha pogut desar el llibre.'), 'error');
		}
	}

	async function loadLibrary(): Promise<void> {
		try {
			const payload = await apiFetch<Book[]>('books');

			if (!Array.isArray(payload)) {
				throw new Error('No s ha pogut carregar la biblioteca.');
			}

			library = payload;
			renderLibrary(library, librarySearch.value, libraryGrid, libraryEmpty, bookCount);
		} catch (error) {
			setFeedback(feedback, getErrorMessage(error, 'No s ha pogut carregar la biblioteca.'), 'error');
		}
	}

	async function hydrateFromQueryString(): Promise<void> {
		const params = new URLSearchParams(window.location.search);
		const barcode = params.get('barcode')?.trim();

		if (!barcode) {
			return;
		}

		barcodeInput.value = barcode;
		await lookupBarcode(barcode);
	}

	function setAuthMode(mode: AuthMode): void {
		authMode = mode;
		setHiddenValue(authForm, 'mode', mode);
		authNameField.hidden = mode !== 'register';
		authPasswordConfirmField.hidden = mode !== 'register';
		authSubmit.textContent = mode === 'register' ? 'Crear compte' : 'Entrar';
		authTitle.textContent = mode === 'register' ? 'Crear compte' : 'Entrar';
		authSwitchCopy.textContent = mode === 'register' ? 'Ja tens compte?' : 'No tens compte encara?';

		authModeTriggers.forEach((trigger) => {
			const triggerMode = trigger.dataset.authModeTrigger === 'register' ? 'register' : 'login';

			trigger.hidden = triggerMode === mode;
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

	function renderSessionState(): void {
		const isAuthenticated = currentUser !== null && authToken !== null;

		authGuest.hidden = isAuthenticated;
		authUser.hidden = !isAuthenticated;
		appContent.hidden = !isAuthenticated;

		if (isAuthenticated && currentUser) {
			authUserName.textContent = currentUser.name;
			authUserEmail.textContent = currentUser.email;
		}
	}

	function clearSession(): void {
		authToken = null;
		currentUser = null;
		library = [];
		removeStoredToken();
		renderSessionState();
		renderLibrary([], '', libraryGrid, libraryEmpty, bookCount);
		librarySearch.value = '';
		authForm.reset();
		setAuthMode('login');
		resetBookForm();
	}

	function resetBookForm(): void {
		bookForm.reset();
		photoInput.value = '';
		barcodeInput.value = '';
		setHiddenValue(bookForm, 'source', 'manual');
		updatePreview(collectFormBook(bookForm), {
			previewTitle,
			previewMeta,
			previewDescription,
			previewSource,
			previewCover,
			previewCoverFallback,
		});
	}

	async function apiFetch<T>(path: string, init?: RequestInit, params?: Record<string, string>): Promise<T> {
		const headers = new Headers(init?.headers ?? {});

		headers.set('Accept', 'application/json');

		if (init?.body && !headers.has('Content-Type')) {
			headers.set('Content-Type', 'application/json');
		}

		if (authToken) {
			headers.set('Authorization', `Bearer ${authToken}`);
		}

		const response = await fetch(buildApiUrl(apiBaseUrl, path, params), {
			...init,
			headers,
		});
		const result = (await parseJson<ApiResponse<T>>(response)) ?? {};

		if (response.status === 401) {
			clearSession();
			throw new Error(result.message ?? 'La sessio ha caducat. Torna a entrar.');
		}

		if (!response.ok) {
			throw new Error(extractApiError(result, 'La peticio ha fallat.'));
		}

		return result.data as T;
	}
}

function resolveApiBaseUrl(configuredBase: string): string {
	const normalizedBase = configuredBase.trim();

	if (/^https?:\/\//.test(normalizedBase)) {
		return normalizedBase.replace(/\/+$/, '');
	}

	return new URL(normalizedBase.replace(/\/?$/, '/'), window.location.origin).toString().replace(/\/+$/, '');
}

function buildApiUrl(baseUrl: string, path: string, params?: Record<string, string>): string {
	const url = new URL(path, `${baseUrl}/`);

	Object.entries(params ?? {}).forEach(([key, value]) => {
		url.searchParams.set(key, value);
	});

	return url.toString();
}

async function parseJson<T>(response: Response): Promise<T | null> {
	const text = await response.text();

	if (!text) {
		return null;
	}

	return JSON.parse(text) as T;
}

function extractApiError(payload: ApiResponse<unknown>, fallback: string): string {
	if (payload.message) {
		return payload.message;
	}

	const firstError = Object.values(payload.errors ?? {}).flat()[0];

	return firstError ?? fallback;
}

function loadStoredToken(): string | null {
	try {
		return window.localStorage.getItem(authTokenStorageKey);
	} catch {
		return null;
	}
}

function storeToken(token: string): void {
	try {
		window.localStorage.setItem(authTokenStorageKey, token);
	} catch {
		// Ignore storage errors.
	}
}

function removeStoredToken(): void {
	try {
		window.localStorage.removeItem(authTokenStorageKey);
	} catch {
		// Ignore storage errors.
	}
}

function setFeedback(element: HTMLElement, message: string, tone: StatusTone): void {
	element.textContent = message;
	element.dataset.tone = tone;
}

function getErrorMessage(error: unknown, fallback: string): string {
	return error instanceof Error ? error.message : fallback;
}

function collectPayload(form: HTMLFormElement): Record<string, string> {
	const formData = new FormData(form);
	const payload: Record<string, string> = {};

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

function fillForm(form: HTMLFormElement, book: Book): void {
	const assignments: Array<[keyof Book, string]> = [
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

function collectFormBook(form: HTMLFormElement): Book {
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

function setHiddenValue(form: HTMLFormElement, name: string, value: string): void {
	const input = form.elements.namedItem(name);

	if (input instanceof HTMLInputElement) {
		input.value = value;
	}
}

function updatePreview(
	book: Book,
	elements: {
		previewTitle: HTMLElement;
		previewMeta: HTMLElement;
		previewDescription: HTMLElement;
		previewSource: HTMLElement;
		previewCover: HTMLImageElement;
		previewCoverFallback: HTMLElement;
	},
): void {
	const title = book.title?.trim() || "Escaneja un llibre o entra l'ISBN manualment";
	const meta = [book.author, book.publisher, book.published_at].filter(Boolean).join(' · ') || 'La fitxa es pot revisar abans de guardar.';
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

function renderLibrary(
	library: Book[],
	query: string,
	container: HTMLElement,
	emptyState: HTMLElement,
	counter: HTMLElement,
): void {
	const normalizedQuery = query.trim().toLowerCase();
	const filteredBooks = library.filter((book) => {
		if (!normalizedQuery) {
			return true;
		}

		return [book.title, book.author, book.publisher, book.location]
			.filter(Boolean)
			.some((value) => String(value).toLowerCase().includes(normalizedQuery));
	});

	counter.textContent = `${filteredBooks.length} ${filteredBooks.length === 1 ? 'llibre' : 'llibres'}`;
	emptyState.hidden = filteredBooks.length > 0;
	container.innerHTML = filteredBooks
		.map((book) => {
			const meta = [book.author, book.publisher].filter(Boolean).join(' · ');
			const footer = [statusLabels[book.status ?? 'pending'] ?? 'Per llegir', book.location].filter(Boolean).join(' · ');
			const description = truncate(book.description ?? '', 160);

			return `
				<article class="book-card">
					<div class="book-card-cover">
						${book.cover_url ? `<img src="${escapeHtml(book.cover_url)}" alt="Portada de ${escapeHtml(book.title ?? 'llibre')}" loading="lazy" />` : '<div class="book-card-cover-fallback">Sense portada</div>'}
					</div>
					<div class="book-card-body">
						<p class="book-card-status">${escapeHtml(statusLabels[book.status ?? 'pending'] ?? 'Per llegir')}</p>
						<h3>${escapeHtml(book.title ?? 'Sense titol')}</h3>
						<p class="book-card-meta">${escapeHtml(meta || 'Autor o editorial pendents')}</p>
						<p class="book-card-description">${escapeHtml(description || 'Sense descripcio')}</p>
						<p class="book-card-footer">${escapeHtml(footer || 'Sense ubicacio definida')}</p>
					</div>
				</article>
			`;
		})
		.join('');
}

function formatSource(source: string): string {
	switch (source) {
		case 'open_library':
			return 'Open Library';
		case 'google_books':
			return 'Google Books';
		case 'manual':
			return 'Entrada manual';
		default:
			return source;
	}
}

function truncate(value: string, maxLength: number): string {
	const cleaned = value.trim();

	if (cleaned.length <= maxLength) {
		return cleaned;
	}

	return `${cleaned.slice(0, maxLength - 1).trimEnd()}...`;
}

function escapeHtml(value: string): string {
	return value
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;')
		.replaceAll("'", '&#39;');
}

async function decodeBarcodeFromPhoto(file: File, reader: BrowserMultiFormatReader): Promise<string> {
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

	throw new Error('No s ha pogut detectar cap codi a la foto.');
}

async function tryBarcodeDetector(source: ImageBitmap): Promise<string | null> {
	const Detector = getBarcodeDetector();

	if (!Detector) {
		return null;
	}

	try {
		const detector = new Detector({
			formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128'],
		});
		const results = await detector.detect(source);
		const rawValue = results.find((result) => result.rawValue)?.rawValue?.trim();

		return rawValue || null;
	} catch {
		return null;
	}
}

function getBarcodeDetector(): (new (options?: { formats?: string[] }) => BarcodeDetectorLike) | null {
	const candidate = (globalThis as { BarcodeDetector?: new (options?: { formats?: string[] }) => BarcodeDetectorLike }).BarcodeDetector;

	return typeof candidate === 'function' ? candidate : null;
}

function buildCanvasVariants(imageBitmap: ImageBitmap): HTMLCanvasElement[] {
	const variants: HTMLCanvasElement[] = [];
	const baseWidths = [1800, 1400, 1000, 700];

	for (const width of baseWidths) {
		variants.push(drawCanvasVariant(imageBitmap, 0, 0, imageBitmap.width, imageBitmap.height, width));
		variants.push(drawCanvasVariant(imageBitmap, 0, Math.floor(imageBitmap.height * 0.45), imageBitmap.width, Math.floor(imageBitmap.height * 0.35), width));
		variants.push(
			drawCanvasVariant(
				imageBitmap,
				Math.floor(imageBitmap.width * 0.08),
				Math.floor(imageBitmap.height * 0.35),
				Math.floor(imageBitmap.width * 0.84),
				Math.floor(imageBitmap.height * 0.4),
				width,
			),
		);
	}

	return variants;
}

function drawCanvasVariant(
	imageBitmap: ImageBitmap,
	sourceX: number,
	sourceY: number,
	sourceWidth: number,
	sourceHeight: number,
	targetWidth: number,
): HTMLCanvasElement {
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

function applyContrastPass(context: CanvasRenderingContext2D, width: number, height: number): void {
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
