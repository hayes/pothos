import { SchemaTypes } from '@giraphql/core';

export type DirectiveLocation =
  'ARGUMENT_DEFINITION' | 'ENUM_VALUE' | 'ENUM' | 'FIELD_DEFINITION' | 'INPUT_FIELD_DEFINITION' | 'INPUT_OBJECT' | 'INTERFACE' | 'OBJECT' | 'SCALAR' | 'SCHEMA' | 'UNION';

export type DirectiveList = { name: string; args?: {} }[];

export type DirectivesFor<Types extends SchemaTypes, Location extends DirectiveLocation> = {
  [K in keyof Types['Directives']]: Location extends Types['Directives'][K]['locations']
    ? K
    : never;
}[keyof Types['Directives']];

export type Directives<Types extends SchemaTypes, Location extends DirectiveLocation> =
  {
      [K in keyof Types['Directives']]: Types['Directives'][K]['locations'] extends Location
        ? {
            name: K;
            args: Types['Directives'][K]['args'];
          }
        : never;
    }[keyof Types['Directives']][] | {
      [K in DirectivesFor<Types, Location>]?: Types['Directives'][K]['args'] & {};
    };
