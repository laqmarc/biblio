# Biblio Casa

Aplicatiu web per catalogar llibres de casa amb una sola aplicacio Laravel.

## Que fa

- Login i registre d usuaris
- Biblioteca separada per usuari
- Escaneig d ISBN des de foto o entrada manual
- Consulta a Open Library i Google Books
- Edicio manual de fitxa
- Cerca global, filtres, ordenacio i paginacio a la biblioteca
- Cerca per titol, autor, editorial, ubicacio, any, notes i ISBN

## Estructura actual

- `backend/`: aplicacio Laravel amb API, vista Blade i assets Vite

El directori `frontend/` ja no forma part de l aplicacio activa.

## Arrencada local

### 1. Backend Laravel

```bash
cd backend
copy .env.example .env
composer install
php artisan key:generate
php artisan migrate
```

Variables utils a `backend/.env`:

- `APP_URL=http://127.0.0.1:8000`
- `GOOGLE_BOOKS_API_KEY=` opcional
- `CORS_ALLOWED_ORIGINS=http://127.0.0.1:8000`

### 2. Assets frontend del backend

```bash
cd backend
cmd /c npm install
```

Per desenvolupament amb recarrega:

```bash
cd backend
php artisan serve
```

En un segon terminal:

```bash
cd backend
cmd /c npm run dev
```

La URL local es:

- `http://127.0.0.1:8000`

## Build de produccio

```bash
cd backend
cmd /c npm run build
php artisan optimize
```

## Endpoints API

### Publics

- `GET /api/books/lookup?barcode=9788499890944`
  Busca metadades d un llibre a partir de l ISBN o codi de barres.
- `POST /api/auth/register`
  Crea un usuari nou i retorna token d API.
- `POST /api/auth/login`
  Inicia sessio i retorna token d API.

### Protegits

Requereixen header:

```http
Authorization: Bearer <token>
```

- `GET /api/auth/me`
  Retorna l usuari autenticat.
- `POST /api/auth/logout`
  Invalida el token actual.
- `GET /api/books`
  Retorna la biblioteca de l usuari autenticat.
  Query params disponibles:
  `search`, `status`, `location`, `publisher`, `year`, `sort`, `direction`, `page`, `per_page`
- `POST /api/books`
  Crea un llibre nou o fa `upsert` per ISBN dins la biblioteca de l usuari.
- `PATCH /api/books/{book}`
  Actualitza un llibre existent de l usuari.
- `DELETE /api/books/{book}`
  Elimina un llibre existent de l usuari.

### Camps principals de llibre

- `barcode`
- `isbn10`
- `isbn13`
- `title`
- `author`
- `publisher`
- `description`
- `cover_url`
- `published_at`
- `status`
- `location`
- `notes`
- `source`

## Verificacio

```bash
cd backend
php artisan migrate --force
php artisan test
cmd /c npm run build
```
