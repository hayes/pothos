// @ts-nocheck
import { FieldRequiredness, InputFieldBuilder, InputFieldRef, InputShapeFromTypeParam, } from '../core/index.ts';
import { GlobalIDInputFieldOptions, GlobalIDInputShape, GlobalIDListInputFieldOptions, } from './types.ts';
type DefaultSchemaTypes = GiraphQLSchemaTypes.ExtendDefaultTypes<{}>;
const inputFieldBuilder = InputFieldBuilder.prototype as GiraphQLSchemaTypes.InputFieldBuilder<DefaultSchemaTypes, "Arg" | "InputObject">;
inputFieldBuilder.globalIDList = function globalIDList<Req extends FieldRequiredness<[
    "ID"
]>>(options: GlobalIDListInputFieldOptions<DefaultSchemaTypes, Req, "Arg" | "InputObject"> = {} as never): InputFieldRef<InputShapeFromTypeParam<DefaultSchemaTypes, [
    GlobalIDInputShape
], Req>> {
    return this.idList({
        ...options,
        extensions: {
            ...options.extensions,
            isRelayGlobalID: true,
        },
    }) as InputFieldRef<InputShapeFromTypeParam<DefaultSchemaTypes, [
        GlobalIDInputShape
    ], Req>>;
};
inputFieldBuilder.globalID = function globalID<Req extends boolean>(options: GlobalIDInputFieldOptions<DefaultSchemaTypes, Req, "Arg" | "InputObject"> = {} as never) {
    return this.id({
        ...options,
        extensions: {
            ...options.extensions,
            isRelayGlobalID: true,
        },
    }) as unknown as InputFieldRef<InputShapeFromTypeParam<DefaultSchemaTypes, GlobalIDInputShape, Req>>;
};
inputFieldBuilder.connectionArgs = function connectionArgs() {
    const { 
    // TODO(breaking) make this default match other cursor fields
    cursorType = "ID", beforeArgOptions = {} as never, afterArgOptions = {} as never, firstArgOptions = {} as never, lastArgOptions = {} as never, } = this.builder.options.relayOptions;
    return {
        before: this.field({ ...beforeArgOptions, type: cursorType, required: false }) as InputFieldRef<string | null>,
        after: this.field({ ...afterArgOptions, type: cursorType, required: false }) as InputFieldRef<string | null>,
        first: this.int({ ...firstArgOptions, required: false }),
        last: this.int({ ...lastArgOptions, required: false }),
    };
};
