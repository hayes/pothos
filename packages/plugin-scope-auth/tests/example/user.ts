export default class User {
  id;

  permissions: string[];

  roles: string[];

  constructor(headers: Record<string, string | string[] | undefined>) {
    this.id = headers['x-user-id'] as string;
    this.permissions = headers['x-permissions']
      ? (headers['x-permissions'] as string).split(',').map((perm) => perm.trim())
      : [];
    this.roles = headers['x-roles']
      ? (headers['x-roles'] as string).split(',').map((role) => role.trim())
      : [];
  }
}
