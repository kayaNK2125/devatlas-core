import { describe, it, expect } from 'vitest';
import { hashString, verifyHash } from '../src/utils/crypto';

describe('Crypto Utils', () => {
  it('hashes consistently', () => {
    const hash = hashString('password123');
    expect(hash).toContain('hash_');
    expect(verifyHash('password123', hash)).toBe(true);
  });
});
