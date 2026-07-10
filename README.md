# VEIL - Anonymous AI Social Space

Welcome to **VEIL**, an anonymous AI-powered social space. The application features a rich, responsive frontend built with TanStack Start, React 19, and Vite, and an Express backend integrated with Prisma and SQLite for local development.

---

## Workspace Structure

- **`/frontend`**: The TanStack Start React 19 application.
- **`/backend`**: The Express.js server, Prisma ORM, and local SQLite database (`dev.db`).

---

## Prerequisites

- **Node.js** (v18 or higher recommended)
- **npm** (comes packaged with Node.js)

---

## Local Setup & Development

### 1. Backend Setup & Run

The backend is configured to use a local **SQLite** database (`dev.db`), removing any external dependencies.

1. Navigate to the `backend/` directory:
   ```bash
   cd backend
   ```
2. Confirm the environment configuration in `backend/.env`. The database URL should point to the SQLite file:
   ```env
   PORT=3000
   DATABASE_URL="file:./dev.db"
   ```
3. Install dependencies:
   ```bash
   npm install
   ```
4. Start the development server:
   - For development auto-reload (using nodemon):
     ```bash
     npm run dev
     ```
   - For a standard start:
     ```bash
     npm start
     ```

The backend server will run and listen on **`http://localhost:3000`**. You can verify it by visiting `http://localhost:3000/` or executing:
```bash
curl http://localhost:3000/
# Response: {"message": "Veil Shine Backend API is running!"}
```

### 2. Frontend Setup & Run

The frontend uses TanStack Start/Vite and is pre-configured to proxy/query the local backend on port 3000.

1. Navigate to the `frontend/` directory:
   ```bash
   cd frontend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the frontend developer server:
   ```bash
   npm run dev
   ```

The frontend server will start and bind to a local port (typically **`http://localhost:5173`**). Open the URL in your browser to interact with the platform.

---

## Database Commands (Prisma)

If you want to clear/refresh the database content and re-seed default data (users, categories, posts), run these commands inside the `backend/` folder:

```bash
# Force reset database schema/tables
npx prisma db push --force-reset

# Seed default mock data
npm run seed
```
