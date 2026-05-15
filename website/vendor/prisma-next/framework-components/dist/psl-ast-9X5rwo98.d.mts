//#region src/control/psl-ast.d.ts
interface PslPosition {
  readonly offset: number;
  readonly line: number;
  readonly column: number;
}
interface PslSpan {
  readonly start: PslPosition;
  readonly end: PslPosition;
}
type PslDiagnosticCode = 'PSL_UNTERMINATED_BLOCK' | 'PSL_UNSUPPORTED_TOP_LEVEL_BLOCK' | 'PSL_INVALID_ATTRIBUTE_SYNTAX' | 'PSL_INVALID_MODEL_MEMBER' | 'PSL_UNSUPPORTED_MODEL_ATTRIBUTE' | 'PSL_UNSUPPORTED_FIELD_ATTRIBUTE' | 'PSL_INVALID_RELATION_ATTRIBUTE' | 'PSL_INVALID_REFERENTIAL_ACTION' | 'PSL_INVALID_DEFAULT_VALUE' | 'PSL_INVALID_ENUM_MEMBER' | 'PSL_INVALID_TYPES_MEMBER';
interface PslDiagnostic {
  readonly code: PslDiagnosticCode;
  readonly message: string;
  readonly sourceId: string;
  readonly span: PslSpan;
}
interface PslDefaultFunctionValue {
  readonly kind: 'function';
  readonly name: 'autoincrement' | 'now';
}
interface PslDefaultLiteralValue {
  readonly kind: 'literal';
  readonly value: string | number | boolean;
}
type PslDefaultValue = PslDefaultFunctionValue | PslDefaultLiteralValue;
type PslAttributeTarget = 'field' | 'model' | 'enum' | 'namedType';
interface PslAttributePositionalArgument {
  readonly kind: 'positional';
  readonly value: string;
  readonly span: PslSpan;
}
interface PslAttributeNamedArgument {
  readonly kind: 'named';
  readonly name: string;
  readonly value: string;
  readonly span: PslSpan;
}
type PslAttributeArgument = PslAttributePositionalArgument | PslAttributeNamedArgument;
interface PslTypeConstructorCall {
  readonly kind: 'typeConstructor';
  readonly path: readonly string[];
  readonly args: readonly PslAttributeArgument[];
  readonly span: PslSpan;
}
interface PslAttribute {
  readonly kind: 'attribute';
  readonly target: PslAttributeTarget;
  readonly name: string;
  readonly args: readonly PslAttributeArgument[];
  readonly span: PslSpan;
}
type PslReferentialAction = string;
type PslFieldAttribute = PslAttribute;
interface PslField {
  readonly kind: 'field';
  readonly name: string;
  readonly typeName: string;
  readonly typeConstructor?: PslTypeConstructorCall;
  readonly optional: boolean;
  readonly list: boolean;
  readonly typeRef?: string;
  readonly attributes: readonly PslFieldAttribute[];
  readonly span: PslSpan;
}
interface PslUniqueConstraint {
  readonly kind: 'unique';
  readonly fields: readonly string[];
  readonly span: PslSpan;
}
interface PslIndexConstraint {
  readonly kind: 'index';
  readonly fields: readonly string[];
  readonly span: PslSpan;
}
type PslModelAttribute = PslAttribute;
interface PslModel {
  readonly kind: 'model';
  readonly name: string;
  readonly fields: readonly PslField[];
  readonly attributes: readonly PslModelAttribute[];
  readonly span: PslSpan;
  /**
   * Optional leading comment line emitted above the `model` keyword by the
   * printer. Producers (e.g. `sqlSchemaIrToPslAst`) attach introspection
   * advisories such as "// WARNING: This table has no primary key in the
   * database" here. The parser leaves this field unset; round-tripping a
   * parsed schema does not re-attach comments.
   */
  readonly comment?: string;
}
interface PslEnumValue {
  readonly kind: 'enumValue';
  readonly name: string;
  /**
   * Optional storage label for the enum member, captured from a trailing
   * `@map("...")` attribute on the member line. The parser populates this
   * when the source PSL carries an explicit `@map`. Producers (e.g.
   * `sqlSchemaIrToPslAst`) leave it unset; the printer emits `@map(...)`
   * automatically when normalisation would change the printed member name
   * (so an enum value `'in-progress'` becomes `inProgress @map("in-progress")`
   * in PSL, preserving the round-trip).
   */
  readonly mapName?: string;
  readonly span: PslSpan;
}
interface PslEnum {
  readonly kind: 'enum';
  readonly name: string;
  readonly values: readonly PslEnumValue[];
  readonly attributes: readonly PslAttribute[];
  readonly span: PslSpan;
}
interface PslCompositeType {
  readonly kind: 'compositeType';
  readonly name: string;
  readonly fields: readonly PslField[];
  readonly attributes: readonly PslAttribute[];
  readonly span: PslSpan;
}
interface PslNamedTypeDeclaration {
  readonly kind: 'namedType';
  readonly name: string;
  /**
   * Parser invariant: exactly one of `baseType` and `typeConstructor` is set.
   * Expressing this as a discriminated union trips TypeScript narrowing when
   * the declaration flows through helpers that accept the full union.
   */
  readonly baseType?: string;
  readonly typeConstructor?: PslTypeConstructorCall;
  readonly attributes: readonly PslAttribute[];
  readonly span: PslSpan;
}
interface PslTypesBlock {
  readonly kind: 'types';
  readonly declarations: readonly PslNamedTypeDeclaration[];
  readonly span: PslSpan;
}
interface PslDocumentAst {
  readonly kind: 'document';
  readonly sourceId: string;
  readonly models: readonly PslModel[];
  readonly enums: readonly PslEnum[];
  readonly compositeTypes: readonly PslCompositeType[];
  readonly types?: PslTypesBlock;
  readonly span: PslSpan;
}
interface ParsePslDocumentInput {
  readonly schema: string;
  readonly sourceId: string;
}
interface ParsePslDocumentResult {
  readonly ast: PslDocumentAst;
  readonly diagnostics: readonly PslDiagnostic[];
  readonly ok: boolean;
}
//#endregion
export { PslPosition as C, PslTypesBlock as D, PslTypeConstructorCall as E, PslUniqueConstraint as O, PslNamedTypeDeclaration as S, PslSpan as T, PslField as _, PslAttributeNamedArgument as a, PslModel as b, PslCompositeType as c, PslDefaultValue as d, PslDiagnostic as f, PslEnumValue as g, PslEnum as h, PslAttributeArgument as i, PslDefaultFunctionValue as l, PslDocumentAst as m, ParsePslDocumentResult as n, PslAttributePositionalArgument as o, PslDiagnosticCode as p, PslAttribute as r, PslAttributeTarget as s, ParsePslDocumentInput as t, PslDefaultLiteralValue as u, PslFieldAttribute as v, PslReferentialAction as w, PslModelAttribute as x, PslIndexConstraint as y };
//# sourceMappingURL=psl-ast-9X5rwo98.d.mts.map