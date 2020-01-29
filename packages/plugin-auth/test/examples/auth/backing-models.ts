import { User } from './data';

export type ContextType = {
  userID: number;
  role: 'Admin' | 'User' | 'Guest';
  User: typeof User;
  user: User | null;
};
