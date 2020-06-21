import '@giraphql/core';
import GrantMap from './grant-map';

export default class AuthMeta {
  grantedPermissions: GrantMap;

  parent: AuthMeta | null = null;

  checkCache: {
    [s: string]: boolean | Promise<boolean>;
  };

  constructor(grantedPermissions?: GrantMap, parent?: AuthMeta | null) {
    this.checkCache = {};
    this.grantedPermissions = grantedPermissions ? grantedPermissions.clone() : new GrantMap();
    this.parent = parent ?? null;
  }
}
