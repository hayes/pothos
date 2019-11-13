import '@giraphql/core';

export type AuthMeta<Types extends GiraphQLSchemaTypes.TypeInfo> = {
  grantAuth?: {
    [s: string]:
      | true
      | ((parent: unknown, context: Types['Context']) => boolean | Promise<boolean>);
  };
  grantCache?: {
    [s: string]: boolean | Promise<boolean>;
  };
  checkCache?: {
    [s: string]: boolean | Promise<boolean>;
  };
};

export default class AuthWrapper<Parent, Types extends GiraphQLSchemaTypes.TypeInfo> {
  parent: Parent;

  authData: AuthMeta<Types>;

  constructor(parent: Parent, authData: AuthMeta<Types>) {
    this.parent = parent;
    this.authData = authData;
  }

  unwrap() {
    return this.parent;
  }
}
