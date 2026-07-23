// Type-level assertions for the FieldSet escape hatch (checked by `pnpm type`).
import SchemaBuilder from '@pothos/core';
import DirectivesPlugin from '@pothos/plugin-directives';
import FederationPlugin, { type FieldSet, type Selection } from '../src';

const builder = new SchemaBuilder({
  plugins: [DirectivesPlugin, FederationPlugin],
});

type Media = { __typename: 'Image'; url: string } | { __typename: 'Video'; url: string };

// checked selection strings work exactly as before
export const checked = builder.selection<{ upc: string; price?: number }>('upc price');

// @ts-expect-error incomplete selections are still rejected
export const missingField = builder.selection<{ upc: string; price?: number }>('upc');

// a FieldSet cast allows selections SelectionFromShape can not express
export const withFragments = builder.selection<{ media: Media[] }>(
  'media { ... on Image { url } ... on Video { url } }' as FieldSet<{ media: Media[] }>,
);

// the shape is carried by the brand, so the generic can be inferred from the cast
export const inferred: Selection<{ media: Media[] }> = builder.selection(
  'media { ... on Image { url } ... on Video { url } }' as FieldSet<{ media: Media[] }>,
);

declare const plainString: string;

// @ts-expect-error un-branded plain strings are still rejected
export const unchecked = builder.selection<{ upc: string }>(plainString);

// @ts-expect-error a FieldSet branded with a different shape does not satisfy the selection
export const wrongShape = builder.selection<{ upc: string }>('upc' as FieldSet<{ id: string }>);
