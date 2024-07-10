import SchemaBuilder from '../../../src';
import TestPlugin from './plugin';

const builder = new SchemaBuilder<{
  InferredFieldOptionsKind: 'Resolve2';
}>({
  plugins: [TestPlugin],
});

export default builder;
