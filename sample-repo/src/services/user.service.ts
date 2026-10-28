import { logInfo } from '../utils/logger';

export interface User {
  id: string;
  email: string;
}

export class UserService {
  private users: User[] = [
    { id: 'usr-1', email: 'alice@example.com' },
    { id: 'usr-2', email: 'bob@example.com' }
  ];

  getAllUsers(): User[] {
    logInfo('Retrieving users');
    return this.users;
  }

  findUserByEmail(email: string): User | undefined {
    return this.users.find(u => u.email === email);
  }
}
