import { User } from './data';

export interface ContextType {
  userID: number;
  role: 'Admin' | 'User' | 'Guest';
  User: typeof User;
  user: User | null;
}
