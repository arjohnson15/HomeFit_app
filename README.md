# HomeFit

A modern, mobile-first workout tracking application with a dark theme and minimalistic UI.

## Features

- **Workout Tracking**: Log exercises with sets, reps, weight, and duration
- **Exercise Catalog**: 873+ exercises with images and instructions
- **Schedule Builder**: Plan your weekly workouts with warmup/cooldown suggestions
- **Progress History**: Track your fitness journey over time
- **Social Features**: Share workouts and follow friends
- **PWA Support**: Install on mobile devices for native-like experience
- **Automatic Updates**: One-click updates from the admin panel

## Tech Stack

- **Frontend**: React + Vite, Tailwind CSS
- **Backend**: Node.js, Express
- **Database**: PostgreSQL with Prisma ORM
- **Cache**: Redis
- **Containerization**: Docker

---

## Production Deployment (Docker)

### Prerequisites

- Docker and Docker Compose installed
- Git

### 1. Clone the repository

```bash
git clone https://github.com/arjohnson15/HomeFit_app.git
cd HomeFit_app
```

### 2. Configure environment

```bash
cd production
cp .env.example .env
```

Edit `.env` and set your secrets:

```bash
# Generate secure secrets
openssl rand -base64 32

# Required settings in .env:
POSTGRES_PASSWORD=your_secure_password
JWT_SECRET=your_jwt_secret
SESSION_SECRET=your_session_secret
UPDATE_SECRET=your_update_secret
```

### 3. Start the application

```bash
docker compose up -d --build
```

**First boot will take a few minutes** - the updater service automatically builds the frontend.

You can watch the progress:
```bash
docker compose logs -f updater
```

### 4. Initialize the database

```bash
docker compose exec app npx prisma db push
docker compose exec app npx prisma db seed
```

### 5. Access the app

Open http://localhost:3000 (or your configured HOST_PORT).

---

## Architecture Overview

The production deployment uses **volume mounts for fast updates**:

```
Docker Containers:
├── app (homefit-app)        # Main application
├── updater (homefit-updater) # Handles automatic updates
├── db (homefit-db)          # PostgreSQL database
└── redis (homefit-redis)    # Session cache

Volume Mounts (app container):
├── src/server/src → /app/src          # Backend source (read-only)
├── src/server/data → /app/server-data # Data files (read-only)
├── src/client/dist → /app/public      # Built frontend (read-only)
├── package.json → /app/root-package.json # Version info
└── exercises-db/dist → /app/data      # Exercise database
```

This architecture allows updates without rebuilding Docker images:
1. Git pull new code
2. Rebuild frontend (`npm run build`)
3. Restart app container

---

## Automatic Updates

The app includes a built-in update system accessible from **Admin > Updates**.

### How it works:

1. The app checks GitHub releases for new versions
2. Admin clicks "Apply Update" in the UI
3. Updater service:
   - Pulls latest code from GitHub
   - Runs `npm install` and `npm run build` for the frontend
   - Restarts the app container
4. User refreshes browser to see new version

### Update logs

View update progress in the UI or via:
```bash
docker compose logs -f updater
```

---

## Pushing Updates (Developer Guide)

### Quick Update (No Docker Rebuild)

For code-only changes (frontend/backend):

1. **Make your changes locally**

2. **Bump the version** in `package.json`:
   ```json
   "version": "1.0.5"
   ```

3. **Commit and push**:
   ```bash
   git add -A
   git commit -m "feat: your feature description"
   git push origin main
   ```

4. **Create a GitHub release**:
   ```bash
   gh release create v1.0.5 --title "v1.0.5 - Feature Name" --notes "## Changes
   - Feature 1
   - Bug fix 2"
   ```

5. **Users click "Apply Update"** in Admin > Updates

### Full Rebuild Required

A full Docker rebuild (`docker compose up -d --build`) is needed when:

- `package.json` dependencies change (server)
- `Dockerfile` changes
- Prisma schema changes (also need `npx prisma db push`)
- Docker Compose configuration changes

---

## Development Setup

### Prerequisites

- Node.js 20+
- PostgreSQL 16+
- Redis 7+

### Local Development

```bash
# Install all dependencies
npm run setup

# Or manually:
npm install
cd src/client && npm install
cd ../server && npm install

# Start development servers (frontend + backend)
npm run dev
```

### Using Docker for Development

```bash
cd docker
docker compose up -d
```

---

## Project Structure

```
HomeFit/
├── src/
│   ├── client/              # React frontend (Vite)
│   │   ├── src/
│   │   │   ├── components/  # Reusable UI components
│   │   │   ├── pages/       # Page components
│   │   │   └── services/    # API services
│   │   └── dist/            # Built frontend (generated)
│   └── server/
│       ├── src/
│       │   ├── routes/      # API endpoints
│       │   ├── services/    # Business logic
│       │   └── middleware/  # Express middleware
│       ├── prisma/          # Database schema
│       └── data/            # Static data files
├── exercises-db/            # Exercise database (873 exercises)
│   └── dist/                # Compiled exercise data
├── production/              # Production Docker config
│   ├── docker-compose.yml   # Main compose file
│   ├── Dockerfile           # App image
│   ├── .env.example         # Environment template
│   └── updater/             # Auto-update service
├── docker/                  # Development Docker config
└── scripts/                 # Utility scripts
```

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `POSTGRES_PASSWORD` | Yes | Database password |
| `JWT_SECRET` | Yes | JWT signing secret |
| `SESSION_SECRET` | Yes | Session encryption secret |
| `UPDATE_SECRET` | Yes | Secret for update requests |
| `HOST_PORT` | No | Port to expose (default: 3000) |
| `CLIENT_URL` | No | Public URL for CORS/emails |
| `GITHUB_REPO` | No | GitHub repo for updates |
| `SMTP_*` | No | Email configuration |

---

## Troubleshooting

### App won't start after deployment

Check if frontend is built:
```bash
docker compose logs updater
```

If it's stuck building, wait for completion or check for npm errors.

### 500 errors on warmup/cooldown suggestions

Ensure the server-data volume is mounted correctly:
```bash
docker compose exec app ls -la /app/server-data/
```

### Update says "Already up to date" but version is old

The app caches version info. Restart the app container:
```bash
docker compose restart app
```

### Need to force rebuild everything

```bash
docker compose down
docker compose up -d --build
```

---

## License

Private project.
