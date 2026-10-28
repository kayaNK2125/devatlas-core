import { hashString } from '../utils/crypto';
import jwt from 'jsonwebtoken';

const SECRET_KEY = 'demo-secret-key';

export class TokenService {
  generateToken(userId: string): string {
    const payload = { uid: userId, signed: hashString(userId) };
    return jwt.sign(payload, SECRET_KEY, { expiresIn: '1h' });
  }

  verifyToken(token: string): boolean {
    try {
      jwt.verify(token, SECRET_KEY);
      return true;
    } catch {
      return false;
    }
  }
}
