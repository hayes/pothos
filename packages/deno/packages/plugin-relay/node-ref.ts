// @ts-nocheck
import { ObjectRef } from '../core/index.ts';
export const relayIDShapeKey = Symbol.for("Pothos.relayIDShapeKey");
export class NodeRef<T, P = T, K = string> extends ObjectRef<T, P> {
    [relayIDShapeKey]!: K;
}
