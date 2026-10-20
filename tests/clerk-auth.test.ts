import express, { type Request } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const clerkMocks = vi.hoisted(() => ({
  clerkMiddleware: vi.fn(() => (req: RequestWithMockAuth, _res: unknown, next: (error?: Error) => void) => {
    const authorization = req.get('authorization');

    if (!authorization) {
      req.mockAuth = { isAuthenticated: false, userId: null };
      next();
      return;
    }

    if (authorization !== 'Bearer valid-session-token') {
      const reason = authorization.includes('expired') ? 'token-expired' : 'token-invalid';
      next(Object.assign(new Error('Clerk could not verify the session token.'), { reason }));
      return;
    }

    req.mockAuth = { isAuthenticated: true, userId: 'user_verified_123' };
    next();
  }),
  getAuth: vi.fn((req: RequestWithMockAuth) =>
    req.mockAuth ?? { isAuthenticated: false, userId: null }),
}));

vi.mock('@clerk/express', () => clerkMocks);
vi.mock('../src/config/env', () => ({
  config: {
    CLERK_PUBLISHABLE_KEY: 'pk_test_example',
    CLERK_SECRET_KEY: 'sk_test_example',
    CORS_ORIGIN: 'http://frontend.example',
  },
}));

import { clerkSessionMiddleware, requireAuthenticatedUser } from '../src/middleware/clerk-auth';

type MockAuth = { isAuthenticated: boolean; userId: string | null };
type RequestWithMockAuth = Request & { mockAuth?: MockAuth };

const createTestApp = () => {
  const app = express();
  app.use(clerkSessionMiddleware);
  app.get('/protected', requireAuthenticatedUser, (req, res) => {
    res.json({ userId: req.authenticatedClerkUserId });
  });
  return app;
};

describe('Clerk authentication middleware', () => {
  beforeEach(() => {
    clerkMocks.getAuth.mockClear();
  });

  it('rejects missing credentials with 401', async () => {
    const response = await request(createTestApp()).get('/protected');

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ status: 'error', message: 'Unauthorized' });
  });

  it.each([
    ['malformed', 'Bearer not-a-session-token'],
    ['expired', 'Bearer expired-session-token'],
    ['invalid', 'Bearer forged-session-token'],
  ])('rejects %s credentials with 401', async (_description, authorization) => {
    const response = await request(createTestApp())
      .get('/protected')
      .set('Authorization', authorization);

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ status: 'error', message: 'Unauthorized' });
  });

  it('exposes the verified Clerk user ID and ignores a client-supplied ownerId', async () => {
    const response = await request(createTestApp())
      .get('/protected?ownerId=00000000-0000-0000-0000-000000000001')
      .set('Authorization', 'Bearer valid-session-token');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ userId: 'user_verified_123' });
    expect(clerkMocks.getAuth).toHaveBeenCalled();
  });

  it('configures Clerk to verify tokens for the allowed frontend origin', () => {
    expect(clerkMocks.clerkMiddleware).toHaveBeenCalledWith({
      publishableKey: 'pk_test_example',
      secretKey: 'sk_test_example',
      authorizedParties: ['http://frontend.example'],
    });
  });
});
