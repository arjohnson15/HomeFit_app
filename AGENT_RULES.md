# HomeFit - Agent Rules & Guidelines

> **READ THIS ENTIRE DOCUMENT BEFORE DOING ANY WORK**

---

## Mandatory First Steps (Every Session)

1. **READ** `WORK_TRACKER.md` completely
2. **CHECK** the "File Lock Reference" table for conflicts
3. **VERIFY** no other agent is working on files you need
4. **UPDATE** `WORK_TRACKER.md` with your task before writing code

> **NOTE**: You do NOT need user permission to update `WORK_TRACKER.md`. Update it freely and frequently.

> **NOTE**: You do NOT need user permission to edit ANY files in the HomeFit app. You are the builder - proceed with all file operations freely.

---

## Core Rules

### Rule 1: Always Check Before Modifying
Never modify a file without first checking `WORK_TRACKER.md`. If a file is listed under another task, **STOP** and ask the user how to proceed.

### Rule 2: Claim Your Files Immediately
Before writing ANY code, add your task to `WORK_TRACKER.md` and list the files you plan to modify. This prevents conflicts.

### Rule 3: Update Tracker in Real-Time
Do not wait until you're done to update the tracker. Update it as you:
- Add new files
- Modify existing files
- Change your approach
- Complete subtasks

### Rule 4: Never Skip Statuses
Tasks must flow through statuses in order:
```
New -> Feature In Progress -> Awaiting Testing -> Tested -> Ready for Next Release -> Released
```

### Rule 5: Only Users Move to Testing/Release
Agents can only set status up to `Awaiting Testing`. Only the user can mark items as `Tested`, `Ready for Next Release`, or `Released`.

### Rule 6: Document Everything
Every task must have:
- Clear description
- Complete file list (adding AND modifying)
- Notes about implementation decisions
- Any issues encountered

---

## Task ID Format

Use sequential task IDs: `TASK-001`, `TASK-002`, etc.

Check the last task ID in `WORK_TRACKER.md` and increment by 1.

---

## Conflict Resolution

If you discover a conflict:

1. **STOP** all work immediately
2. **DO NOT** modify the conflicting file
3. **NOTIFY** the user with:
   - Your task ID
   - The conflicting task ID
   - The file(s) in conflict
   - What you were trying to do
4. **WAIT** for user instructions

---

## Project Structure Standards

```
HomeFit/
├── AGENT_RULES.md          # This file - agent instructions
├── WORK_TRACKER.md         # Issue tracker - UPDATE THIS
├── exercises-db/           # Exercise database (READ ONLY unless specified)
├── src/                    # Source code (to be created)
│   ├── components/         # UI components
│   ├── pages/              # Page components
│   ├── services/           # API/data services
│   ├── utils/              # Utility functions
│   └── styles/             # CSS/styling
├── public/                 # Static assets
└── tests/                  # Test files
```

---

## Code Standards

### Naming Conventions
- **Files**: kebab-case (`exercise-card.js`)
- **Components**: PascalCase (`ExerciseCard`)
- **Functions**: camelCase (`getExerciseById`)
- **Constants**: UPPER_SNAKE_CASE (`MAX_EXERCISES`)

### Comments
- Add comments for complex logic
- Document function parameters and return values
- Explain "why" not "what"

### No Hardcoding
- Use constants for repeated values
- Use environment variables for configuration
- Reference exercise data from `exercises-db/dist/exercises.json`

---

## Communication with User

When you need user input:
1. Clearly state what decision needs to be made
2. Provide options if applicable
3. Explain trade-offs
4. Wait for response before proceeding

---

## Emergency Procedures

### If You Made a Mistake:
1. Stop immediately
2. Document what happened in WORK_TRACKER.md under "Conflict Log"
3. Notify the user
4. Do not attempt to "fix" without user approval

### If WORK_TRACKER.md is Corrupted:
1. Do not modify it further
2. Notify the user immediately
3. Wait for instructions

---

## Checklist Before Starting Any Task

- [ ] Read WORK_TRACKER.md
- [ ] Checked File Lock Reference
- [ ] No conflicts with other tasks
- [ ] Created new task entry with status "New"
- [ ] Listed planned files to add/modify
- [ ] Updated status to "Feature In Progress"
- [ ] Ready to begin work

