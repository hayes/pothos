export default abstract class BaseTypeRef {
  abstract kind: 'Object' | 'Interface' | 'Union' | 'Enum' | 'Scalar' | 'InputObject';

  abstract name: string;

  toString() {
    return `${this.kind}Ref<${this.name}>`;
  }
}
