import { type NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { getUserByEmail } from "@/lib/users";

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;
        // Retry up to 3x (1.8s total) to handle Vercel Blob propagation delay
        // after a fresh signup — the user blob may not yet be visible on this
        // serverless instance even though it was just written on another.
        const user = await getUserByEmail(credentials.email, { retries: 3 });
        if (!user) return null;
        const valid = await bcrypt.compare(credentials.password, user.passwordHash);
        if (!valid) return null;
        return {
          id: user.id,
          email: user.email,
          name: user.name,
          subscriptionStatus: user.subscriptionStatus,
          subscriptionTier: user.subscriptionTier ?? null,
          isAdmin: user.isAdmin ?? false,
        };
      },
    }),
  ],
  session: { strategy: "jwt" },
  callbacks: {
    async jwt({ token, user, trigger, session: sessionData }) {
      // Helper: check ADMIN_EMAILS env var
      const adminEmails = (process.env.ADMIN_EMAILS || "")
        .split(",").map((e: string) => e.trim().toLowerCase()).filter(Boolean);
      const emailIsAdmin = (email?: string | null) =>
        !!email && adminEmails.includes(email.toLowerCase());

      if (user) {
        // Seed token with authorize() result as a fallback
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        token.subscriptionStatus = (user as any).subscriptionStatus ?? "none";
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        token.subscriptionTier = (user as any).subscriptionTier ?? null;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        token.isAdmin = (user as any).isAdmin ?? emailIsAdmin(user.email) ?? false;
      }
      // Always re-read from blob when we have an email in the token.
      // This ensures admin tier changes take effect on the next session fetch
      // without requiring sign-out. Blob reads are ~50ms and happen once per
      // page load (useSession calls /api/auth/session on mount).
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const passed = sessionData as any;
      if (trigger === "update" && passed?.subscriptionStatus) {
        // Client passed explicit fresh data — apply directly (fastest path)
        token.subscriptionStatus = passed.subscriptionStatus;
        token.subscriptionTier = passed.subscriptionTier ?? null;
      } else if (token.email) {
        // Read live from blob — no retries to avoid serverless timeout
        const fresh = await getUserByEmail(token.email as string);
        if (fresh) {
          token.subscriptionStatus = fresh.subscriptionStatus;
          token.subscriptionTier = fresh.subscriptionTier ?? null;
          token.isAdmin = (fresh.isAdmin ?? false) || emailIsAdmin(token.email as string);
        }
      }
      // Always ensure ADMIN_EMAILS users get isAdmin=true even without refresh
      if (emailIsAdmin(token.email as string)) {
        token.isAdmin = true;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (session.user as any).subscriptionStatus = token.subscriptionStatus ?? "none";
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (session.user as any).subscriptionTier = token.subscriptionTier ?? null;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (session.user as any).isAdmin = token.isAdmin ?? false;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (session.user as any).id = token.sub;
      }
      return session;
    },
  },
  pages: {
    signIn: "/auth/signin",
    error: "/auth/signin",
  },
  secret: process.env.NEXTAUTH_SECRET,
};
