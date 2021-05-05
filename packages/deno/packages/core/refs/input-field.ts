// @ts-nocheck
import { inputFieldShapeKey } from '../types/index.ts';
import { FieldRef } from '../index.ts';
export default class InputFieldRef<T = unknown, Kind extends "Arg" | "InputObject" = "Arg" | "InputObject"> {
    kind: "Arg" | "InputObject";
    parentTypename: string;
    fieldName?: string;
    argFor?: FieldRef | InputFieldRef;
    [inputFieldShapeKey]: T;
    constructor(kind: Kind, parentTypename: string) {
        this.kind = kind;
        this.parentTypename = parentTypename;
    }
    toString() {
        if (this.kind !== "Arg") {
            if (this.fieldName) {
                return `${this.parentTypename}.${this.fieldName}`;
            }
            return this.parentTypename;
        }
        const fieldName = this.argFor?.fieldName ?? "[unnamed filed]";
        const argName = this.fieldName ?? "[unnamed argument]";
        return `${this.parentTypename}.${fieldName}(${argName})`;
    }
}
