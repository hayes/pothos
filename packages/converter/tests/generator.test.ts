import { GeneratorSchema } from '../src/generator/schema';
import starwarsSchema from './examples/starwars/schema';

describe('Code generator', () => {
  it('starwars schema', () => {
    const generator = GeneratorSchema.fromSchema(starwarsSchema);
    console.log(generator.print());

    expect(generator.print()).toMatchInlineSnapshot(`
      "const Character = builder.simpleInterface(\\"Character\\", {
          fields: (t) => (({
              appearsIn: t.field({
                  type: [Episode],
                  nullable: ({ list: true, items: false }),
                  description: \`Which movies they appear in.\`,
              }),
              friends: t.field({
                  type: [Character],
                  nullable: ({ list: true, items: true }),
                  description: \`The friends of the character, or an empty list if they have none.\`,
              }),
              id: t.id({
                  nullable: true,
                  description: \`The id of the character\`,
              }),
              name: t.string({
                  nullable: true,
                  description: \`The name of the character\`,
              })
          }))
      });
      ;
      const Droid = builder.simpleObject(\\"Droid\\", {
          description: \`A mechanical creature in the Star Wars universe.\`,
          fields: (t) => (({
              appearsIn: t.field({
                  type: [Episode],
                  nullable: ({ list: true, items: false }),
                  description: \`Which movies they appear in.\`,
              }),
              friends: t.field({
                  type: [Character],
                  nullable: ({ list: true, items: true }),
                  description: \`The friends of the character, or an empty list if they have none.\`,
              }),
              id: t.id({
                  nullable: true,
                  description: \`The id of the character\`,
              }),
              name: t.string({
                  nullable: true,
                  description: \`The name of the character\`,
              }),
              primaryFunction: t.string({
                  nullable: true,
                  description: \`The primary function of the droid.\`,
              })
          }))
      });
      ;
      const Episode = builder.enumType(\\"Episode\\", {
          description: \`One of the films in the Star Wars Trilogy\`,
          values: ({
              EMPIRE: ({
                  description: \`Released in 1980.\`,
                  value: 5
              }),
              JEDI: ({
                  description: \`Released in 1983\`,
                  value: 6
              }),
              NEWHOPE: ({
                  description: \`Released in 1977.\`,
                  value: 4
              })
          })
      } as const);
      ;
      const Human = builder.simpleObject(\\"Human\\", {
          description: \`A humanoid creature in the Star Wars universe.\`,
          fields: (t) => (({
              appearsIn: t.field({
                  type: [Episode],
                  nullable: ({ list: true, items: false }),
                  description: \`Which movies they appear in.\`,
              }),
              friends: t.field({
                  type: [Character],
                  nullable: ({ list: true, items: true }),
                  description: \`The friends of the character, or an empty list if they have none.\`,
              }),
              homePlanet: t.string({
                  nullable: true,
                  description: \`The home planet of the human, or null if unknown.\`,
              }),
              id: t.id({
                  nullable: true,
                  description: \`The id of the character\`,
              }),
              name: t.string({
                  nullable: true,
                  description: \`The name of the character\`,
              })
          }))
      });
      ;
      const Query = builder.simpleObject(\\"Query\\", {
          fields: (t) => (({
              droid: t.field({
                  type: Droid,
                  nullable: true,
                  args: ({
                      id: t.arg.id({
                          required: false,
                          description: \`id of the character\`,
                      })
                  })
              }),
              hero: t.field({
                  type: Character,
                  nullable: true,
                  args: ({
                      episode: t.arg({
                          type: Episode,
                          required: false,
                          description: \`If omitted, returns the hero of the whole saga. If provided, returns the hero of that particular episode.\`,
                      })
                  })
              }),
              human: t.field({
                  type: Human,
                  nullable: true,
                  args: ({
                      id: t.arg.id({
                          required: false,
                          description: \`id of the character\`,
                      })
                  })
              }),
              r2d2: t.field({
                  type: Droid,
                  nullable: true
              })
          }))
      });
      ;"
    `);
  });
});
