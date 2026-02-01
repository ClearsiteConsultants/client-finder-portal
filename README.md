# QuizMaster Pro

Lead generation and outreach management platform for quiz creation businesses.

## Quick Start

### Prerequisites
- Node.js 18+ 
- PostgreSQL database (or Neon Postgres)
- npm or yarn

### Installation

```bash
# Install dependencies
npm install

# Set up environment variables
cp .env.example .env.local
# Edit .env.local with your actual values

# Run database migrations
npm run db:setup

# Create initial user (optional)
node -r tsx/cjs scripts/create-user.ts admin@example.com password "Admin User"

# Start development server
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000) to see the application.

## Available Scripts

### Development
- `npm run dev` - Start development server with hot reload
- `npm run build` - Create production build
- `npm run start` - Start production server (requires build first)

### Code Quality
- `npm run lint` - Run ESLint on source files
- `npm run typecheck` - Run TypeScript type checking
- `npm run test` - Run Jest unit and integration tests
- `npm run verify` - Run full verification suite (lint + typecheck + test)
- `npm run verify:ci` - Run CI verification (lint + typecheck + build, no database required)

### Database
- `npx prisma migrate dev` - Create and apply migrations in development
- `npx prisma migrate deploy` - Apply migrations in production
- `npx prisma studio` - Open Prisma Studio database GUI
- `npx prisma generate` - Generate Prisma Client (runs automatically on postinstall)

## Deployment

This application is optimized for deployment on [Vercel](https://vercel.com).

### Deployment Checklist

1. **Verify locally**
   ```bash
   npm run verify:ci
   ```

2. **Configure environment variables in Vercel**
   - `DATABASE_URL` - PostgreSQL connection string (Neon recommended)
   - `NEXTAUTH_URL` - Your deployment URL
   - `NEXTAUTH_SECRET` - Generate with `openssl rand -base64 32`

3. **Run migrations on production database**
   ```bash
   DATABASE_URL=<your-prod-url> npx prisma migrate deploy
   ```

4. **Deploy to Vercel**
   - Connect your repository to Vercel
   - Vercel will automatically detect Next.js configuration
   - Build command: `npm run build` (automatic)
   - Environment variables will be injected at build time

5. **Create initial user**
   ```bash
   DATABASE_URL=<your-prod-url> node -r tsx/cjs scripts/create-user.ts admin@example.com yourpassword "Admin"
   ```

For detailed deployment instructions, see [EXTERNAL_SETUP.md](./EXTERNAL_SETUP.md).

## Project Structure

```
src/
├── app/              # Next.js App Router pages and API routes
│   ├── api/          # API endpoints
│   ├── login/        # Login page
│   ├── layout.tsx    # Root layout
│   └── page.tsx      # Home page
├── lib/              # Shared utilities and configurations
│   ├── auth.ts       # NextAuth configuration
│   ├── prisma.ts     # Prisma client singleton
│   └── user.ts       # User management utilities
└── middleware.ts     # Authentication middleware

prisma/
├── schema.prisma     # Database schema
└── migrations/       # Database migrations

scripts/
└── create-user.ts    # User creation utility
```

## Environment Variables

See `.env.example` for a complete list of required and optional environment variables.

### Required
- `DATABASE_URL` - PostgreSQL connection string
- `NEXTAUTH_URL` - Application URL for authentication
- `NEXTAUTH_SECRET` - Secret for signing JWT tokens

### Optional
- `DATABASE_URL_TEST` - Test database connection string
- `GOOGLE_MAPS_API_KEY` - For business discovery (Phase 2)
- `SENDGRID_API_KEY` - For email outreach (Phase 5)
- See `.env.example` for more

## Documentation

- [EXTERNAL_SETUP.md](./EXTERNAL_SETUP.md) - External service setup by phase
- [DATABASE_SCHEMA.md](./DATABASE_SCHEMA.md) - Database schema documentation
- [AUTH_README.md](./AUTH_README.md) - Authentication setup and usage
- [PLAN.md](./PLAN.md) - Product requirements and development plan

## Tech Stack

- **Framework:** Next.js 16 (App Router)
- **Language:** TypeScript
- **Database:** PostgreSQL with Prisma ORM
- **Authentication:** NextAuth.js v5
- **Styling:** Tailwind CSS 4
- **Testing:** Jest + React Testing Library
- **Deployment:** Vercel

## License

Private - All Rights Reserved
