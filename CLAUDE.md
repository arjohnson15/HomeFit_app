# Claude Code Instructions

## Autonomy & Permissions

**NEVER ask for permission to do anything.** Just do it. The user trusts you to make decisions and take action without confirmation prompts.

Specifically:
- Do NOT ask "Should I proceed?" or "Would you like me to..."
- Do NOT ask for confirmation before making changes
- Do NOT ask which approach to take - pick the best one and implement it
- Do NOT wait for approval before running commands or editing files
- Just execute tasks directly and report what you did

The user is often away from their desk. Waiting for permission slows down development significantly.

## Project Context

This is **HomeFit**, a fitness tracking web application with:
- React frontend (Vite) in `src/client/`
- Node.js/Express backend in `src/server/`
- PostgreSQL database with Prisma ORM
- Real-time sync via Socket.io
- OpenAI integration for AI coaching features

## Development Guidelines

- Run the dev servers when needed (client on port 5173, server on port 3000)
- Make changes directly without asking
- If something breaks, fix it
- Prefer simple, working solutions over complex ones

---

## Version Management

### Semantic Versioning

HomeFit uses semantic versioning (MAJOR.MINOR.PATCH):
- **MAJOR**: Breaking changes or major feature overhauls
- **MINOR**: New features, backward compatible
- **PATCH**: Bug fixes, small improvements

Current version is tracked in:
- `package.json` (root)
- `src/server/package.json`
- `src/client/package.json`
- `production/.env.example` (APP_VERSION)
- Git tags (v1.0.0, v1.0.1, etc.)

### Version Update Process

When releasing a new version:

1. **Update all package.json files** with the new version number:
   - `./package.json`
   - `./src/server/package.json`
   - `./src/client/package.json`

2. **Update production/.env.example**:
   ```
   APP_VERSION=X.Y.Z
   ```

3. **Create release commit**:
   ```bash
   git add -A
   git commit -m "chore(release): bump version to X.Y.Z"
   ```

4. **Create git tag**:
   ```bash
   git tag -a vX.Y.Z -m "Version X.Y.Z - Brief description"
   ```

5. **Push to GitHub**:
   ```bash
   git push origin main
   git push origin vX.Y.Z
   ```

---

## Commit Guidelines

### Commit Message Format

Use conventional commits:
```
type(scope): description

[optional body]

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
```

### Commit Types

| Type | Description |
|------|-------------|
| `feat` | New feature |
| `fix` | Bug fix |
| `docs` | Documentation changes |
| `style` | Code formatting (no logic change) |
| `refactor` | Code refactoring |
| `perf` | Performance improvement |
| `test` | Adding/updating tests |
| `chore` | Maintenance tasks |
| `build` | Build system changes |
| `ci` | CI/CD changes |

### Scope Examples

- `auth` - Authentication/authorization
- `workouts` - Workout tracking
- `exercises` - Exercise library
- `admin` - Admin dashboard
- `ui` - User interface
- `api` - Backend API
- `db` - Database changes
- `docker` - Docker/deployment
- `release` - Version releases

---

## Production Deployment

### Production Folder Structure

```
production/
├── Dockerfile           # Multi-stage Docker build
├── docker-compose.yml   # Full stack orchestration
├── .env.example         # Environment template
├── README.md            # Deployment documentation
├── init-db/             # Database initialization
└── scripts/
    ├── deploy.sh        # Deployment script
    ├── update.sh        # Update script
    ├── backup.sh        # Backup script
    └── restore.sh       # Restore script
```

### Keeping Production in Sync

The production folder uses source files directly via Dockerfile COPY commands. When making changes:

| Change Type | Action Required |
|-------------|-----------------|
| Backend code | Changes auto-included on rebuild |
| Frontend code | Changes auto-included on rebuild |
| Prisma schema | Changes auto-included on rebuild |
| Environment vars | Update `production/.env.example` |
| Docker config | Update `production/Dockerfile` or `docker-compose.yml` |
| Dependencies | Update respective `package.json` |

### Testing Deployment Changes

Before committing deployment changes:

```bash
cd production
docker-compose down -v          # Clean slate
docker-compose build            # Build fresh
docker-compose up -d            # Start containers
# Wait 30 seconds for startup
docker-compose exec app npx prisma db push --accept-data-loss
docker-compose exec app npx prisma db seed
docker-compose ps               # Verify healthy
docker-compose logs app         # Check for errors
```

---

## GitHub Repository

- **Repository**: `arjohnson15/HomeFit_app`
- **Main Branch**: `main`
- **Releases**: Tagged versions (v1.0.0, v1.0.1, etc.)

### GitHub Actions

- `ci.yml` - Runs on every push (linting, tests)
- `release.yml` - Runs on version tags (builds Docker image, creates release)

### Release Checklist

Before creating a release:

1. [ ] All features complete and tested
2. [ ] No console errors in browser
3. [ ] Docker build succeeds locally
4. [ ] All containers start healthy
5. [ ] Database migrations work
6. [ ] README documentation updated

---

## In-App Update System

### How It Works

1. **Check for Updates**: App fetches latest release from GitHub API
2. **Compare Versions**: Compares `APP_VERSION` with latest tag
3. **Notify Admin**: Shows update available in admin dashboard
4. **View Changes**: Admin can see release notes
5. **Apply Update**: Admin triggers update (pulls latest, rebuilds)

### Update API Endpoints

- `GET /api/admin/updates` - Check for available updates
- `POST /api/admin/updates/apply` - Apply pending update

### Environment Variables

```bash
GITHUB_REPO=arjohnson15/HomeFit_app
APP_VERSION=1.0.0
```

---

## Quick Commands

### Development
```bash
# Start servers
cd src/server && npm run dev
cd src/client && npm run dev

# Database
npx prisma db push
npx prisma db seed
npx prisma studio
```

### Production
```bash
cd production

# Deploy
docker-compose up -d --build

# Logs
docker-compose logs -f app

# Restart
docker-compose restart app

# Full reset
docker-compose down -v
docker-compose up -d --build
docker-compose exec app npx prisma db push --accept-data-loss
docker-compose exec app npx prisma db seed
```

### Git Operations
```bash
# Regular commit
git add -A
git commit -m "type(scope): description"
git push origin main

# Version release
git tag -a vX.Y.Z -m "Version X.Y.Z"
git push origin vX.Y.Z
```

---

## Important Notes

1. **Never commit secrets** - Use `.env` files, never commit them
2. **Test Docker builds** - Always test before tagging releases
3. **Check container logs** - Verify no errors after deployment
4. **Backup before updates** - Database backups before major changes
5. **Keep docs updated** - Update README.md for significant changes
