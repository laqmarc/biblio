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

## Endpoints principals

- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/auth/me`
- `POST /api/auth/logout`
- `GET /api/books`
- `GET /api/books/lookup?barcode=9788499890944`
- `POST /api/books`

## Verificacio

```bash
cd backend
php artisan migrate --force
php artisan test
cmd /c npm run build
```
