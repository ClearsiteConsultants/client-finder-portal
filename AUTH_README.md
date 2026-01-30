# Authentication Setup

This project uses NextAuth.js v5 for authentication.

## Features

- ✅ Credentials-based authentication (email/password)
- ✅ Protected routes and API endpoints
- ✅ Session management with JWT
- ✅ Prisma adapter for database sessions
- ✅ Middleware for automatic route protection
- ✅ Login/logout functionality

## Setup

1. Ensure your `.env.local` file has the following variables:

```env
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-secret-here
```

2. Run migrations to create auth tables:

```bash
npx prisma migrate dev
```

3. Create a user:

```bash
node -r dotenv/config -r tsx/cjs scripts/create-user.ts "email@example.com" "password" "Name"
```

## Usage

### Protecting Pages

Pages in the app directory are automatically protected by the middleware. The login page is excluded from protection.

### Protecting API Routes

```typescript
import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await auth();
  
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  
  // Your protected logic here
  return NextResponse.json({ data: "Protected data" });
}
```

### Getting Session in Server Components

```typescript
import { auth } from "@/lib/auth";

export default async function Page() {
  const session = await auth();
  
  return <div>Logged in as {session?.user?.email}</div>;
}
```

### Using Session in Client Components

```typescript
"use client";

import { useSession } from "next-auth/react";

export default function ClientComponent() {
  const { data: session } = useSession();
  
  return <div>Logged in as {session?.user?.email}</div>;
}
```

## Testing

Run the authentication tests:

```bash
npm test src/lib/user.test.ts
npm test src/app/api/protected/route.test.ts
```

## Database Schema

The following tables are added for NextAuth:

- `accounts` - OAuth provider accounts
- `sessions` - User sessions
- `verification_tokens` - Email verification tokens
- `users` - Updated with `emailVerified` and `image` fields
