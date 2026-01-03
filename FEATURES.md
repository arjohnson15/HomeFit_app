# HomeFit - Feature Specification

> **Design Direction**: Modern, dark theme, minimalistic Apple-style UI

---

## Deployment Architecture

### Environments
| Environment | Platform | Database | Purpose |
|-------------|----------|----------|---------|
| **Development** | Windows Docker Desktop | PostgreSQL container | Local testing |
| **Production** | Linux Docker | PostgreSQL container | Live deployment |

### Folder Structure
```
HomeFit/
├── src/                    # Development source code
├── production/             # Production-ready releases (committed to GitHub)
├── docker/                 # Docker configurations
│   ├── docker-compose.yml      # Local dev compose
│   ├── docker-compose.prod.yml # Production compose
│   ├── Dockerfile              # App container
│   └── Dockerfile.db           # Database container (if custom)
└── ...
```

### GitHub Integration
- **Repository**: https://github.com/arjohnson15/HomeFit_app (public)
- Production folder syncs to GitHub repo
- App has built-in update feature that pulls from GitHub
- Update checks on startup + manual trigger in admin panel
- Supports rolling updates without downtime

### Auto-Update Feature
- [ ] Check GitHub for new releases/commits
- [ ] Compare local version vs remote
- [ ] Download update package
- [ ] Backup current state
- [ ] Apply update
- [ ] Restart containers if needed
- [ ] Rollback on failure

---

## Tech Stack (Recommended)

| Layer | Technology | Reason |
|-------|------------|--------|
| **Frontend** | React + Vite | Fast builds, modern tooling, large ecosystem |
| **UI Framework** | Tailwind CSS | Rapid styling, dark mode built-in, Apple-style achievable |
| **Backend** | Node.js + Express | Lightweight, JavaScript throughout, easy to scale |
| **Database** | PostgreSQL | Free, robust, handles complex queries for reports/analytics |
| **Real-time** | Socket.io | Real-time workout together feature, live updates |
| **Auth** | JWT + bcrypt | Secure, stateless authentication |
| **ORM** | Prisma | Type-safe database queries, easy migrations |
| **Charts** | Chart.js or Recharts | Progress tracking visualizations |

---

## Feature List

### 1. Authentication System
- [ ] Login page (email/username + password)
- [ ] Sign up page (create new account)
- [ ] Forgot password (email reset link)
- [ ] Password reset flow
- [ ] Session management with JWT
- [ ] Remember me functionality

### 2. Admin Settings Panel
- [ ] **User Management**: View all users, reset passwords, disable accounts
- [ ] **App Customization**: Primary/accent colors, app name, logo upload
- [ ] **SMTP Configuration**: Email server settings for notifications
- [ ] **SMS Configuration**: Verizon email-to-SMS gateway setup
- [ ] Role-based access (Admin vs Regular User)

### 3. Today Page (Dashboard)
- [ ] Today's scheduled workout display
- [ ] Workout timer (start/pause/end)
- [ ] Multiple workout tracking (can start second workout)
- [ ] Total daily workout time tracker
- [ ] Cardio timer (separate)
- [ ] Optional rest stopwatch per exercise
- [ ] Social cards:
  - [ ] Friends' workouts today
  - [ ] Scoreboard/leaderboard
  - [ ] Progress comparison charts

### 4. Social System
- [ ] Add friends by email or username
- [ ] Friend requests (accept/decline)
- [ ] Privacy settings (opt-in sharing)
- [ ] Share progress with friends
- [ ] Share workout schedules
- [ ] Share/suggest specific exercises to friends
- [ ] Real-time workout together feature (Socket.io)
- [ ] Activity feed

### 5. Workout Scheduler
- [ ] **Weekly View**:
  - [ ] Day-of-week slots (Mon-Sun)
  - [ ] Name each day (e.g., "Chest Day", "Leg Day")
  - [ ] Assign exercises to each day
- [ ] **Calendar View**:
  - [ ] Month/week calendar display
  - [ ] Schedule specific workout on specific date
  - [ ] Calendar date overrides weekly routine
  - [ ] Special workout days
- [ ] Drag-and-drop exercise assignment
- [ ] Copy/duplicate workout days

### 6. History & Analytics
- [ ] Complete workout history log
- [ ] Per-exercise history
- [ ] Graphs and charts:
  - [ ] Weight progression over time
  - [ ] Volume tracking
  - [ ] Frequency analysis
  - [ ] PR (personal record) tracking
- [ ] Custom reports:
  - [ ] By date range
  - [ ] By muscle group
  - [ ] By exercise
  - [ ] By training style
- [ ] Export data (CSV, PDF)

### 7. Training Style System
- [ ] User selects training style:
  - [ ] Powerlifting (strength, low rep, high weight)
  - [ ] Bodybuilding/Hypertrophy (muscle growth, moderate rep)
  - [ ] Strength Training (general strength)
  - [ ] Athletic/Explosive (sports performance, power)
  - [ ] Endurance (high rep, circuit style)
- [ ] Smart suggestions based on style:
  - [ ] Recommended rep ranges
  - [ ] Weight progression suggestions
  - [ ] Rest time recommendations
- [ ] Adjust suggestions based on user feedback

### 8. ChatGPT Integration
- [ ] User provides their own OpenAI API key (in settings)
- [ ] In-app chat window
- [ ] Context-aware fitness questions
- [ ] Suggest exercises for specific goals
- [ ] Help structure workout days
- [ ] Form tips and advice
- [ ] Chat history saved

