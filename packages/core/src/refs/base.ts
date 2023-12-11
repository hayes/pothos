export default class BaseTypeRef implements PothosSchemaTypes.BaseTypeRef {
  kind;

  name;

  constructor(
    kind:
      | 'Enum'
      | 'InputList'
      | 'InputObject'
      | 'Interface'
      | 'List'
      | 'Object'
      | 'Scalar'
      | 'Union',
    name: string,
  ) {
    this.kind = kind;
    this.name = name;
  }

  toString() {
    return `${this.kind}Ref<${this.name}>`;
  }
}
