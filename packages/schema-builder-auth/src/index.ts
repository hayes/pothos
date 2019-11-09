/* eslint-disable @typescript-eslint/no-unused-vars */
import SchemaBuilder, {
  CompatibleInterfaceNames,
  ShapeFromTypeParam,
  NamedTypeParam,
} from 'schema-builder';
import InterfaceType from 'schema-builder/src/interface';

declare global {
  export namespace SpiderSchemaTypes {
    export interface ObjectTypeOptions<
      Shape extends {},
      Interfaces extends InterfaceType<
        {},
        Types,
        CompatibleInterfaceNames<Types, ShapeFromTypeParam<Types, Type, false>>
      >[],
      Types extends TypeInfo,
      Type extends NamedTypeParam<Types>
    > {
      permissions?: {
        [s: string]: (
          parent: ShapeFromTypeParam<Types, Type, false>,
          context: Types['Context'],
        ) => boolean;
      };
    }
  }
}

const builder = new SchemaBuilder<{
  Output: { ID: string; Foo: { name: string } };
  Context: { role: 'Admin' | 'User' | 'Guest' };
}>();

builder.createObjectType('Foo', {
  permissions: {
    canRead: (parent, context) => context.role === 'Admin',
  },
  shape: t => ({
    name: t.exposeString('name'),
  }),
});
