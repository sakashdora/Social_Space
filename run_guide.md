# Veil Shine - Local Running Guide (No Docker / No Supabase)

This guide walks you through starting both the backend and frontend services locally on your machine. All database actions have been transitioned to use a local **SQLite** database file (`dev.db`), completely removing any dependency on external Supabase registration or running Docker containers.

---

## Prerequisites

- **Node.js** (v18 or higher recommended)
- **npm** (comes packaged with Node.js)

---

## 1. Backend Setup & Run

The backend has already been pre-configured, migrated, and seeded with mock data. To run it:

1. Open your terminal and navigate to the `backend/` directory:
   ```bash
   cd backend
   ```
2. Confirm the environment variables in the `.env` file (the database connection URL points to the local SQLite database):
   ```env
   PORT=3000
   DATABASE_URL="file:./dev.db"
   ```
3. Start the backend developer server:
   - For development auto-reload (using nodemon):
     ```bash
     npm run dev
     ```
   - For a standard start:
     ```bash
     npm start
     ```

The backend server will launch and listen on **`http://localhost:3000`**. You can verify that it is running by visiting `http://localhost:3000/` in your browser or running a GET request:
```bash
curl http://localhost:3000/
# Response: {"message": "Veil Shine Backend API is running!"}
```

---

## 2. Frontend Setup & Run

The frontend uses TanStack Start/Vite and is pre-configured to query the local backend on port 3000.

1. Open a new terminal window and navigate to the `frontend/` directory:
   ```bash
   cd frontend
   ```
2. Start the frontend developer server:
   ```bash
   npm run dev
   ```

The frontend server will launch and bind to a local port (typically **`http://localhost:5173`** or **`http://localhost:3000`** depending on port availability, but standard Vite dev maps to port 5173). Visit the URL in your browser to interact with the platform!

---

## Seeding / Resetting the Database

If at any point you want to clear/refresh the database content and re-seed the default users, categories, and posts, navigate to the `backend/` folder and run:

```bash
# To force reset the database tables
npx prisma db push --force-reset

# To re-seed the default posts and users
npm run seed
```
