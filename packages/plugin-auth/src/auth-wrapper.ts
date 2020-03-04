import '@giraphql/core';
import { PostResolveCheck } from './types';

export default class AuthMeta {
  grantedPermissions: {
    [s: string]: boolean;
  };

  checkCache: {
    [s: string]: boolean | Promise<boolean>;
  };

  postResolveMap: Map<string, PostResolveCheck<any, unknown> | null>;

  constructor(
    postResolveMap: Map<string, PostResolveCheck<any, unknown> | null>,
    grantedPermissions?: { [s: string]: boolean },
  ) {
    this.checkCache = {};
    this.postResolveMap = postResolveMap;
    this.grantedPermissions = {
      ...grantedPermissions,
    };
  }
}
