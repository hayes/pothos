import { execute } from 'graphql';
import { gql } from 'graphql-tag';
import { clearDrizzleLogs, drizzleLogs } from './example/db';
import { schema } from './example/schema';

describe('drizzle - fragment alias with different fields', () => {
  afterEach(() => {
    clearDrizzleLogs();
  });

  it('should merge fields when fragments share alias but request different fields', async () => {
    const query = gql`
      query {
        post(id: "1") {
          id
          ...FragmentA
          ...FragmentB
        }
      }

      fragment FragmentA on Post {
        title
      }

      fragment FragmentB on Post {
        content
      }
    `;

    const result = await execute({
      schema,
      document: query,
      contextValue: { user: { id: 1 } },
    });

    expect(drizzleLogs).toMatchInlineSnapshot(`
      [
        "Query: select "d0"."id" as "postId", "d0"."title" as "title", "d0"."content" as "content" from "posts" as "d0" where "d0"."id" = ? limit ? -- params: [1, 1]",
      ]
    `);

    expect(result).toMatchInlineSnapshot(`
      {
        "data": {
          "post": {
            "content": "Corpus video labore aegre unde curis sol utrum substantia degusto. Verbum conservo acceptus approbo. Tabula claro vinum blanditiis tabesco debeo ante.
      Suadeo ceno damnatio uredo aliquam caelestis xiphias tabernus surculus collum. Adopto uterque vae comparo est sopor virga. Summa anser bene hic sono ratione.
      Demergo uterque antea tenus aestivus spero sono calamitas. Adimpleo vesper canonicus cresco colo vigilo dens totus custodia. Cogo cultura solitudo concido calculus aegrus.",
            "id": "1",
            "title": "Thalassinus ustilo hic civitas.",
          },
        },
      }
    `);
  });
});
