export interface FieldMigration {
  name: string;
}

export interface InputFieldMigration {
  name: string;
}

export interface ScalarMigration {
  kind: 'Scalar';
  name: string;
}

export interface ObjectMigration {
  kind: 'Object';
  name: string;
  fields: FieldMigration[];
}

export interface EnumMigration {
  kind: 'Enum';
  name: string;
}

export interface InterfaceMigration {
  kind: 'Interface';
  name: string;
  fields: FieldMigration[];
}

export interface UnionMigration {
  kind: 'Union';
  name: string;
}

export interface InputObjectMigration {
  kind: 'InputObject';
  name: string;
  fields: InputFieldMigration[];
}

export type TypeMigration =
  | ScalarMigration
  | ObjectMigration
  | EnumMigration
  | InterfaceMigration
  | UnionMigration
  | InputObjectMigration;

export interface MigrationManifest {
  schema: string | null;
  resolvers: string | null;
  types: TypeMigration[];
}
