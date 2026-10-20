import { describe, expect, it } from 'vitest';
import { parseEnvironment } from '../src/config/env';

describe('environment configuration', () => {
  it('allows health-test configuration without database URLs', () => {
    const result = parseEnvironment({ NODE_ENV: 'test' });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.DATABASE_URL).toBeUndefined();
      expect(result.data.DIRECT_URL).toBeUndefined();
    }
  });

  it('accepts PostgreSQL runtime and direct URLs', () => {
    const result = parseEnvironment({
      DATABASE_URL: 'postgresql://localhost:5432/documind',
      DIRECT_URL: 'postgresql://localhost:5432/documind_direct',
    });

    expect(result.success).toBe(true);
  });

  it('accepts Clerk keys only when both backend keys are configured', () => {
    const result = parseEnvironment({
      CLERK_PUBLISHABLE_KEY: 'pk_test_example',
      CLERK_SECRET_KEY: 'sk_test_example',
    });

    expect(result.success).toBe(true);
  });

  it('rejects partial Clerk configuration without echoing credentials', () => {
    const result = parseEnvironment({ CLERK_SECRET_KEY: 'sk_test_private' });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path).toEqual(['CLERK_PUBLISHABLE_KEY']);
      expect(result.error.issues[0]?.message).toContain('must be configured together');
      expect(JSON.stringify(result.error.issues)).not.toContain('sk_test_private');
    }
  });

  it('rejects non-PostgreSQL database URLs without echoing the value', () => {
    const result = parseEnvironment({ DATABASE_URL: 'https://invalid.example/secret' });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path).toEqual(['DATABASE_URL']);
      expect(result.error.issues[0]?.message).toContain('PostgreSQL');
    }
  });
});
