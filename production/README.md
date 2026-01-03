# HomeFit Production Deployment

This folder contains everything needed to deploy HomeFit in a production environment using Docker.

## Quick Start

### Prerequisites
- Docker Engine 20.10+
- Docker Compose 2.0+
- 2GB RAM minimum
- 10GB disk space

### First-Time Setup

1. **Copy environment file and configure:**
   ```bash
   cp .env.example .env
   ```

2. **Edit `.env` with your settings:**
   ```bash
   # Generate secure secrets (run these commands)
   openssl rand -base64 32  # Use for JWT_SECRET
   openssl rand -base64 32  # Use for SESSION_SECRET

   # Update POSTGRES_PASSWORD with a strong password
   ```

3. **Deploy:**
   ```bash
   ./scripts/deploy.sh
   ```

4. **Access the app:**
   Open http://localhost:3000 in your browser

### Default Admin Account
- **Username:** admin
- **Password:** admin123 (CHANGE THIS IMMEDIATELY!)

## Directory Structure

```
production/
├── Dockerfile              # Multi-stage production Docker build
├── docker-compose.yml      # Production compose configuration
├── .env.example            # Environment template
├── init-db/                # Database initialization scripts
├── scripts/
│   ├── deploy.sh           # Deploy/redeploy application
│   ├── update.sh           # Update to new version
│   ├── backup.sh           # Create database backup
│   ├── restore.sh          # Restore from backup
│   └── version.sh          # Manage version numbers
└── backups/                # Backup storage (auto-created)
```

## Version Management

### Bump Version (Development)
```bash
# Patch release (1.0.0 -> 1.0.1)
./scripts/version.sh patch

# Minor release (1.0.0 -> 1.1.0)
./scripts/version.sh minor

# Major release (1.0.0 -> 2.0.0)
./scripts/version.sh major

# Create git tag
./scripts/version.sh patch --tag

# Create tag and push to GitHub
./scripts/version.sh patch --push
```

### Update Deployed Instance
```bash
# Update to latest version
./scripts/update.sh

# Update to specific version
./scripts/update.sh 1.2.0
```

## Backup & Restore

### Create Backup
```bash
./scripts/backup.sh
```

### Restore from Backup
```bash
./scripts/restore.sh backups/homefit_manual_20240101_120000.tar.gz
```

### Automatic Backups
Backups are automatically created:
- Before each update
- Daily at 2 AM (if configured in app settings)

## Docker Commands

### View Logs
```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f app
docker-compose logs -f db
```

### Restart Services
```bash
docker-compose restart
docker-compose restart app
```

### Stop All Services
```bash
docker-compose down
```

### Remove All Data (DESTRUCTIVE)
```bash
docker-compose down -v
```

### Access Container Shell
```bash
docker-compose exec app sh
docker-compose exec db psql -U homefit -d homefit
```

### Run Prisma Commands
```bash
docker-compose exec app npx prisma migrate deploy
docker-compose exec app npx prisma db seed
docker-compose exec app npx prisma studio
```

## Configuration

### Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `APP_VERSION` | No | 1.0.0 | Current app version |
| `POSTGRES_USER` | No | homefit | Database user |
| `POSTGRES_PASSWORD` | **Yes** | - | Database password |
| `POSTGRES_DB` | No | homefit | Database name |
| `JWT_SECRET` | **Yes** | - | JWT signing key (32+ chars) |
| `SESSION_SECRET` | **Yes** | - | Session encryption key |
| `HOST_PORT` | No | 3000 | Host port mapping |
| `SMTP_HOST` | No | - | Email server host |
| `SMTP_PORT` | No | 587 | Email server port |
| `SMTP_USER` | No | - | Email username |
| `SMTP_PASS` | No | - | Email password |
| `SMTP_FROM` | No | - | Sender email address |

### Custom Domain / SSL

For production with a custom domain, add a reverse proxy (nginx/traefik):

```yaml
# Add to docker-compose.yml
nginx:
  image: nginx:alpine
  ports:
    - "80:80"
    - "443:443"
  volumes:
    - ./nginx.conf:/etc/nginx/nginx.conf:ro
    - ./ssl:/etc/nginx/ssl:ro
  depends_on:
    - app
```

## Troubleshooting

### Container won't start
```bash
# Check logs
docker-compose logs app

# Check if ports are in use
netstat -tlnp | grep 3000
```

### Database connection issues
```bash
# Check database is healthy
docker-compose ps db

# Check database logs
docker-compose logs db

# Verify database connection
docker-compose exec db pg_isready -U homefit
```

### Out of disk space
```bash
# Clean up Docker
docker system prune -a

# Remove old backups
find backups/ -mtime +30 -delete
```

### Reset to fresh state
```bash
# Stop and remove everything
docker-compose down -v

# Redeploy
./scripts/deploy.sh
```

## Updating the App

When a new version is released:

1. **Check release notes** on GitHub
2. **Create backup:** `./scripts/backup.sh`
3. **Update:** `./scripts/update.sh`
4. **Verify:** Check the app is working correctly
5. **Rollback if needed:** `./scripts/restore.sh <backup_file>`

## Security Recommendations

1. **Change default admin password immediately**
2. **Use strong, unique secrets** for JWT_SECRET and SESSION_SECRET
3. **Enable HTTPS** in production with a reverse proxy
4. **Regular backups** - configure automatic daily backups
5. **Keep Docker updated** - run `docker-compose pull` periodically
6. **Firewall** - only expose necessary ports (80, 443)

## Support

- GitHub Issues: https://github.com/arjohnson15/HomeFit_app/issues
- Documentation: https://github.com/arjohnson15/HomeFit_app/wiki
