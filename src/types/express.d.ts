declare global {
  namespace Express {
    interface Request {
      authenticatedClerkUserId?: string;
    }
  }
}

export {};
