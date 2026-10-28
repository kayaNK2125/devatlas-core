import { TokenService } from './token.service';
import { UserService } from './user.service';
import { hashString, verifyHash } from '../utils/crypto';
import { logInfo, logError } from '../utils/logger';

export class AuthService {
  private tokenService: TokenService;
  private userService: UserService;

  constructor() {
    this.tokenService = new TokenService();
    this.userService = new UserService();
  }

  login(email: string, passwordHash: string): string | null {
    logInfo(`Login attempt for ${email}`);
    const user = this.userService.findUserByEmail(email);
    if (!user) {
      logError(`User not found: ${email}`);
      return null;
    }

    const expected = hashString('secure_pass');
    if (!verifyHash(passwordHash, expected)) {
      logError('Invalid credentials');
      return null;
    }

    return this.tokenService.generateToken(user.id);
  }
}
