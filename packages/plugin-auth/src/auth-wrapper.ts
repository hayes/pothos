import '@giraphql/core';

export type AuthMeta<Types extends GiraphQLSchemaTypes.TypeInfo> = {
  grantAuth: {
    [s: string]:
      | true
      | ((parent: unknown, context: Types['Context']) => boolean | Promise<boolean>);
  };
  grantCache: {
    [s: string]: boolean | Promise<boolean>;
  };
  checkCache: {
    [s: string]: boolean | Promise<boolean>;
  };
};

export default class AuthWrapper<Parent, Types extends GiraphQLSchemaTypes.TypeInfo> {
  parent: Parent;

  authData: AuthMeta<Types>;

  constructor(parent: Parent, grantAuth: AuthMeta<Types>['grantAuth']) {
    this.parent = parent;
    this.authData = {
      grantCache: {},
      checkCache: {},
      grantAuth: {
        ...grantAuth,
      },
    };
  }

  unwrap() {
    return this.parent;
  }
}
