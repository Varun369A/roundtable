# Arivarangam

AI orchestration platform. One goal. Every AI. Live collaboration.

## Structure

```
sabha/
├── apps/
│   ├── web/     Next.js 14 frontend
│   └── api/     Fastify API backend
├── packages/
│   ├── db/      Prisma schema + client
│   ├── types/   Shared TypeScript types
│   └── config/  Environment validation
└── docker-compose.yml
```

## Setup

### Prerequisites
- Node.js 20+
- Docker Desktop (for local Postgres + Redis)
- npm 10+

### 1. Install dependencies
```bash
npm install
```

### 2. Configure environment
```bash
cp .env.example .env
# Edit .env with your values
```

```bash
cp apps/web/.env.local.example apps/web/.env.local
```

### 3. Start database and Redis
```bash
docker-compose up -d
```

### 4. Run migrations and seed
```bash
cd packages/db
npx prisma generate
npx prisma db push
npx ts-node prisma/seed.ts
```

### 5. Start development
```bash
npm run dev
```

- Frontend: http://localhost:3000
- API: http://localhost:3001
- API Health: http://localhost:3001/health
- Prisma Studio: `npm run db:studio`

## API Endpoints

### Auth
| Method | Path | Description |
|--------|------|-------------|
| POST | /api/v1/auth/signup | Create account |
| POST | /api/v1/auth/login | Log in |
| POST | /api/v1/auth/refresh | Refresh access token |
| POST | /api/v1/auth/logout | Log out (requires auth) |
| GET  | /api/v1/auth/me | Get current user (requires auth) |

### Tasks
| Method | Path | Description |
|--------|------|-------------|
| POST | /api/v1/tasks | Create a new task |
| GET  | /api/v1/tasks | List user's tasks |
| GET  | /api/v1/tasks/:id | Get task detail |
| DELETE | /api/v1/tasks/:id | Cancel a task |

## Build Sequence Progress

- [x] Month 1: Auth + DB schema + Task API
- [ ] Month 2: Intent Parser + Task Decomposer + Context Manager
- [ ] Month 3: AI Connectors (Claude + GPT-4 + Perplexity)
- [ ] Month 4: Stream API + Roundtable UI (live)
- [ ] Month 5: Remaining AI Connectors + Marketplace
- [ ] Month 6: Billing + Razorpay
- [ ] Month 7: Language layer (Sarvam)
- [ ] Month 8: Admin dashboard + Analytics
- [ ] Month 9: Performance testing + Security audit
- [ ] Month 10-11: Beta
- [ ] Month 12: Launch
