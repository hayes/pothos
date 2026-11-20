import SchemaBuilder from '@pothos/core';
import { execute } from 'graphql';
import { gql } from 'graphql-tag';
import * as zod from 'zod';
import '../src';

// Input types are mapped once per schema build and shared between fields (#1854). Each field must
// still validate every input type it can reach, however it reaches it.

interface TreeShape {
  name: string;
  children?: TreeShape[] | null;
}

function buildSchema() {
  const builder = new SchemaBuilder({ plugins: ['validation'] });

  const Tree = builder.inputRef<TreeShape>('Tree');

  Tree.implement({
    fields: (t) => ({
      name: t.string({ required: true, validate: zod.string().min(2) }),
      children: t.field({ type: [Tree] }),
    }),
  });

  const Forest = builder.inputType('Forest', {
    fields: (t) => ({
      trees: t.field({ type: [Tree], required: true }),
      label: t.string(),
    }),
  });

  // Mapped field with no nested mappings, reached by several fields
  const Note = builder
    .inputType('Note', { fields: (t) => ({ text: t.string() }) })
    .validate(zod.object({ text: zod.string().max(5).nullish() }));

  const Holder = builder.inputType('Holder', {
    fields: (t) => ({ note: t.field({ type: Note }), extra: t.field({ type: Note }) }),
  });

  // Not validated at all, must not break fields that also reach validated types
  const Plain = builder.inputType('Plain', { fields: (t) => ({ value: t.string() }) });

  builder.queryType({
    fields: (t) => ({
      tree: t.string({
        args: { tree: t.arg({ type: Tree, required: true }), plain: t.arg({ type: Plain }) },
        resolve: (_, args) => args.tree.name,
      }),
      forest: t.string({
        args: { forest: t.arg({ type: Forest, required: true }) },
        resolve: (_, args) => args.forest.trees.map((tree) => tree.name).join(','),
      }),
      forests: t.string({
        args: { forests: t.arg({ type: [Forest], required: true }) },
        resolve: (_, args) => String(args.forests.length),
      }),
      note: t.string({
        args: { note: t.arg({ type: Note }) },
        resolve: (_, args) => args.note?.text ?? '',
      }),
      holder: t.string({
        args: { holder: t.arg({ type: Holder }) },
        resolve: (_, args) => args.holder?.note?.text ?? '',
      }),
      plain: t.string({
        args: { plain: t.arg({ type: Plain }) },
        resolve: (_, args) => args.plain?.value ?? '',
      }),
    }),
  });

  return builder.toSchema();
}

const schema = buildSchema();

async function run(source: string) {
  const result = await execute({ schema, document: gql(source) });

  return {
    data: result.data,
    errors: result.errors?.map((error) => error.message),
  };
}

describe('input types shared between fields', () => {
  it('validates a recursive type used directly as an argument', async () => {
    expect(await run('{ tree(tree: { name: "ok", children: [{ name: "fine" }] }) }')).toEqual({
      data: { tree: 'ok' },
      errors: undefined,
    });

    const result = await run('{ tree(tree: { name: "ok", children: [{ name: "x" }] }) }');

    expect(result.data).toEqual({ tree: null });
    expect(result.errors?.[0]).toContain('tree.children.0.name');
  });

  it('validates the same recursive type inside a list of another input', async () => {
    expect(
      await run('{ forest(forest: { trees: [{ name: "oak", children: [{ name: "elm" }] }] }) }'),
    ).toEqual({ data: { forest: 'oak' }, errors: undefined });

    const result = await run(
      '{ forest(forest: { trees: [{ name: "oak", children: [{ name: "e" }] }] }) }',
    );

    expect(result.data).toEqual({ forest: null });
    expect(result.errors?.[0]).toContain('forest.trees.0.children.0.name');
  });

  it('validates the same types inside a list argument', async () => {
    const result = await run('{ forests(forests: [{ trees: [] }, { trees: [{ name: "y" }] }]) }');

    expect(result.data).toEqual({ forests: null });
    expect(result.errors?.[0]).toContain('forests.1.trees.0.name');
  });

  it('validates a type with no validated fields wherever it is reached', async () => {
    expect(await run('{ note(note: { text: "short" }) }')).toEqual({
      data: { note: 'short' },
      errors: undefined,
    });
    expect((await run('{ note(note: { text: "too long" }) }')).data).toEqual({ note: null });
    expect((await run('{ holder(holder: { note: { text: "too long" } }) }')).data).toEqual({
      holder: null,
    });
    expect((await run('{ holder(holder: { extra: { text: "too long" } }) }')).data).toEqual({
      holder: null,
    });
    expect(await run('{ holder(holder: { note: { text: "ok" } }) }')).toEqual({
      data: { holder: 'ok' },
      errors: undefined,
    });
  });

  it('leaves fields that only reach unvalidated types alone', async () => {
    expect(await run('{ plain(plain: { value: "anything at all" }) }')).toEqual({
      data: { plain: 'anything at all' },
      errors: undefined,
    });
  });
});
