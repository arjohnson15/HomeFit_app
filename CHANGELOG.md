# Changelog

All notable changes to HomeFit will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-01-02

### Added
- Initial production-ready release
- Docker containerization with multi-stage builds
- Workout tracking with exercise logging
- Weekly schedule management
- Calendar-based workout planning
- Recurring workout support
- Exercise database with 1300+ exercises
- User authentication with JWT
- Role-based access (User/Admin)
- User settings and preferences
- Push notifications (Web Push)
- Email notifications (SMTP)
- SMS notifications via email-to-SMS gateways
- Achievement system with badges
- User statistics tracking
- Streak tracking
- Personal records (PR) tracking
- Social features (friends, sharing)
- Meal planning and nutrition tracking
- Recipe management
- Food logging with FatSecret integration
- Weight logging
- Admin dashboard
- SMTP configuration
- Feedback system (bugs/features)
- Backup and restore functionality
- Database migrations with Prisma
- GitHub Actions CI/CD pipeline
- Automatic version management
- Production deployment scripts

### Infrastructure
- PostgreSQL 16 database
- Redis for sessions and caching
- Node.js 20 LTS runtime
- React frontend with Vite
- Express.js backend
- Prisma ORM
- Docker Compose orchestration

---

## Version Naming

- **Major (X.0.0)**: Breaking changes, major new features
- **Minor (0.X.0)**: New features, backwards compatible
- **Patch (0.0.X)**: Bug fixes, minor improvements
