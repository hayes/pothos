import '@giraphql/core';

export default class AuthMeta {
  grantedAuth: {
    [s: string]: boolean;
  };
  checkCache: {
    [s: string]: boolean | Promise<boolean>;
  };

  constructor(grantedAuth?: { [s: string]: boolean }) {
    this.checkCache = {};
    this.grantedAuth = {
      ...grantedAuth,
    };
  }
}
