# Status Check

A web application for **tracking team deadlines and commitments**: a hybrid of a calendar and a task tracker, where a task is not just about "doing" something, but rather **monitoring and verifying completion by another person**.

🔗 **Demo:** https://status-check-ten.vercel.app

## Tech Stack
- **TypeScript** + **React 19** (components in `.tsx`)
- **Next.js 16** (App Router, Server Actions)
- **Supabase** — Auth, PostgreSQL, RLS, Realtime
- **Recharts** — analytics & charts
- **Vercel** — hosting

## Features
- Authentication with email verification and password reset
- Two-tier role system + Super-Verifier (hierarchical permissions at the DB level via RLS)
- Shared task pool with project scoping and atomic task "claiming"
- Assignee/Doer board (drag & drop) → submitting commitments for review
- Verifier calendar, returning tasks for rework, and automated status updates for overdue tasks
- Real-time data synchronization between users
- Analytics & Insights (task statuses, deadlines, assignee leaderboard, and dynamics)
- Admin Panel: team management, roles, and projects with designated members
- Comprehensive activity log for each commitment

## Local Setup
```bash
npm install
cp .env.local.example .env.local   # fill in NEXT_PUBLIC_SUPABASE_URL / ANON_KEY
npm run dev
```
##  Database
See supabase/README.md: execute supabase/setup.sql (full database schema), optionally run supabase/seed.sql (demo/mock data), and assign the Super-Verifier role.
