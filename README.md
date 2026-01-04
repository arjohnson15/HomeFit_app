# HomeFit

A modern, mobile-first workout tracking application with a dark theme and minimalistic UI.

## Features

- **Workout Tracking**: Log exercises with sets, reps, weight, and duration
- **Exercise Catalog**: 873+ exercises with images and instructions
- **Schedule Builder**: Plan your weekly workouts
- **Progress History**: Track your fitness journey over time
- **Social Features**: Share workouts and follow friends
- **PWA Support**: Install on mobile devices for native-like experience

## Tech Stack

- **Frontend**: React + Vite, Tailwind CSS
- **Backend**: Node.js, Express
- **Database**: PostgreSQL with Prisma ORM
- **Cache**: Redis
- **Containerization**: Docker

## Quick Start (Docker Deployment)

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
# Generate secure secrets (Linux/Mac)
openssl rand -base64 32

# Required settings
POSTGRES_PASSWORD=your_secure_password
JWT_SECRET=your_jwt_secret
SESSION_SECRET=your_session_secret
```

### 3. Start the application

```bash
docker-compose up -d --build
```

### 4. Initialize the database

```bash
docker-compose exec app npx prisma db push
docker-compose exec app npx prisma db seed
```

### 5. Access the app

Open http://localhost:3000 in your browser.

## Development Setup

### Prerequisites

- Node.js 20+
- PostgreSQL 16+
- Redis 7+

### Local Development

```bash
# Install dependencies
npm install
cd src/client && npm install
cd ../server && npm install

# Start development servers
npm run dev
```

### Using Docker for Development

```bash
cd docker
docker-compose -f docker-compose.yml up -d
```

## Project Structure

```
HomeFit/
├── src/
│   ├── client/          # React frontend
│   └── server/          # Express backend
├── exercises-db/        # Exercise database (873 exercises)
├── production/          # Production Docker config
├── docker/              # Development Docker config
└── scripts/             # Utility scripts
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `POSTGRES_PASSWORD` | Yes | Database password |
| `JWT_SECRET` | Yes | JWT signing secret |
| `SESSION_SECRET` | Yes | Session encryption secret |
| `HOST_PORT` | No | Port to expose (default: 3000) |
| `SMTP_*` | No | Email configuration for notifications |

## License

Private project.
