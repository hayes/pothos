import { TypeMap, TypeParam, FieldOptions, InputFields, CompatibleTypes } from '../types';
import Field from '../field';
import BaseFieldUtil from './base';
import FieldModifier from './modifier';

export default class FieldBuilder<
  Types extends TypeMap,
  ParentType extends TypeParam<Types>,
  Context,
  ParentShape extends {
    [s: string]: Field<
      {},
      Types,
      TypeParam<Types>,
      TypeParam<Types>,
      boolean,
      Context,
      string | null,
      any
    >;
  }
> extends BaseFieldUtil<Types, ParentType, Context> {
  parentFields: ParentShape;

  modifiers: {
    [K in keyof ParentShape]: FieldModifier<
      Types,
      ParentType,
      ParentShape[K]['type'],
      ParentShape[K]['required'],
      ParentShape[K]['args'],
      Extract<K, string>,
      Context
    >;
  };

  constructor(parentFields: ParentShape) {
    super();

    this.parentFields = parentFields;

    const modifiers: Partial<
      {
        [K in keyof ParentShape]: FieldModifier<
          Types,
          ParentType,
          ParentShape[K]['type'],
          ParentShape[K]['required'],
          ParentShape[K]['args'],
          Extract<K, string>,
          Context
        >;
      }
    > = {};

    (Object.keys(parentFields) as (Extract<keyof ParentShape, string>)[]).forEach(name => {
      modifiers[name] = new FieldModifier(parentFields[name], name);
    });

    this.modifiers = modifiers as {
      [K in keyof typeof modifiers]-?: Exclude<(typeof modifiers)[K], undefined>;
    };
  }

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

  field<Args extends InputFields, Type extends TypeParam<Types>, Req extends boolean>(
    options: FieldOptions<Types, ParentType, Type, Req, Args, Context>,
  ): Field<Args, Types, ParentType, Type, Req, Context, null> {
    return this.createField(options, null);
  }

  expose<
    Type extends TypeParam<Types>,
    Req extends boolean,
    Name extends CompatibleTypes<Types, ParentType, Type, Req>
  >(
    name: Name,
    options: Omit<FieldOptions<Types, ParentType, Type, Req, {}, Context>, 'resolver'>,
  ): Field<{}, Types, ParentType, Type, Req, Context, null> {
    return this.exposeField(name, options, null);
  }

  extend<Name extends keyof ParentShape>(name: Name) {
    return this.modifiers[name];
  }
}
