import { logInfo } from './logger';

export function hashString(value: string): string {
  logInfo(`Hashing value of length ${value.length}`);
  // Simulated hash for demo fixture
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    const char = value.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return `hash_${Math.abs(hash)}`;
}

export function verifyHash(value: string, expectedHash: string): boolean {
  return hashString(value) === expectedHash;
}
