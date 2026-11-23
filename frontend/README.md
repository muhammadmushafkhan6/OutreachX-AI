# DataFlow AI — Frontend

React + Vite SaaS dashboard for website data extraction and automation.

## Tech stack

- React 18 + TypeScript
- Vite
- Tailwind CSS (shadcn-style UI components)
- React Router
- Zustand (auth, theme, jobs)
- TanStack Table
- React Hook Form + Zod
- Axios
- Sonner (toasts)

## Manual setup (required)

### 1. Install Node.js

Download and install **Node.js 18+** from [https://nodejs.org](https://nodejs.org)

Verify:

```bash
node -v
npm -v
```

### 2. Install dependencies

Open terminal in the `frontend` folder:

```bash
cd frontend
npm install
```

### 3. Environment file (optional until backend exists)

Copy the example env file:

```bash
copy .env.example .env
```

Edit `.env` when FastAPI backend is running:

```
VITE_API_URL=http://localhost:8000/api/v1
VITE_WS_URL=ws://localhost:8000/ws
```

### 4. Run development server

```bash
npm run dev
```

Open **http://localhost:5173**

### 5. Demo mode (no backend)

- Register or Login works offline — creates a local demo session
- Dashboard shows sample stats and jobs
- Single/Bulk analysis shows mock jobs
- Results page shows sample extracted + AI data

## Pages

| Route | Page |
|-------|------|
| `/` | Landing |
| `/login` | Login |
| `/register` | Register |
| `/dashboard` | Dashboard (protected) |
| `/analyze` | Single website analysis |
| `/bulk` | Bulk CSV upload |
| `/results` | Results & export |
| `/settings` | Settings |
| `/billing` | Billing placeholder |

## Build for production

```bash
npm run build
npm run preview
```

## Project structure

```
frontend/
├── src/
│   ├── components/   # UI, layout, dashboard
│   ├── pages/        # All routes
│   ├── stores/       # Zustand
│   ├── hooks/        # WebSocket, dashboard data
│   ├── lib/          # API, utils
│   └── types/        # TypeScript types
├── public/
└── package.json
```
