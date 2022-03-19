import { SchemaTypes } from '@pothos/core';
import { ScalarFilterName } from './types';
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
      prismaScalarFilter: <Name extends ScalarFilterName<Types>>(name: Name, options?: {}) => void;
    }
  }
}
