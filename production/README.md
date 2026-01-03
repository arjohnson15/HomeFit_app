# HomeFit Production Deployment

Deploy HomeFit using Docker containers for a production-ready workout tracking application.

## Quick Start

### Prerequisites
- Docker Engine 20.10+
- Docker Compose 2.0+
- Git
- 2GB RAM minimum
- 10GB disk space

### Download & Install

**Linux/macOS:**
```bash
# Clone the repository
git clone https://github.com/arjohnson15/HomeFit_app.git
cd HomeFit_app

# Navigate to production folder
cd production

# Copy and configure environment
cp .env.example .env
nano .env  # Edit with your settings

# Deploy
docker-compose up -d --build

# Setup database (wait 30 seconds for containers to start)
docker-compose exec app npx prisma db push --accept-data-loss
docker-compose exec app npx prisma db seed
```

**Windows (PowerShell):**
```powershell
# Clone the repository
git clone https://github.com/arjohnson15/HomeFit_app.git
cd HomeFit_app

# Navigate to production folder
cd production

# Copy and configure environment
copy .env.example .env
notepad .env  # Edit with your settings

# Deploy
docker-compose up -d --build

# Setup database (wait 30 seconds for containers to start)
docker-compose exec app npx prisma db push --accept-data-loss
docker-compose exec app npx prisma db seed
```

### Access the Application

Open your browser to: **http://localhost:3000**

---

## Default Admin Login

| Field | Value |
|-------|-------|
| **Email** | `admin@homefit.local` |
| **Password** | `admin123` |

> ⚠️ **IMPORTANT:** Change the admin password immediately after first login!
>
> Go to: **Settings → Account → Change Password**

### Demo User (Optional)

A demo user is also created for testing:

| Field | Value |
|-------|-------|
| **Email** | `demo@homefit.local` |
| **Password** | `demo1234` |

---

## Docker Compose Example

Here's a minimal `docker-compose.yml` for reference:

```yaml
services:
  db:
    image: postgres:16-alpine
    container_name: homefit-db
    restart: unless-stopped
    environment:
      POSTGRES_USER: homefit
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: homefit
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U homefit"]
      interval: 10s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    container_name: homefit-redis
    restart: unless-stopped
    volumes:
      - redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5

  app:
    build:
      context: ..
      dockerfile: production/Dockerfile
    image: homefit:latest
    container_name: homefit-app
    restart: unless-stopped
    environment:
      NODE_ENV: production
      DATABASE_URL: postgresql://homefit:${POSTGRES_PASSWORD}@db:5432/homefit
      REDIS_URL: redis://redis:6379
      JWT_SECRET: ${JWT_SECRET}
      SESSION_SECRET: ${SESSION_SECRET}
    ports:
      - "3000:3000"
    depends_on:
      db:
        condition: service_healthy
      redis:
        condition: service_healthy

volumes:
  postgres_data:
  redis_data:
```

---

## Environment Configuration

### Required Settings

Edit `.env` with these required values:

```bash
# Database password (use a strong password!)
POSTGRES_PASSWORD=your_secure_password_here

# Security secrets (generate with: openssl rand -base64 32)
JWT_SECRET=your_jwt_secret_here
SESSION_SECRET=your_session_secret_here
```

### Generate Secure Secrets

**Linux/macOS:**
```bash
openssl rand -base64 32
```

**Windows (PowerShell):**
```powershell
[Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Maximum 256 }) -as [byte[]])
```

### All Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `APP_VERSION` | No | 1.0.0 | Application version |
| `POSTGRES_USER` | No | homefit | Database username |
| `POSTGRES_PASSWORD` | **Yes** | - | Database password |
| `POSTGRES_DB` | No | homefit | Database name |
| `JWT_SECRET` | **Yes** | - | JWT signing key (32+ chars) |
| `SESSION_SECRET` | **Yes** | - | Session encryption key |
| `HOST_PORT` | No | 3000 | Port exposed on host |
| `SMTP_HOST` | No | - | Email server for notifications |
| `SMTP_PORT` | No | 587 | Email server port |
| `SMTP_USER` | No | - | Email username |
| `SMTP_PASS` | No | - | Email password |
| `SMTP_FROM` | No | - | Sender email address |

