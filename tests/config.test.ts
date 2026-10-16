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

  it('rejects non-PostgreSQL database URLs without echoing the value', () => {
    const result = parseEnvironment({ DATABASE_URL: 'https://invalid.example/secret' });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path).toEqual(['DATABASE_URL']);
      expect(result.error.issues[0]?.message).toContain('PostgreSQL');
    }
  });
});
