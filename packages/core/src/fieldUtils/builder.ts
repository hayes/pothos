import { TypeParam, InputFields, CompatibleTypes, NamedTypeParam } from '../types';
import Field from '../field';
import BaseFieldUtil from './base';
import FieldModifier from './modifier';
import InputFieldBuilder from './input';

export default class FieldBuilder<
  Types extends GiraphSchemaTypes.TypeInfo,
  ParentType extends TypeParam<Types>,
  ParentShape extends {
    [s: string]: Field<{}, Types, TypeParam<Types>, TypeParam<Types>, boolean, string | null, any>;
  }
> extends BaseFieldUtil<Types, ParentType> {
  parentFields: ParentShape;

  modifiers: {
    [K in keyof ParentShape]: FieldModifier<
      Types,
      ParentType,
      ParentShape[K]['type'],
      ParentShape[K]['nullable'],
      ParentShape[K]['args'],
      Extract<K, string>
    >;
  };

  constructor(parentFields: ParentShape, typename: NamedTypeParam<Types>) {
    super(typename);

    this.parentFields = parentFields;

    const modifiers: Partial<
      {
        [K in keyof ParentShape]: FieldModifier<
          Types,
          ParentType,
          ParentShape[K]['type'],
          ParentShape[K]['nullable'],
          ParentShape[K]['args'],
          Extract<K, string>
        >;
      }
    > = {};

    (Object.keys(parentFields) as (Extract<keyof ParentShape, string>)[]).forEach(name => {
      modifiers[name] = new FieldModifier(parentFields[name], name, this.typename) as any;
    });

    this.modifiers = modifiers as {
      [K in keyof typeof modifiers]-?: Exclude<(typeof modifiers)[K], undefined>;
    };
  }

  arg = new InputFieldBuilder<Types>().callableBuilder();

  boolean = this.fieldTypeHelper('Boolean');

  float = this.fieldTypeHelper('Float');

  id = this.fieldTypeHelper('ID');

  int = this.fieldTypeHelper('Int');

  string = this.fieldTypeHelper('String');

  booleanList = this.fieldTypeHelper(['Boolean']);

  floatList = this.fieldTypeHelper(['Float']);

  idList = this.fieldTypeHelper(['ID']);

  intList = this.fieldTypeHelper(['Int']);

  stringList = this.fieldTypeHelper(['String']);

  exposBoolean = this.exposeHelper('Boolean');

  exposeFloat = this.exposeHelper('Float');

  exposeID = this.exposeHelper('ID');

  exposeInt = this.exposeHelper('Int');

  exposeString = this.exposeHelper('String');

  exposeBooleanList = this.exposeHelper(['Boolean']);

  exposeFloatList = this.exposeHelper(['Float']);

  exposeIDList = this.exposeHelper(['ID']);

  exposeIntList = this.exposeHelper(['Int']);

  exposeStringList = this.exposeHelper(['String']);

  field<Args extends InputFields<Types>, Type extends TypeParam<Types>, Req extends boolean>(
    options: GiraphSchemaTypes.FieldOptions<Types, ParentType, Type, Req, Args>,
  ): Field<Args, Types, ParentType, Type, Req, null> {
    return this.createField(options, null);
  }

  expose<
    Type extends TypeParam<Types>,
    Req extends boolean,
    Name extends CompatibleTypes<Types, ParentType, Type, Req>
  >(
    name: Name,
    options: Omit<GiraphSchemaTypes.FieldOptions<Types, ParentType, Type, Req, {}>, 'resolve'>,
  ): Field<{}, Types, ParentType, Type, Req, null> {
    return this.exposeField(name, options, null);
  }

  extend<Name extends keyof ParentShape>(name: Name) {
    return this.modifiers[name];
  }
}
