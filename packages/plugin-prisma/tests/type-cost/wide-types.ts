// 40 models, each with its own shape, in the form the generator writes.
type Digit = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;

export type ModelName = `Model${0 | 1 | 2 | 3}${Digit}`;

interface ModelShape<Name extends ModelName> {
  id: number;
  name: Name;
  title: string;
  createdAt: Date;
}

interface ModelTypes<Name extends ModelName> {
  Name: Name;
  Shape: ModelShape<Name>;
  Include: { parent?: boolean };
  Select: { id?: boolean; name?: boolean; title?: boolean; createdAt?: boolean; parent?: boolean };
  OrderBy: { id?: 'asc' | 'desc' };
  WhereUnique: { id?: number; name?: Name };
  Where: { id?: number; name?: Name };
  Create: {};
  Update: {};
  RelationName: 'parent';
  ListRelations: never;
  Relations: { parent: { Shape: ModelShape<Name>; Name: Name; Nullable: false } };
}

export type PrismaTypes = { [Name in ModelName]: ModelTypes<Name> };
