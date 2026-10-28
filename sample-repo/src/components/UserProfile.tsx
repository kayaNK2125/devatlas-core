import React, { useState, useEffect } from 'react';
import { Button } from './Button';
import { UserService, User } from '../services/user.service';
import { formatCurrency } from '../utils/format';

export const UserProfile: React.FC<{ userId: string }> = ({ userId }) => {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const service = new UserService();
    const found = service.getAllUsers().find(u => u.id === userId);
    setUser(found || null);
  }, [userId]);

  return (
    <div className="profile-card">
      <h3>User Profile: {user?.email ?? 'Unknown'}</h3>
      <p>Balance: {formatCurrency(150.5)}</p>
      <Button label="Refresh" onClick={() => console.log('Refreshing')} />
    </div>
  );
};
