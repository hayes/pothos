import '@giraphql/core';
import GrantMap from './grant-map';

export default class AuthMeta {
  grantedPermissions: GrantMap;

  checkCache: {
    [s: string]: boolean | Promise<boolean>;
  };

  constructor(grantedPermissions?: GrantMap) {
    this.checkCache = {};
    this.grantedPermissions = grantedPermissions ? grantedPermissions.clone() : new GrantMap();
  }
}
