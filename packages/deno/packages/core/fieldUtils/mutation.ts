// @ts-nocheck
import { SchemaTypes } from '../types/index.ts';
import { RootFieldBuilder } from './root.ts';
export class MutationFieldBuilder<Types extends SchemaTypes, ParentShape> extends RootFieldBuilder<Types, ParentShape, "Mutation"> {
    constructor(builder: PothosSchemaTypes.SchemaBuilder<Types>) {
        super(builder, "Mutation", "Object");
    }
}
