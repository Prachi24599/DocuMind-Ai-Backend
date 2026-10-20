import {
  clerkMiddleware,
  getAuth,
} from '@clerk/express';
import type { Request, RequestHandler, Response } from 'express';
import { config } from '../config/env';

const isClerkConfigured = Boolean(config.CLERK_PUBLISHABLE_KEY && config.CLERK_SECRET_KEY);

const verifyClerkSession = isClerkConfigured
  ? clerkMiddleware({
    publishableKey: config.CLERK_PUBLISHABLE_KEY,
    secretKey: config.CLERK_SECRET_KEY,
    authorizedParties: [config.CORS_ORIGIN],
  })
  : undefined;

const respondUnauthorized = (res: Parameters<RequestHandler>[1]): void => {
  res.status(401).json({ status: 'error', message: 'Unauthorized' });
};

const invalidTokenReasons = new Set<string>([
  'token-expired',
  'token-invalid',
  'token-invalid-algorithm',
  'token-invalid-authorized-parties',
  'token-invalid-issuer',
  'token-invalid-signature',
  'token-not-active-yet',
  'token-iat-in-the-future',
  'token-verification-failed',
]);

const isCredentialError = (error: unknown): boolean => {
  if (typeof error !== 'object' || error === null) {
    return false;
  }

  if ('reason' in error && typeof error.reason === 'string' && invalidTokenReasons.has(error.reason)) {
    return true;
  }

  const status = 'statusCode' in error
    ? error.statusCode
    : 'status' in error ? error.status : undefined;
  return typeof status === 'number' && status >= 400 && status < 500;
};

export const clerkSessionMiddleware: RequestHandler = (req, res, next) => {
  if (!verifyClerkSession) {
    next();
    return;
  }

  try {
    verifyClerkSession(req, res, (error?: unknown) => {
      if (error) {
        if (isCredentialError(error)) {
          respondUnauthorized(res);
        } else {
          next(error);
        }
        return;
      }

      next();
    });
  } catch (error) {
    next(error);
  }
};

export const requireAuthenticatedUser: RequestHandler = (req, res, next) => {
  if (!isClerkConfigured) {
    res.status(503).json({ status: 'error', message: 'Authentication is not configured' });
    return;
  }

  try {
    const auth = getAuth(req);
    if (!auth.isAuthenticated || !auth.userId) {
      respondUnauthorized(res);
      return;
    }

    req.authenticatedClerkUserId = auth.userId;
    next();
  } catch (error) {
    next(error);
  }
};

export const getAuthenticatedClerkUserId = (req: Request): string | undefined =>
  req.authenticatedClerkUserId;
