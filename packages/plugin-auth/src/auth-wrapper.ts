import '@giraphql/core';

export default class AuthMeta {
  grantedPermissions: {
    [s: string]: boolean;
  };
  checkCache: {
    [s: string]: boolean | Promise<boolean>;
  };

  constructor(grantedPermissions?: { [s: string]: boolean }) {
    this.checkCache = {};
    this.grantedPermissions = {
      ...grantedPermissions,
    };
  }
}
