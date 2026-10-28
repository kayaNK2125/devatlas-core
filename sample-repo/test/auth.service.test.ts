import { describe, it, expect } from 'vitest';
import { AuthService } from '../src/services/auth.service';

describe('AuthService', () => {
  it('should initialize correctly', () => {
    const service = new AuthService();
    expect(service).toBeDefined();
  });
});
