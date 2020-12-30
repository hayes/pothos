export default class BaseTypeRef {
  kind;

  name;

  constructor(
    kind: 'Object' | 'Interface' | 'Union' | 'Enum' | 'Scalar' | 'InputObject',
    name: string,
  ) {
    this.kind = kind;
    this.name = name;
  }

  toString() {
    return `${this.kind}Ref<${this.name}>`;
  }
}
