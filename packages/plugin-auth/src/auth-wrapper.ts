import '@giraphql/core';

export type AuthMeta<Types extends GiraphQLSchemaTypes.TypeInfo> = {
  grantedAuth: {
    [s: string]: boolean;
  };
  checkCache: {
    [s: string]: boolean | Promise<boolean>;
  };
};

export default class AuthWrapper<Parent, Types extends GiraphQLSchemaTypes.TypeInfo> {
  parent: Parent;

  authData: AuthMeta<Types>;

  constructor(
    parent: Parent,
    grantedAuth: {
      [s: string]: boolean;
    },
  ) {
    this.parent = parent;
    this.authData = {
      checkCache: {},
      grantedAuth: {
        ...grantedAuth,
      },
    };
  }

  unwrap() {
    return this.parent;
  }
}
