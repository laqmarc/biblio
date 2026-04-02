# Biblio Casa

Aplicatiu web per catalogar els llibres de casa amb:

- `backend/`: API REST en Laravel
- `frontend/`: interficie mobil en Astro

## Que fa

- Foto del codi de barres des del mobil
- Normalitzacio d ISBN-10 i ISBN-13
- Consulta a Open Library i Google Books
- Login i registre d usuaris
- Biblioteca separada per usuari
- Titol, autor, editorial, descripcio i portada

## Arrencada local

### 1. Backend Laravel

```bash
cd backend
copy .env.example .env
php artisan key:generate
php artisan migrate
php artisan serve
```

L API queda a `http://127.0.0.1:8000/api`.

Variables utils a `backend/.env`:

- `GOOGLE_BOOKS_API_KEY=` opcional
- `CORS_ALLOWED_ORIGINS=http://localhost:4321,http://127.0.0.1:4321`

### 2. Frontend Astro

```bash
cd frontend
copy .env.example .env
cmd /c npm install
cmd /c npm run dev
```

Per defecte, el frontend apunta a `http://127.0.0.1:8000/api`.

Si existeix `frontend/certs/biblio-dev.pfx`, Astro arrenca en HTTPS automaticament.

Variable util a `frontend/.env`:

- `PUBLIC_API_BASE_URL=http://127.0.0.1:8000/api`


## Endpoints principals

- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/auth/me`
- `POST /api/auth/logout`
- `GET /api/books`
- `GET /api/books/lookup?barcode=9788499890944`
- `POST /api/books`

## Verificacio

- `php artisan migrate --force`
- `php artisan test`
- `cmd /c npm run build`
