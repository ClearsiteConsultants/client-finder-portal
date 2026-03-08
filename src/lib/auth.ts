import NextAuth, { type DefaultSession } from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import CredentialsProvider from "next-auth/providers/credentials";
import { prisma } from "./prisma";
import { compare } from "bcryptjs";
import { type JWT } from "next-auth/jwt";

declare module "next-auth" {
  interface Session {
    user?: {
      id: string;
    } & DefaultSession["user"];
    error?: "SessionInvalid";
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    sessionInvalid?: boolean;
  }
}

async function validateTokenUser(token: JWT): Promise<JWT> {
  if (!token.id) {
    return token;
  }

  const user = await prisma.user.findUnique({
    where: { id: token.id },
    select: { id: true },
  });

  if (!user) {
    delete token.id;
    token.sessionInvalid = true;
    return token;
  }

  token.sessionInvalid = false;
  return token;
}

export const {
  handlers: { GET, POST },
  auth,
  signIn,
  signOut,
} = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: "/login",
  },
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        const user = await prisma.user.findUnique({
          where: { email: credentials.email as string },
        });

        if (!user || !user.passwordHash) {
          return null;
        }

        const isValid = await compare(
          credentials.password as string,
          user.passwordHash
        );

        if (!isValid) {
          return null;
        }

        // Update last login
        await prisma.user.update({
          where: { id: user.id },
          data: { lastLogin: new Date() },
        });

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
      }

      return validateTokenUser(token);
    },
    async session({ session, token }) {
      if (token.sessionInvalid || !token.id) {
        return {
          ...session,
          user: undefined,
          error: "SessionInvalid",
        };
      }

      if (session.user) {
        session.user.id = token.id;
      }

      return session;
    },
  },
});
