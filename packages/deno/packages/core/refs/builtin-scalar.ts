// @ts-nocheck
import { GraphQLScalarType } from 'https://cdn.skypack.dev/graphql?dts';
import ScalarRef from './scalar.ts';
export default class BuiltinScalarRef<T, U> extends ScalarRef<T, U> {
    type;
    constructor(type: GraphQLScalarType) {
        super(type.name);
        this.type = type;
    }
}
