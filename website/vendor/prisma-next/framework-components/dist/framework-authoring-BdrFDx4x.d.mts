//#region src/shared/framework-authoring.d.ts
type AuthoringArgRef = {
  readonly kind: 'arg';
  readonly index: number;
  readonly path?: readonly string[];
  readonly default?: AuthoringTemplateValue;
};
type AuthoringTemplateValue = string | number | boolean | null | AuthoringArgRef | readonly AuthoringTemplateValue[] | {
  readonly [key: string]: AuthoringTemplateValue;
};
interface AuthoringArgumentDescriptorCommon {
  readonly name?: string;
  readonly optional?: boolean;
}
type AuthoringArgumentDescriptor = AuthoringArgumentDescriptorCommon & ({
  readonly kind: 'string';
} | {
  readonly kind: 'number';
  readonly integer?: boolean;
  readonly minimum?: number;
  readonly maximum?: number;
} | {
  readonly kind: 'stringArray';
} | {
  readonly kind: 'object';
  readonly properties: Record<string, AuthoringArgumentDescriptor>;
});
interface AuthoringStorageTypeTemplate {
  readonly codecId: string;
  readonly nativeType: AuthoringTemplateValue;
  readonly typeParams?: Record<string, AuthoringTemplateValue>;
}
interface AuthoringTypeConstructorDescriptor {
  readonly kind: 'typeConstructor';
  readonly args?: readonly AuthoringArgumentDescriptor[];
  readonly output: AuthoringStorageTypeTemplate;
}
interface AuthoringColumnDefaultTemplateLiteral {
  readonly kind: 'literal';
  readonly value: AuthoringTemplateValue;
}
interface AuthoringColumnDefaultTemplateFunction {
  readonly kind: 'function';
  readonly expression: AuthoringTemplateValue;
}
type AuthoringColumnDefaultTemplate = AuthoringColumnDefaultTemplateLiteral | AuthoringColumnDefaultTemplateFunction;
interface AuthoringFieldPresetOutput extends AuthoringStorageTypeTemplate {
  readonly nullable?: boolean;
  readonly default?: AuthoringColumnDefaultTemplate;
  readonly executionDefault?: AuthoringTemplateValue;
  readonly id?: boolean;
  readonly unique?: boolean;
}
interface AuthoringFieldPresetDescriptor {
  readonly kind: 'fieldPreset';
  readonly args?: readonly AuthoringArgumentDescriptor[];
  readonly output: AuthoringFieldPresetOutput;
}
type AuthoringTypeNamespace = {
  readonly [name: string]: AuthoringTypeConstructorDescriptor | AuthoringTypeNamespace;
};
type AuthoringFieldNamespace = {
  readonly [name: string]: AuthoringFieldPresetDescriptor | AuthoringFieldNamespace;
};
interface AuthoringContributions {
  readonly type?: AuthoringTypeNamespace;
  readonly field?: AuthoringFieldNamespace;
}
declare function isAuthoringArgRef(value: unknown): value is AuthoringArgRef;
declare function isAuthoringTypeConstructorDescriptor(value: unknown): value is AuthoringTypeConstructorDescriptor;
declare function isAuthoringFieldPresetDescriptor(value: unknown): value is AuthoringFieldPresetDescriptor;
declare function resolveAuthoringTemplateValue(template: AuthoringTemplateValue, args: readonly unknown[]): unknown;
declare function validateAuthoringHelperArguments(helperPath: string, descriptors: readonly AuthoringArgumentDescriptor[] | undefined, args: readonly unknown[]): void;
declare function instantiateAuthoringTypeConstructor(descriptor: AuthoringTypeConstructorDescriptor, args: readonly unknown[]): {
  readonly codecId: string;
  readonly nativeType: string;
  readonly typeParams?: Record<string, unknown>;
};
declare function instantiateAuthoringFieldPreset(descriptor: AuthoringFieldPresetDescriptor, args: readonly unknown[]): {
  readonly descriptor: {
    readonly codecId: string;
    readonly nativeType: string;
    readonly typeParams?: Record<string, unknown>;
  };
  readonly nullable: boolean;
  readonly default?: {
    readonly kind: 'literal';
    readonly value: unknown;
  } | {
    readonly kind: 'function';
    readonly expression: string;
  };
  readonly executionDefault?: unknown;
  readonly id: boolean;
  readonly unique: boolean;
};
//#endregion
export { resolveAuthoringTemplateValue as _, AuthoringFieldNamespace as a, AuthoringStorageTypeTemplate as c, AuthoringTypeNamespace as d, instantiateAuthoringFieldPreset as f, isAuthoringTypeConstructorDescriptor as g, isAuthoringFieldPresetDescriptor as h, AuthoringContributions as i, AuthoringTemplateValue as l, isAuthoringArgRef as m, AuthoringArgumentDescriptor as n, AuthoringFieldPresetDescriptor as o, instantiateAuthoringTypeConstructor as p, AuthoringColumnDefaultTemplate as r, AuthoringFieldPresetOutput as s, AuthoringArgRef as t, AuthoringTypeConstructorDescriptor as u, validateAuthoringHelperArguments as v };
//# sourceMappingURL=framework-authoring-BdrFDx4x.d.mts.map