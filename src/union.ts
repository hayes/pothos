import { TypeMap } from './types';
import BaseType from './base';

export default class UnionType<
  Types extends TypeMap,
  Context,
  Member extends keyof Types
> extends BaseType<Types[Member]> {
  constructor(
    name: string,
    options: {
      members: Member[];
      resolveType: (parent: Types[Member], context: Context) => Member | Promise<Member>;
    },
  ) {
    super(name);
  }
}
