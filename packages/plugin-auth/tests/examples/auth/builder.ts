import SchemaBuilder from '@giraphql/core';
import '../../../src';
import { ContextType } from './backing-models';
import { User } from './data';

interface Types {
  Objects: {
    User: User;
    Circle: { type: 'circle'; radius: number };
    Square: { type: 'square'; edgeLength: number };
    Triangle: { type: 'triangle'; edgeLength: number };
    Rectangle: { type: 'rectangle'; width: number; height: number };
    Oval: { type: 'oval'; width: number; height: number };
    Line: { type: 'line'; length: number };
    LinePreResolveFail: { type: 'line-pre-resolve-fail'; length: number };
    LinePostResolveFail: { type: 'line-post-resolve-fail'; length: number };
    Point: { type: 'point' };
  };
  Interfaces: {
    Shape: { type: string };
    Thing: { type: string };
    ThingWithCorners: { type: string };
    BrokenThing: { type: string };
    OvalThing: {};
    PreResolvePass: { type: string };
    PreResolveFail: { type: string };
    PostResolvePass: { type: string };
    PostResolveFail: { type: string };
    SkipImplementorPreResolve: { type: string };
  };
  Scalars: {
    ID: { Input: string; Output: string | number };
  };
  Context: ContextType;
}

export default new SchemaBuilder<Types>({
  plugins: ['GiraphQLAuth'],
  authOptions: {
    skipPreResolveOnUnions: false,
    skipPreResolveOnInterfaces: false,
  },
});