---

## Admin Setup Guide

### First-Time Setup

1. **Login** with default admin credentials (see above)

2. **Change admin password:**
   - Click your profile icon (top right)
   - Go to Settings → Account
   - Click "Change Password"
   - Enter new secure password

3. **Configure app settings (Admin Dashboard):**
   - Go to Admin → Settings
   - Set your app name and branding
   - Configure email/SMTP if needed

4. **Create additional users:**
   - Go to Admin → Users
   - Click "Add User"
   - Set role (User or Admin)

### Admin Dashboard Features

Access via: **Menu → Admin**

| Feature | Description |
|---------|-------------|
| **Users** | Manage user accounts, roles, reset passwords |
| **Settings** | App configuration, SMTP, branding |
| **Feedback** | View user bug reports and feature requests |
| **Backups** | Manual and scheduled database backups |
| **Statistics** | User engagement and system metrics |

### Backup Configuration

1. Go to **Admin → Backups**
2. Enable daily/weekly automatic backups
3. Set retention period (default: 30 days)
4. Backups stored in Docker volume `homefit_backups`

---

## Common Commands

### Container Management

```bash
# Start all services
docker-compose up -d

# Stop all services
docker-compose down

# View logs
docker-compose logs -f
docker-compose logs -f app    # App only

# Restart app
docker-compose restart app

# Rebuild after code changes
docker-compose up -d --build
```

### Database Operations

```bash
# Open database shell
docker-compose exec db psql -U homefit -d homefit

# Run migrations
docker-compose exec app npx prisma db push

# Re-seed database
docker-compose exec app npx prisma db seed

# Open Prisma Studio (database GUI)
docker-compose exec app npx prisma studio
```

### Backup & Restore

```bash
# Create manual backup
./scripts/backup.sh

# Restore from backup
./scripts/restore.sh backups/homefit_manual_20260101_120000.tar.gz

# List backups
ls -la backups/
```

---

## Updating HomeFit

### Using the Update Script

```bash
# Pull latest and redeploy
./scripts/update.sh

# Update to specific version
./scripts/update.sh 1.2.0
```

### Manual Update

```bash
# Pull latest code
git pull origin main

# Rebuild and restart
docker-compose up -d --build

# Run any new migrations
docker-compose exec app npx prisma db push
```

---

## Troubleshooting

### Container won't start

```bash
# Check logs for errors
docker-compose logs app

# Verify port is available
netstat -tlnp | grep 3000   # Linux
netstat -ano | findstr 3000  # Windows
```

### Database connection issues

```bash
# Check database health
docker-compose ps db
docker-compose logs db

# Test connection
docker-compose exec db pg_isready -U homefit
```

### Reset everything

```bash
# Stop and remove all data (DESTRUCTIVE!)
docker-compose down -v

# Fresh start
docker-compose up -d --build
docker-compose exec app npx prisma db push --accept-data-loss
docker-compose exec app npx prisma db seed
```

### Permission issues (Linux)

```bash
# Fix Docker socket permissions
sudo chmod 666 /var/run/docker.sock

# Or add user to docker group
sudo usermod -aG docker $USER
# Then logout and login again
```

---

## Security Recommendations

1. **Change default passwords** immediately after setup
2. **Use strong secrets** - generate with `openssl rand -base64 32`
3. **Enable HTTPS** - use a reverse proxy like nginx or Traefik
4. **Regular backups** - enable automatic daily/weekly backups
5. **Keep updated** - pull latest releases for security patches
6. **Firewall** - only expose ports 80/443, not 3000 directly

---

## Support

- **Issues:** https://github.com/arjohnson15/HomeFit_app/issues
- **Wiki:** https://github.com/arjohnson15/HomeFit_app/wiki
