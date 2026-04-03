<!DOCTYPE html>
<html lang="ca">
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <meta name="description" content="Biblio Casa per escanejar ISBN i desar llibres a la teva biblioteca personal.">
        <meta name="theme-color" content="#17120d">
        <title>{{ config('app.name', 'Biblio Casa') }}</title>
        <link rel="preconnect" href="https://fonts.googleapis.com">
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
        <link href="https://fonts.googleapis.com/css2?family=Chakra+Petch:wght@500;600;700&family=Space+Mono:wght@400;700&display=swap" rel="stylesheet">
        @vite(['resources/css/app.css', 'resources/js/app.js'])
    </head>
    <body>
        <main class="app-shell" data-api-base-url="{{ url('/api') }}">
            <section class="panel auth-panel">
                <div class="auth-panel-grid">
                    <div id="auth-guest">
                        <div class="panel-heading">
                            <div>
                                <p class="panel-kicker">Compte</p>
                                <h2 id="auth-title">Entrar</h2>
                            </div>
                            <span class="pill">Privada</span>
                        </div>

                        <form id="auth-form" class="auth-form">
                            <input name="mode" type="hidden" value="login">

                            <label id="auth-name-field" hidden>
                                <span>Nom</span>
                                <input name="name" type="text" autocomplete="name" placeholder="Marta">
                            </label>
                            <label>
                                <span>Email</span>
                                <input name="email" type="email" autocomplete="email" placeholder="tu@exemple.com" required>
                            </label>
                            <label>
                                <span>Contrasenya</span>
                                <input name="password" type="password" autocomplete="current-password" required>
                            </label>
                            <label id="auth-password-confirm-field" hidden>
                                <span>Repeteix la contrasenya</span>
                                <input name="password_confirmation" type="password" autocomplete="new-password">
                            </label>

                            <div class="form-actions">
                                <button id="auth-submit" class="button button-primary" type="submit">Entrar</button>
                            </div>
                        </form>

                        <div class="auth-mode-switch">
                            <p id="auth-switch-copy" class="auth-switch-copy">No tens compte encara?</p>
                            <button class="auth-mode-trigger auth-mode-link" type="button" data-auth-mode-trigger="login" hidden>
                                Ja tinc compte
                            </button>
                            <button class="auth-mode-trigger auth-mode-link" type="button" data-auth-mode-trigger="register">
                                Crear compte
                            </button>
                        </div>

                        <p id="auth-status" class="feedback" data-tone="neutral">
                            Identifica't per veure i guardar els teus llibres.
                        </p>
                    </div>

                    <div id="auth-user" class="auth-user" hidden>
                        <div class="panel-heading">
                            <div>
                                <p class="panel-kicker">Sessio activa</p>
                                <h2 id="auth-user-name">Usuari</h2>
                            </div>
                            <span class="pill">Online</span>
                        </div>

                        <p id="auth-user-email" class="auth-user-email"></p>
                        <p class="auth-user-copy">
                            Aquesta biblioteca nomes mostra els llibres del teu compte.
                        </p>

                        <div class="form-actions">
                            <button id="logout-button" class="button button-ghost" type="button">Tancar sessio</button>
                        </div>
                    </div>
                </div>
            </section>

            <div id="app-content" hidden>
                <nav class="app-tabs" aria-label="Seccions de l'aplicacio">
                    <button class="app-tab is-active" type="button" data-app-tab-trigger="capture">Captura i fitxa</button>
                    <button class="app-tab" type="button" data-app-tab-trigger="library">Biblioteca</button>
                </nav>

                <section class="app-tab-panel" data-app-tab-panel="capture">
                    <section class="workspace">
                        <article class="panel capture-panel">
                            <div class="panel-heading">
                                <div>
                                    <p class="panel-kicker">Pas 1</p>
                                    <h2>Captura del codi</h2>
                                </div>
                                <span class="pill">ISBN</span>
                            </div>

                            <div class="alt-capture">
                                <label class="file-button file-button-primary" for="barcode-photo">Fer foto del codi</label>
                                <input id="barcode-photo" type="file" accept="image/*" capture="environment">
                                <p class="helper-text">
                                    Fes la foto ben a prop i amb bona llum per detectar millor l'ISBN.
                                </p>
                            </div>

                            <form id="lookup-form" class="lookup-form">
                                <label for="barcode-input">Entrada manual</label>
                                <div class="inline-form">
                                    <input
                                        id="barcode-input"
                                        name="barcode"
                                        type="text"
                                        inputmode="numeric"
                                        autocomplete="off"
                                        placeholder="9788499890944"
                                    >
                                    <button class="button button-tertiary" type="submit">Buscar</button>
                                </div>
                            </form>

                            <p id="scan-status" class="feedback" data-tone="neutral">
                                Prepara la captura fent una foto del codi o entrant l'ISBN manualment.
                            </p>
                        </article>

                        <article class="panel editor-panel">
                            <div class="panel-heading">
                                <div>
                                    <p class="panel-kicker">Pas 2</p>
                                    <h2>Fitxa del llibre</h2>
                                </div>
                                <span class="pill">Editable</span>
                            </div>

                            <div id="book-preview" class="book-preview">
                                <div class="cover-shell">
                                    <img id="preview-cover" src="" alt="" hidden>
                                    <div id="preview-cover-fallback" class="cover-fallback">Sense portada</div>
                                </div>
                                <div class="preview-copy">
                                    <p id="preview-source" class="preview-source">Cap llibre carregat encara</p>
                                    <h3 id="preview-title">Escaneja un llibre o entra l'ISBN manualment</h3>
                                    <p id="preview-meta" class="preview-meta">La fitxa es pot revisar abans de guardar.</p>
                                    <p id="preview-description" class="preview-description"></p>
                                </div>
                            </div>

                            <form id="book-form" class="book-form">
                                <input name="book_id" type="hidden">
                                <input name="barcode" type="hidden">
                                <input name="isbn10" type="hidden">
                                <input name="isbn13" type="hidden">
                                <input name="source" type="hidden" value="manual">

                                <div class="field-grid">
                                    <label>
                                        <span>Titol</span>
                                        <input name="title" type="text" required>
                                    </label>
                                    <label>
                                        <span>Autor</span>
                                        <input name="author" type="text">
                                    </label>
                                    <label>
                                        <span>Editorial</span>
                                        <input name="publisher" type="text">
                                    </label>
                                    <label>
                                        <span>Publicacio</span>
                                        <input name="published_at" type="text" placeholder="2024">
                                    </label>
                                    <label>
                                        <span>Estat</span>
                                        <select name="status">
                                            <option value="pending">Per llegir</option>
                                            <option value="reading">Llegint</option>
                                            <option value="read">Llegit</option>
                                            <option value="loaned">Deixat</option>
                                        </select>
                                    </label>
                                    <label>
                                        <span>Ubicacio</span>
                                        <input name="location" type="text" placeholder="Menjador, estudi...">
                                    </label>
                                    <label class="field-full">
                                        <span>Portada</span>
                                        <input name="cover_url" type="url" placeholder="https://...">
                                    </label>
                                    <label class="field-full">
                                        <span>Descripcio</span>
                                        <textarea name="description" rows="4"></textarea>
                                    </label>
                                    <label class="field-full">
                                        <span>Notes</span>
                                        <textarea name="notes" rows="3" placeholder="Prestec, dedicat, edicio especial..."></textarea>
                                    </label>
                                </div>

                            <div class="form-actions">
                                <button id="book-submit" class="button button-primary" type="submit">Guardar a la biblioteca</button>
                                <button id="cancel-edit" class="button button-ghost" type="button" hidden>Cancelar edicio</button>
                                <button id="reset-form" class="button button-ghost" type="button">Netejar fitxa</button>
                            </div>
                        </form>
                        </article>
                    </section>
                </section>

                <section class="app-tab-panel" data-app-tab-panel="library" hidden>
                    <section class="panel library-hero">
                        <div class="library-hero-copy">
                            <p class="panel-kicker">Biblioteca</p>
                            <p class="helper-text">
                                Cerca per titol, autor, editorial, ubicacio, ISBN, any o notes. Filtra i ordena sense
                                carregar tota la biblioteca al navegador.
                            </p>
                        </div>

                        <div class="library-kpis">
                            <article class="library-kpi">
                                <span>Total</span>
                                <strong id="library-total-count">0</strong>
                            </article>
                            <article class="library-kpi">
                                <span>Resultats</span>
                                <strong id="library-visible-count">0</strong>
                            </article>
                            <article class="library-kpi">
                                <span>Filtres actius</span>
                                <strong id="library-active-filters">0</strong>
                            </article>
                        </div>
                    </section>

                    <section class="panel library-panel">
                        <div class="panel-heading">
                            <div>
                                <p class="panel-kicker">Cataleg</p>
                                <h2>Biblioteca desada</h2>
                            </div>
                            <span id="book-count" class="pill">0 llibres</span>
                        </div>

                        <div class="catalog-toolbar">
                            <label class="catalog-search">
                                <span>Cerca global</span>
                                <input id="library-search" type="search" placeholder="Titol, autor, editorial, ubicacio, ISBN o notes">
                            </label>

                            <label>
                                <span>Ordena</span>
                                <select id="library-sort">
                                    <option value="created_at:desc">Ultims afegits</option>
                                    <option value="title:asc">Titol A-Z</option>
                                    <option value="author:asc">Autor A-Z</option>
                                    <option value="publisher:asc">Editorial A-Z</option>
                                    <option value="location:asc">Ubicacio A-Z</option>
                                    <option value="published_year:desc">Any nou primer</option>
                                    <option value="published_year:asc">Any antic primer</option>
                                </select>
                            </label>

                            <button id="library-clear-filters" class="button button-ghost" type="button">Netejar filtres</button>
                        </div>

                        <div class="catalog-filters">
                            <label>
                                <span>Estat</span>
                                <select id="library-status-filter">
                                    <option value="">Tots</option>
                                </select>
                            </label>
                            <label>
                                <span>Ubicacio</span>
                                <select id="library-location-filter">
                                    <option value="">Totes</option>
                                </select>
                            </label>
                            <label>
                                <span>Editorial</span>
                                <select id="library-publisher-filter">
                                    <option value="">Totes</option>
                                </select>
                            </label>
                            <label>
                                <span>Any</span>
                                <select id="library-year-filter">
                                    <option value="">Tots</option>
                                </select>
                            </label>
                        </div>

                        <div class="library-summary">
                            <p id="library-result-copy" class="library-result-copy">
                                Carregant biblioteca...
                            </p>

                            <div class="pagination-controls">
                                <button id="library-prev-page" class="button button-ghost" type="button">Anterior</button>
                                <span id="library-page-info" class="pagination-copy">Pagina 1</span>
                                <button id="library-next-page" class="button button-ghost" type="button">Seguent</button>
                            </div>
                        </div>

                        <p id="library-empty" class="empty-state">
                            Encara no hi ha llibres desats. El primer que guardis apareixera aqui.
                        </p>
                        <div id="library-grid" class="library-grid"></div>
                    </section>
                </section>
            </div>
        </main>
    </body>
</html>
