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
        const user = await getUserByEmail(credentials.email);
        if (!user) return null;
        const valid = await bcrypt.compare(credentials.password, user.passwordHash);
        if (!valid) return null;
        return {
          id: user.id,
          email: user.email,
          name: user.name,
          subscriptionStatus: user.subscriptionStatus,
          isAdmin: user.isAdmin ?? false,
        };
      },
    }),
  ],
  session: { strategy: "jwt" },
  callbacks: {
    async jwt({ token, user, trigger }) {
      // Helper: check ADMIN_EMAILS env var
      const adminEmails = (process.env.ADMIN_EMAILS || "")
        .split(",").map((e: string) => e.trim().toLowerCase()).filter(Boolean);
      const emailIsAdmin = (email?: string | null) =>
        !!email && adminEmails.includes(email.toLowerCase());

      if (user) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        token.subscriptionStatus = (user as any).subscriptionStatus ?? "none";
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        token.isAdmin = (user as any).isAdmin ?? emailIsAdmin(user.email) ?? false;
      }
      // Refresh subscription status on each session check
      if (trigger === "update" && token.email) {
        const fresh = await getUserByEmail(token.email as string);
        if (fresh) {
          token.subscriptionStatus = fresh.subscriptionStatus;
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
