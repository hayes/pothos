import { InputRef, SchemaTypes } from '@pothos/core';
import { PrismaModelTypes } from '@pothos/plugin-prisma';
import { GetPrismaCrud, PrismaWhereOptions, ScalarFilterName } from './types';
import { PrismaCrudPlugin } from '.';

declare global {
  export namespace PothosSchemaTypes {
    export interface Plugins<Types extends SchemaTypes> {
      prismaCrud: PrismaCrudPlugin<Types>;
    }

    export interface UserSchemaTypes {
      PrismaCrudTypes: {};
    }

    export interface ExtendDefaultTypes<PartialTypes extends Partial<UserSchemaTypes>> {
      PrismaCrudTypes: undefined extends PartialTypes['PrismaCrudTypes']
        ? {}
        : PartialTypes['PrismaCrudTypes'] & {};
    }

    export interface SchemaBuilder<Types extends SchemaTypes> {
      prismaScalarFilter: <Name extends ScalarFilterName<Types>>(
        name: Name,
        options?: {},
      ) => InputRef<GetPrismaCrud<Types>['ScalarFilters'][Name]>;

      prismaWhere: <
        Name extends keyof Types['PrismaTypes'],
        Model extends PrismaModelTypes = Types['PrismaTypes'][Name] extends PrismaModelTypes
          ? Types['PrismaTypes'][Name]
          : never,
      >(
        name: Name,
        options: PrismaWhereOptions<Types, Model>,
      ) => InputRef<Model['Where']>;
    }
  }
}
