/* eslint-disable max-classes-per-file */
export class User {
  static map = new Map<number, User>();

  static lastID = 0;

  firstName: string;

  lastName: string;

  email: string;

  id: number;

  role: 'Admin' | 'User' | 'Guest';

  constructor(firstName: string, lastName: string, role: 'Admin' | 'User') {
    this.firstName = firstName;
    this.lastName = lastName;
    this.email = `${firstName}.${lastName}@example.com`.toLowerCase();
    this.role = role;

    this.id = User.lastID + 1;

    User.lastID = this.id;
  }

  static create(firstName: string, lastName: string, role: 'Admin' | 'User') {
    const user = new User(firstName, lastName, role);

    this.map.set(user.id, user);

    return user;
  }
}

User.create('Michael', 'Hayes', 'Admin');
User.create('Darth', 'Vader', 'User');

export class Other {}

export function createContext(userID: number) {
  const role = User.map.get(userID) ? User.map.get(userID)!.role : 'Guest';

  return {
    userID,
    role,
    User,
    user: User.map.get(userID) ?? null,
  };
}
