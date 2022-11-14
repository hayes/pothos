export default class BaseTypeRef implements PothosSchemaTypes.BaseTypeRef {
  kind;

  name;

  constructor(
    kind:
      | 'Enum'
      | 'InputObject'
      | 'Interface'
      | 'Object'
      | 'Scalar'
      | 'Union'
      | 'List'
      | 'InputList',
    name: string,
  ) {
    this.kind = kind;
    this.name = name;
  }

  toString() {
    return `${this.kind}Ref<${this.name}>`;
  }
}
