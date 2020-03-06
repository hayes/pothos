import '@giraphql/core';

export default class AuthMeta {
  grantedPermissions: Set<string>;

  checkCache: {
    [s: string]: boolean | Promise<boolean>;
  };

  constructor(grantedPermissions?: Set<string>) {
    this.checkCache = {};
    this.grantedPermissions = new Set(grantedPermissions);
  }
}
