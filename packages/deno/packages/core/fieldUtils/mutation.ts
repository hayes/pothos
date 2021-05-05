// @ts-nocheck
import { SchemaTypes } from '../types/index.ts';
import RootFieldBuilder from './root.ts';
export default class MutationFieldBuilder<Types extends SchemaTypes, ParentShape> extends RootFieldBuilder<Types, ParentShape, "Mutation"> {
    constructor(builder: GiraphQLSchemaTypes.SchemaBuilder<Types>) {
        super("Mutation", builder, "Mutation", "Object");
    }
}
