import { logInfo } from './utils/logger';
import { AuthService } from './services/auth.service';
import { UserService } from './services/user.service';
import express from 'express';

const app = express();
const authService = new AuthService();
const userService = new UserService();

app.get('/health', (req, res) => {
  logInfo('Health check invoked');
  res.json({ status: 'active', userCount: userService.getAllUsers().length });
});

export default app;
