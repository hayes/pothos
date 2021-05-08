// @ts-nocheck
import { InputType, SchemaTypes } from '../types/index.ts';
import { inputTypeFromParam } from '../utils/index.ts';
import { ArgBuilder, FieldRequiredness, InputFieldRef, InputShapeFromTypeParam } from '../index.ts';
export default class InputFieldBuilder<Types extends SchemaTypes, Kind extends keyof GiraphQLSchemaTypes.InputFieldOptionsByKind> {
    builder: GiraphQLSchemaTypes.SchemaBuilder<Types>;
    kind: Kind;
    typename: string;
    boolean = this.helper("Boolean");
    float = this.helper("Float");
    id = this.helper("ID");
    int = this.helper("Int");
    string = this.helper("String");
    booleanList = this.helper(["Boolean"]);
    floatList = this.helper(["Float"]);
    idList = this.helper(["ID"]);
    intList = this.helper(["Int"]);
    stringList = this.helper(["String"]);
    constructor(builder: GiraphQLSchemaTypes.SchemaBuilder<Types>, kind: Kind, typename: string) {
        this.builder = builder;
        this.kind = kind;
        this.typename = typename;
    }
    argBuilder(): ArgBuilder<Types> {
        const builder: InputFieldBuilder<Types, "Arg">["field"] = this.field.bind(this);
        const protoKeys = Object.keys(Object.getPrototypeOf(this) as object).filter((key) => typeof (this as Record<string, unknown>)[key] === "function" &&
            ((Function.prototype as unknown) as Record<string, unknown>)[key] === undefined);
        ([...Object.keys(this), ...protoKeys] as (keyof InputFieldBuilder<Types, "Arg">)[]).forEach((key) => {
            ((builder as unknown) as Record<string, unknown>)[key] =
                typeof this[key] === "function" ? (this[key] as Function).bind(this) : this[key];
        });
        return builder as ArgBuilder<Types>;
    }
    field<Type extends InputType<Types> | [
        InputType<Types>
    ], Req extends FieldRequiredness<Type>>(options: GiraphQLSchemaTypes.InputFieldOptionsByKind<Types, Type, Req>[Kind]) {
        const ref: InputFieldRef<InputShapeFromTypeParam<Types, Type, Req>, Kind> = new InputFieldRef(this.kind, this.typename);
        this.builder.configStore.addFieldRef(ref, options.type, {}, (name, parentField) => ({
            name,
            parentField,
            kind: this.kind,
            graphqlKind: this.kind,
            parentType: this.typename,
            type: inputTypeFromParam<Types>(options.type, this.builder.configStore, options.required ?? this.builder.defaultInputFieldRequiredness),
            giraphqlOptions: (options as unknown) as GiraphQLSchemaTypes.InputFieldOptionsByKind<Types>[Kind],
            description: options.description,
            deprecationReason: options.deprecationReason,
            defaultValue: options.defaultValue,
            extensions: options.extensions,
        }));
        return ref;
    }
    private helper<Type extends InputType<Types> | [
        InputType<Types>
    ]>(type: Type) {
        return <Req extends FieldRequiredness<Type>>(options: Omit<GiraphQLSchemaTypes.InputFieldOptionsByKind<Types, Type, Req>[Kind], "type">) => this.field({
            ...options,
            type,
        } as GiraphQLSchemaTypes.InputFieldOptionsByKind<Types, Type, Req>[Kind]);
    }
}
