import { compare } from "bcryptjs";
import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";

import { prisma } from "@/lib/prisma";
import {
  clearHits,
  clientIp,
  hit,
  isLimited,
  LOGIN_ACCOUNT_LIMIT,
  LOGIN_IP_LIMIT,
  LOGIN_RATE_LIMITED,
} from "@/lib/rate-limit";
import { fullName } from "@/lib/user";
import { loginSchema } from "@/lib/validations/auth";

// Compared against when the account does not exist, so a failed login takes the
// same time whether or not the account exists (avoids user enumeration).
const DUMMY_PASSWORD_HASH =
  "$2b$12$O/1x2Fp4.NIyPCt9me30j.kiI15jMhCH.ZDCYolQPvUoHtNkp/UZS";

export const authOptions: NextAuthOptions = {
  secret: process.env.NEXTAUTH_SECRET,
  session: { strategy: "jwt" },
  pages: {
    signIn: "/auth/login",
  },
  providers: [
    CredentialsProvider({
      name: "Correo o usuario y contraseña",
      credentials: {
        identifier: { label: "Correo o usuario", type: "text" },
        password: { label: "Contraseña", type: "password" },
      },
      async authorize(credentials, req) {
        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) return null;

        // Thrown errors reach the client as `result.error`; returning null means "wrong credentials".
        const ip = clientIp(req?.headers);
        if (ip && !(await hit(`login:ip:${ip}`, LOGIN_IP_LIMIT)).allowed) {
          throw new Error(LOGIN_RATE_LIMITED);
        }

        const { identifier, password } = parsed.data;
        const user = await prisma.user.findUnique({
          where: identifier.includes("@") ? { email: identifier } : { username: identifier },
          select: {
            id: true,
            firstName: true,
            lastName: true,
            username: true,
            email: true,
            passwordHash: true,
            sessionVersion: true,
          },
        });

        // Unknown identifiers get locked the same way, so the lockout doesn't reveal which accounts exist.
        // Keyed by user id so switching between email and username doesn't buy more attempts.
        const accountKey = `login:account:${user?.id ?? identifier}`;
        if (await isLimited(accountKey, LOGIN_ACCOUNT_LIMIT)) throw new Error(LOGIN_RATE_LIMITED);

        const isValid = await compare(
          password,
          user?.passwordHash ?? DUMMY_PASSWORD_HASH,
        );
        if (!user || !isValid) {
          await hit(accountKey, LOGIN_ACCOUNT_LIMIT);
          return null;
        }
        await clearHits(accountKey);

        return {
          id: user.id,
          name: fullName(user),
          email: user.email,
          username: user.username,
          firstName: user.firstName,
          sessionVersion: user.sessionVersion,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      // `user` is only present right after signing in.
      if (user) {
        token.username = user.username;
        token.firstName = user.firstName;
        token.sessionVersion = user.sessionVersion;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.sub) {
        session.user.id = token.sub;
        session.user.username = token.username ?? "";
        session.user.firstName = token.firstName ?? session.user.name?.split(" ")[0] ?? "";
        // Tokens issued before sessionVersion existed match the column default.
        session.user.sessionVersion = token.sessionVersion ?? 0;
      }
      return session;
    },
  },
};
