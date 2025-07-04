import { NextAuthOptions } from 'next-auth';
import { JWT } from 'next-auth/jwt';
import GithubProvider from 'next-auth/providers/github';
import GoogleProvider from 'next-auth/providers/google';
import CredentialsProvider from 'next-auth/providers/credentials';
import { env } from '../config/env';

export const authOptions: NextAuthOptions = {
  providers: [
    GithubProvider({
      clientId: process.env.GITHUB_ID || '',
      clientSecret: process.env.GITHUB_SECRET || '',
      authorization: {
        params: {
          scope: 'read:user user:email',
        },
      },
    }),
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
      authorization: {
        params: {
          scope: 'openid email profile',
        },
      },
    }),
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }
        
        // In production, validate against your database
        // For demo purposes, we'll use a simple check
        const validEmails = [
          'admin@example.com',
          'user@example.com',
        ];
        
        if (validEmails.includes(credentials.email) && credentials.password === 'password') {
          return {
            id: '1',
            email: credentials.email,
            name: credentials.email.split('@')[0],
            role: credentials.email === 'admin@example.com' ? 'admin' : 'user',
          };
        }
        
        return null;
      },
    }),
  ],
  
  callbacks: {
    async jwt({ token, user, account }) {
      if (account && user) {
        token.accessToken = account.access_token;
        token.provider = account.provider;
        token.role = user.role || 'user';
      }
      return token;
    },
    
    async session({ session, token }) {
      session.accessToken = token.accessToken as string;
      session.provider = token.provider as string;
      session.user.role = token.role as string;
      return session;
    },
    
    async signIn({ user, account, profile }) {
      // Allow sign in for OAuth providers
      if (account?.provider === 'github' || account?.provider === 'google') {
        return true;
      }
      
      // For credentials, validate email domain (optional)
      if (account?.provider === 'credentials') {
        const allowedDomains = ['example.com', 'yourdomain.com'];
        const emailDomain = user.email?.split('@')[1];
        
        if (emailDomain && allowedDomains.includes(emailDomain)) {
          return true;
        }
      }
      
      return true; // Allow all sign-ins in development
    },
  },
  
  pages: {
    signIn: '/auth/signin',
    error: '/auth/error',
  },
  
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  
  jwt: {
    secret: env.AUTH_SECRET,
  },
  
  secret: env.AUTH_SECRET,
  
  debug: env.NODE_ENV === 'development',
};

// Role-based access control
export const ROLES = {
  ADMIN: 'admin',
  USER: 'user',
  GUEST: 'guest',
} as const;

export type Role = typeof ROLES[keyof typeof ROLES];

export function hasRole(userRole: string | undefined, requiredRole: Role): boolean {
  if (!userRole) return false;
  
  const roleHierarchy: Record<Role, number> = {
    [ROLES.GUEST]: 0,
    [ROLES.USER]: 1,
    [ROLES.ADMIN]: 2,
  };
  
  return roleHierarchy[userRole as Role] >= roleHierarchy[requiredRole];
}

export function requireRole(userRole: string | undefined, requiredRole: Role): void {
  if (!hasRole(userRole, requiredRole)) {
    throw new Error(`Access denied. Required role: ${requiredRole}`);
  }
}

// API key management for user sessions
export function generateAPIKey(userId: string): string {
  const timestamp = Date.now().toString();
  const hash = Buffer.from(`${userId}:${timestamp}:${env.AUTH_SECRET}`)
    .toString('base64')
    .replace(/[^a-zA-Z0-9]/g, '')
    .substring(0, 32);
  
  return `sk-user-${hash}`;
}

export function validateAPIKey(apiKey: string): { valid: boolean; userId?: string } {
  if (!apiKey.startsWith('sk-user-')) {
    return { valid: false };
  }
  
  try {
    const hash = apiKey.replace('sk-user-', '');
    // In production, validate against database
    return { valid: true, userId: 'user-id' };
  } catch {
    return { valid: false };
  }
}