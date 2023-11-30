// @ts-nocheck
/* eslint-disable max-classes-per-file */
import { GraphQLError, GraphQLErrorOptions } from 'https://cdn.skypack.dev/graphql?dts';
export class PothosError extends GraphQLError {
    constructor(message: string, options?: GraphQLErrorOptions) {
        super(message, options);
        this.name = "PothosError";
    }
}
export class PothosSchemaError extends PothosError {
    constructor(message: string, options?: GraphQLErrorOptions) {
        super(message, options);
        this.name = "PothosSchemaError";
    }
}
export class PothosValidationError extends PothosError {
    constructor(message: string, options?: GraphQLErrorOptions) {
        super(message, options);
        this.name = "PothosValidationError";
    }
}
