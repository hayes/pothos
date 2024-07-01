import SchemaBuilder from '../../../src';
import TestPlugin from './plugin';

const builder = new SchemaBuilder<{
  InferredResolveOptionsKind: 'Resolve2';
}>({
  plugins: [TestPlugin],
});

export default builder;
