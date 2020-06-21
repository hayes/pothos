export class ResolveValueWrapper {
  parent: ResolveValueWrapper | null;

  value: unknown;

  data: Record<string, object | null> = {};

  constructor(value: unknown, parent: ResolveValueWrapper | null = null) {
    this.value = value;
    this.parent = parent;
  }

  unwrap() {
    return this.value;
  }

  static wrap(value: unknown, parent: ResolveValueWrapper | null = null) {
    if (value instanceof ResolveValueWrapper) {
      return value;
    }

    return new ResolveValueWrapper(value, parent);
  }

  child(value: unknown) {
    return new ResolveValueWrapper(value, this);
  }
}