### 9. Workout Timers (Robust)
- [ ] **Main Workout Timer**:
  - [ ] Start/pause/resume/end
  - [ ] Tracks total workout duration
  - [ ] Persists if app closes (background tracking)
- [ ] **Cardio Timer**:
  - [ ] Separate tracking for cardio
  - [ ] Intervals support
- [ ] **Rest Stopwatch** (optional per user setting):
  - [ ] Per-exercise rest tracking
  - [ ] Configurable rest alerts
- [ ] **Daily Total**: Aggregate all workout time
- [ ] Timer notifications/alerts

### 10. Exercise Catalog
- [ ] Browse all 873 exercises
- [ ] Filter by:
  - [ ] Body part / muscle group
  - [ ] Equipment type
  - [ ] Difficulty level
  - [ ] Exercise category
  - [ ] Training style fit
- [ ] Search by name
- [ ] Exercise detail view:
  - [ ] Images (start/end position)
  - [ ] Instructions
  - [ ] Target muscles
  - [ ] Equipment needed
- [ ] Add exercise to workout/schedule
- [ ] Favorite exercises

### 11. Today Workout UI (Exercise Cards)
- [ ] Horizontal card layout
- [ ] Card shows: image, exercise name, target muscle
- [ ] Tap to expand card:
  - [ ] Set/rep/weight inputs
  - [ ] Start/end individual exercise timer
  - [ ] Past workout section (expandable):
    - [ ] Last time's weight/reps
    - [ ] Suggested starting weight
    - [ ] Suggested rep range (based on training style)
  - [ ] Difficulty feedback (1-5 scale: too easy → too hard)
  - [ ] Notes field
  - [ ] Share exercise to friend
- [ ] Mark set complete
- [ ] Add additional sets
- [ ] Reorder exercises
- [ ] Skip exercise option

---

## Database Schema (High-Level)

```
Users
├── id, email, username, password_hash, role, created_at
├── profile (name, avatar, training_style, settings)
└── openai_api_key (encrypted)

Friendships
├── user_id, friend_id, status, created_at

WorkoutSchedules (Weekly Template)
├── user_id, day_of_week, name, exercises[]

CalendarWorkouts (Specific Date Override)
├── user_id, date, name, exercises[]

WorkoutSessions (Actual Completed Workouts)
├── user_id, date, start_time, end_time, total_duration

ExerciseLogs
├── session_id, exercise_id, sets[], difficulty_rating, notes

Sets
├── log_id, set_number, reps, weight, completed

AppSettings (Admin)
├── app_name, logo, colors, smtp_config, sms_config
```

---

## Development Phases

### Phase 1: Foundation
- Project setup (React + Vite + Tailwind)
- Database setup (PostgreSQL + Prisma)
- Authentication system
- Basic routing

### Phase 2: Core Features
- Exercise catalog
- Today page (basic)
- Workout scheduler (weekly view)
- Basic workout logging

### Phase 3: Enhanced Features
- Timers system
- Calendar view
- History & analytics
- Training style suggestions

### Phase 4: Social Features
- Friends system
- Sharing features
- Real-time workout together

### Phase 5: Advanced
- ChatGPT integration
- Admin panel
- Email/SMS notifications
- Advanced reporting

---

## UI/UX Guidelines

- **Theme**: Dark mode default, optional light mode
- **Style**: Minimalistic, Apple-inspired
- **Typography**: Clean sans-serif (SF Pro style or Inter)
- **Spacing**: Generous whitespace
- **Cards**: Subtle shadows, rounded corners
- **Animations**: Smooth, subtle transitions
- **Colors**:
  - Background: Near-black (#0a0a0a or #121212)
  - Cards: Slightly lighter (#1c1c1e)
  - Accent: User customizable (default: blue or green)
  - Text: White/gray hierarchy

---

## Mobile-First Design (CRITICAL)

> **This app MUST work flawlessly on mobile. Design mobile-first, then scale up to desktop.**

### Mobile Priorities
- **Touch targets**: Minimum 44x44px tap areas
- **Thumb-friendly**: Key actions in bottom half of screen
- **One-handed use**: Most common actions reachable with thumb
- **Swipe gestures**: Navigate between exercises, dismiss cards
- **Bottom navigation**: Primary nav at bottom, not top
- **No hover states**: All interactions work with tap

### Responsive Breakpoints
```
Mobile:  320px - 767px   (PRIMARY - design here first)
Tablet:  768px - 1023px
Desktop: 1024px+
```

### Mobile-Specific Features
- [ ] Pull-to-refresh on lists
- [ ] Haptic feedback on key actions (if supported)
- [ ] Large, easy-to-tap buttons during workout (sweaty hands)
- [ ] Landscape support for timer views
- [ ] Offline capability (PWA) - log workouts without internet
- [ ] Quick-add shortcuts
- [ ] Voice input for logging (future)

### Workout Screen Mobile UX
- Timer always visible at top (sticky)
- Current exercise card takes most of screen
- Large number inputs (weight/reps) - easy to tap
- Swipe left/right between exercises
- Big "Complete Set" button at bottom
- Minimal scrolling during active workout

### PWA (Progressive Web App)
- [ ] Service worker for offline support
- [ ] App manifest for "Add to Home Screen"
- [ ] Splash screen
- [ ] Works like native app on mobile
- [ ] Push notifications (workout reminders)

### Performance on Mobile
- Lazy load images
- Optimize exercise images for mobile
- Fast initial load (<3 seconds)
- Smooth 60fps animations
- Minimal JavaScript bundle size

