// @ts-nocheck
import { GraphQLScalarType } from 'https://cdn.skypack.dev/graphql?dts';
import { SchemaTypes } from '../types/index.ts';
import { ScalarRef } from './scalar.ts';
export class BuiltinScalarRef<Types extends SchemaTypes, T, U> extends ScalarRef<Types, T, U> {
    type;
    constructor(type: GraphQLScalarType) {
        super(type.name);
        this.type = type;
    }
}
