import SchemaBuilder from '@giraphql/core';
import { ContextType } from './backing-models';
import { User } from './data';
import AuthPlugin from '../../../src';

type Types = {
  Object: {
    User: User;
    Circle: { type: 'circle'; radius: number };
    Square: { type: 'square'; edgeLength: number };
    Triangle: { type: 'triangle'; edgeLength: number };
  };
  Interface: {
    Shape: { type: string };
  };
  Scalar: {
    ID: { Input: string; Output: string | number };
  };
  Context: ContextType;
};

export default new SchemaBuilder<Types>({
  plugins: [new AuthPlugin()],
});
