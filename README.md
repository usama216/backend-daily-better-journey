# Daily Better Journey - Backend

Backend API for Daily Better Journey built with Node.js, Express, and Supabase.

## Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment
Create `.env` file:
```env
PORT=5000
NODE_ENV=development
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
CORS_ORIGINS=http://localhost:3000
```

### 3. Setup Database
Run the SQL from `supabase-schema.sql` in your Supabase SQL Editor.

### 4. Run Server
```bash
npm run dev
```

Server will run on http://localhost:5000

## API Endpoints

- `GET /api/health` - Health check
- `POST /api/newsletter/subscribe` - Subscribe to newsletter
- `GET /api/posts` - Get all posts
- `GET /api/quotes/daily` - Get daily quote

## Tech Stack

- Node.js
- Express.js
- TypeScript
- Supabase
