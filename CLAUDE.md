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
