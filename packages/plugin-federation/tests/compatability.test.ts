import { printSchema } from 'graphql';
import { printSubgraphSchema } from '@apollo/subgraph';
import { schema } from './example/compatibility/products/schema';

describe('federation', () => {
  describe('compatibility', () => {
    it('generates expected schema', () => {
      expect(printSubgraphSchema(schema)).toMatchSnapshot();
      expect(printSchema(schema)).toMatchSnapshot();
    });
  });
});
