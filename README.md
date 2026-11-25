# CampusFind — Secure Campus Lost & Found Management System

CampusFind is a university lost-and-found platform built around three core workflows:

1. **Lost & Found Reporting**: Structured intake for lost and found property with campus building locations, timestamps, categories, and distinguishing details.
2. **Smart Item Matching**: Automated attribute comparison between lost reports and found inventory across category, campus zone, time window, and descriptor signals.
3. **Secure Claim & Verification**: Evidence-backed ownership claims reviewed by campus safety staff with a complete custodial audit trail.

---

## Project Architecture

The repository is organized into two isolated workspaces:

- `frontend/` — React + TypeScript + Vite + Tailwind CSS + React Router + TanStack Query client application (Phase 1 deliverable).
- `backend/` — Node.js + Express + TypeScript + Prisma ORM + Zod + Supabase PostgreSQL database foundation (Phase 2 deliverable).

```text
.
├── frontend/
│   ├── index.html
│   ├── package.json
│   ├── tsconfig.json
│   ├── vite.config.ts
│   └── src/
│       ├── components/
│       ├── pages/
│       ├── layouts/
│       ├── routes/
│       ├── hooks/
│       ├── services/
│       ├── types/
│       ├── utils/
│       ├── App.tsx
│       ├── index.css
│       └── main.tsx
└── backend/
    ├── .env.example
    ├── DATABASE.md
    ├── package.json
    ├── tsconfig.json
    ├── prisma/
    │   ├── schema.prisma
    │   ├── seed.ts
    │   └── migrations/
    └── src/
        ├── config/
        ├── models/
        ├── controllers/
        ├── services/
        ├── routes/
        ├── middleware/
        ├── validators/
        ├── utils/
        ├── app.ts
        └── server.ts
```

---

## Frontend Development (Phase 1)

```bash
npm install
npm run dev
```

Or run standalone inside `frontend/`:

```bash
cd frontend
npm install
npm run dev
```

---

## Backend Database Foundation (Phase 2)

See [`backend/DATABASE.md`](./backend/DATABASE.md) for full entity relationship documentation and Supabase setup steps.

1. Configure `backend/.env` from `backend/.env.example` with your Supabase `DATABASE_URL` (pooled port `6543`) and `DIRECT_URL` (direct port `5432`).
2. Generate Prisma Client, apply migrations, and seed development data:

```bash
cd backend
npm install
npx prisma generate
npx prisma migrate deploy
npm run db:seed
npm run db:test
```
