# ATS Platform (RecruitFlow)

## Overview

A full-stack Applicant Tracking System (ATS) with 3 user roles:
- **Admin** — Manages companies, users, approves job roles, sees all data, analytics dashboard
- **Client HR** — Creates job positions (with salary/location/remote), reviews/evaluates candidates, adds notes, exports PDF
- **Vendor** — Views open positions, submits candidates with tags, CV parsing via AI, tracks placements, submits timesheets

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **Frontend**: React + Vite (artifacts/ats-platform) - served at /
- **API framework**: Express 5 (artifacts/api-server) - served at /api
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Auth**: JWT (jsonwebtoken + bcryptjs)
- **Build**: esbuild (CJS bundle)
- **PDF export**: jsPDF (frontend, candidate profile export)
- **AI**: OpenAI-compatible (Replit AI or OpenAI key for CV parsing)

## Default Credentials

- Admin: admin@ats.com / admin123
- Client HR: hr@techcorp.com / client123
- Vendor: vendor@staffingpro.com / vendor123

## Database Schema

8 tables:
- `companies` — client and vendor companies
- `users` — all users with role (admin|client|vendor) and company link
- `job_roles` — positions with status (draft→pending_approval→published→closed), salary range, location, employment type, isRemote
- `candidates` — submitted candidates with pipeline status, tags (comma-separated), cvUrl
- `candidate_notes` — internal notes/activity log per candidate
- `contracts` — placement contracts with daily rate
- `timesheets` — monthly timesheet submissions

## Structure

```text
artifacts-monorepo/
├── artifacts/
│   ├── api-server/         # Express API server (port 8080, path /api)
│   │   └── src/
│   │       ├── lib/auth.ts     # JWT middleware
│   │       └── routes/         # auth, companies, users, roles, candidates, contracts, timesheets, notes, analytics, cv-parse
│   └── ats-platform/       # React + Vite frontend (port 25964, path /)
│       └── src/
│           ├── pages/
│           │   ├── login.tsx
│           │   ├── admin/       # companies, users, roles, candidates, contracts, timesheets, analytics
│           │   ├── client/      # roles (extended form), candidates (list+detail+notes+PDF), timesheets
│           │   └── vendor/      # positions, submit-candidate (tags+AI parse), candidates (tags), contracts, timesheets
│           └── components/
│               └── layout/DashboardLayout.tsx
├── lib/
│   ├── api-spec/           # OpenAPI spec + Orval codegen config
│   ├── api-client-react/   # Generated React Query hooks (with JWT injection in custom-fetch)
│   ├── api-zod/            # Generated Zod schemas from OpenAPI
│   └── db/                 # Drizzle ORM schema + DB connection
└── scripts/                # Utility scripts
```

## Key API Endpoints

- POST /api/auth/login — Login (returns JWT)
- GET  /api/auth/me — Current user
- GET/POST /api/companies — Company management (admin)
- GET/POST /api/users — User management (admin)
- GET/POST /api/roles — Job roles (with salary, location, employmentType, isRemote)
- PATCH /api/roles/:id/status — Approve/publish role
- GET/POST /api/candidates — Candidates (with tags)
- GET /api/candidates/:id — Single candidate detail
- PATCH /api/candidates/:id/status — Move through pipeline
- GET/POST /api/candidates/:id/notes — Candidate notes
- GET /api/analytics — Platform analytics (totals, by-status breakdowns, top roles)
- POST /api/cv-parse — AI CV parsing (needs REPLIT_AI_TOKEN or OPENAI_API_KEY)
- GET/POST /api/contracts — Contracts (admin creates)
- GET/POST /api/timesheets — Timesheets (vendor submits)

## Role-Based Access

- Admin: All endpoints + Analytics
- Client: Own company's roles and candidates (with notes, PDF export), timesheets
- Vendor: Published roles only, own candidates (with tags + AI CV parsing), own contracts/timesheets

## CV Parsing

Requires `REPLIT_AI_TOKEN` (Replit built-in AI) or `OPENAI_API_KEY` environment variable.
Endpoint: POST /api/cv-parse with body `{ cvText: "..." }`.
