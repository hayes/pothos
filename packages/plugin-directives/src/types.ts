import { SchemaTypes } from '@giraphql/core';

export type DirectiveLocation =
  | 'SCHEMA'
  | 'SCALAR'
  | 'OBJECT'
  | 'FIELD_DEFINITION'
  | 'ARGUMENT_DEFINITION'
  | 'INTERFACE'
  | 'UNION'
  | 'ENUM'
  | 'ENUM_VALUE'
  | 'INPUT_OBJECT'
  | 'INPUT_FIELD_DEFINITION';

export type DirectiveList = { name: string; args?: {} }[];

export type DirectivesFor<Types extends SchemaTypes, Location extends DirectiveLocation> = {
  [K in keyof Types['Directives']]: Types['Directives'][K]['locations'] extends Location
    ? K
    : never;
}[keyof Types['Directives']];

export type Directives<Types extends SchemaTypes, Location extends DirectiveLocation> =
  | {
      [K in DirectivesFor<Types, Location>]?: Types['Directives'][K]['args'] & {};
    }
  | {
      [K in keyof Types['Directives']]: Types['Directives'][K]['locations'] extends Location
        ? {
            name: K;
            args: Types['Directives'][K]['args'];
          }
        : never;
    }[keyof Types['Directives']][];
