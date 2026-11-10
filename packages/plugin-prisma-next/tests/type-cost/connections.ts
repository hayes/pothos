// A connection's `collection` is checked against its own model's collections, so each field costs
// one check, not one per model.
import { builder, orm } from './relay-builder';

builder.queryFields((t) => ({
  model0: t.prismaConnection({ type: 'Model0', collection: () => orm.Model0 }),
  model1: t.prismaConnection({ type: 'Model1', collection: () => orm.Model1 }),
  model2: t.prismaConnection({ type: 'Model2', collection: () => orm.Model2 }),
  model3: t.prismaConnection({ type: 'Model3', collection: () => orm.Model3 }),
  model4: t.prismaConnection({ type: 'Model4', collection: () => orm.Model4 }),
  model5: t.prismaConnection({ type: 'Model5', collection: () => orm.Model5 }),
  model6: t.prismaConnection({ type: 'Model6', collection: () => orm.Model6 }),
  model7: t.prismaConnection({ type: 'Model7', collection: () => orm.Model7 }),
}));
