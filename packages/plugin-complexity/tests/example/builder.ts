import SchemaBuilder from '@giraphql/core';
import ComplexityPlugin from '../../src';
import { ContextType } from './types';

export default new SchemaBuilder<{
  Context: ContextType;
}>({
  plugins: [ComplexityPlugin],
  complexity: {
    limit: (ctx) => ctx.complexity,
    defaultListMultiplier: 5,
    defaultComplexity: 1,
  },
});
