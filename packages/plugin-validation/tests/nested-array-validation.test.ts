import SchemaBuilder from '@pothos/core';
import { execute } from 'graphql';
import { gql } from 'graphql-tag';
import * as zod from 'zod';
import '../src';

const builder = new SchemaBuilder<{
  Scalars: {
    ID: { Input: bigint | number | string; Output: bigint | number | string };
  };
}>({
  plugins: ['validation'],
  validation: {},
});

const PointInput = builder
  .inputType('PointInput', {
    fields: (t) => ({
      lat: t.float({
        description: 'Latitude of the point',
        required: true,
      }),
      lng: t.float({
        description: 'Longitude of the point',
        required: true,
      }),
    }),
  })
  .validate(
    zod.object({
      lat: zod.number().min(-90).max(90),
      lng: zod.number().min(-180).max(180),
    }),
  );

const GeoJsonTypeEnum = builder.enumType('GeoJsonType', {
  values: ['Polygon', 'MultiPolygon'] as const,
});

const GeoWithinInput = builder.inputType('GeoWithinInput', {
  fields: (t) => ({
    type: t.field({
      type: GeoJsonTypeEnum,
      description: 'Type of GeoJSON object.',
      required: true,
    }),
    polygon: t.field({
      type: t.listRef(t.listRef(PointInput)),
      description: 'Polygon coordinates - array of rings, each ring is array of points',
    }),
    multiPolygon: t.field({
      type: t.listRef(t.listRef(t.listRef(PointInput))),
      description: 'MultiPolygon coordinates - array of polygons',
    }),
  }),
});

const MatrixInput = builder
  .inputType('MatrixInput', {
    fields: (t) => ({
      rows: t.field({
        type: t.listRef(t.listRef('Float')),
        required: true,
      }),
    }),
  })
  .validate(
    zod.object({
      rows: zod
        .array(zod.array(zod.number()))
        .refine((rows) => rows.every((row) => row.length === rows[0]?.length), {
          message: 'Matrix must be rectangular',
        }),
    }),
  );

const NullablePointInput = builder
  .inputType('NullablePointInput', {
    fields: (t) => ({
      lat: t.float({
        description: 'Latitude of the point',
      }),
      lng: t.float({
        description: 'Longitude of the point',
      }),
    }),
  })
  .validate(
    zod.object({
      lat: zod.number().min(-90).max(90).nullable().optional(),
      lng: zod.number().min(-180).max(180).nullable().optional(),
    }),
  );

const TransformPointInput = builder.inputType('TransformPointInput', {
  fields: (t) => ({
    lat: t
      .float({ required: true })
      .validate(zod.number().transform((val) => Math.round(val * 1000) / 1000)),
    lng: t
      .float({ required: true })
      .validate(zod.number().transform((val) => Math.round(val * 1000) / 1000)),
  }),
});

const NestedTransformInput = builder
  .inputType('NestedTransformInput', {
    fields: (t) => ({
      points: t.field({
        type: t.listRef(t.listRef(TransformPointInput)),
        required: true,
      }),
      multiplier: t.float({ required: true }).validate(
        zod
          .number()
          .positive()
          .transform((val) => val * 2),
      ),
    }),
  })
  .validate(
    zod.object({
      points: zod.array(zod.array(zod.any())).min(1, 'Must have at least one row'),
      multiplier: zod.number().max(20, 'Multiplier too large after doubling'),
    }),
  );

const StringListWithTransformInput = builder.inputType('StringListWithTransformInput', {
  fields: (t) => ({
    tags: t
      .stringList({ required: true })
      .validate(
        zod
          .array(zod.string().transform((s) => s.trim().toLowerCase()))
          .transform((arr) => [...new Set(arr)]),
      ),
    nested: t.field({
      type: t.listRef(t.listRef('String')),
      required: true,
    }),
  }),
});

builder.queryType({
  fields: (t) => ({
    validateRootNestedList: t.string({
      args: {
        matrix: t.arg({
          type: t.arg.listRef(['Float']),
          required: true,
          validate: zod.array(zod.array(zod.number().positive())),
        }),
        deepList: t.arg({
          type: t.arg.listRef(t.arg.listRef(['String'])),
          required: true,
          validate: zod.array(zod.array(zod.array(zod.string().min(2).max(10)))),
        }),
      },
      resolve: (_parent, args) => {
        return JSON.stringify({
          matrix: args.matrix,
          deepList: args.deepList,
        });
      },
    }),
    validatePointMatrix: t.string({
      args: {
        points: t.arg({
          type: t.arg.listRef([PointInput]),
          required: true,
          validate: zod
            .array(zod.array(zod.any()))
            .min(1, 'Must have at least one row')
            .refine((rows) => rows.every((row) => row.length >= 2), {
              message: 'Each row must have at least 2 points',
            }),
        }),
      },
      resolve: (_parent, args) => {
        return JSON.stringify(args.points);
      },
    }),
    testFieldTransforms: t.string({
      args: {
        data: t.arg({
          type: NestedTransformInput,
          required: true,
        }),
      },
      resolve: (_parent, args) => {
        return JSON.stringify(args.data);
      },
    }),
    testStringListTransforms: t.string({
      args: {
        input: t.arg({
          type: StringListWithTransformInput,
          required: true,
        }),
      },
      resolve: (_parent, args) => {
        return JSON.stringify(args.input);
      },
    }),
    testNestedFieldValidation: t.string({
      args: {
        matrix: t.arg({
          type: t.arg.listRef([TransformPointInput]),
          required: true,
        }),
        factor: t.arg.float({ required: true }).validate(
          zod
            .number()
            .positive()
            .transform((n) => n + 10),
        ),
      },
      resolve: (_parent, args) => {
        return JSON.stringify({ matrix: args.matrix, factor: args.factor });
      },
    }),
    geoWithin: t.string({
      args: {
        within: t.arg({
          type: GeoWithinInput,
          description: 'Geospatial area to filter assets by.',
        }),
      },
      resolve: (_parent, args) => {
        const result = {
          type: args.within?.type,
          polygonPointsCount: args.within?.polygon?.length,
          multiPolygonCount: args.within?.multiPolygon?.length,
          polygonData: args.within?.polygon,
          multiPolygonData: args.within?.multiPolygon,
        };
        return JSON.stringify(result);
      },
    }),
    validateMatrix: t.string({
      args: {
        matrix: t.arg({ type: MatrixInput }),
      },
      resolve: (_parent, args) => {
        return JSON.stringify(args.matrix);
      },
    }),
    validateNullablePoints: t.string({
      nullable: true,
      args: {
        simpleList: t.arg({
          type: t.arg.listRef(NullablePointInput, { required: false }),
        }),
        nestedList: t.arg({
          type: t.arg.listRef(t.arg.listRef(NullablePointInput, { required: false }), {
            required: false,
          }),
        }),
      },
      resolve: (_parent, args) => {
        return JSON.stringify({
          simpleList: args.simpleList,
          nestedList: args.nestedList,
        });
      },
    }),
  }),
});

const schema = builder.toSchema();

describe('Nested Array Validation', () => {
  describe('PointInput validation in nested arrays', () => {
    it('should validate individual points in a polygon array', async () => {
      const validQuery = gql`
        query {
          geoWithin(within: {
            type: Polygon
            polygon: [
              [
                { lat: 40.7128, lng: -74.0060 }
                { lat: 40.7580, lng: -73.9855 }
                { lat: 40.7489, lng: -73.9680 }
                { lat: 40.7128, lng: -74.0060 }
              ]
            ]
          })
        }
      `;

      const result = await execute({
        schema,
        document: validQuery,
        contextValue: {},
      });

      expect(result).toMatchInlineSnapshot(`
        {
          "data": {
            "geoWithin": "{"type":"Polygon","polygonPointsCount":1,"polygonData":[[{"lat":40.7128,"lng":-74.006},{"lat":40.758,"lng":-73.9855},{"lat":40.7489,"lng":-73.968},{"lat":40.7128,"lng":-74.006}]]}",
          },
        }
      `);
      expect(result.errors).toBeUndefined();
      expect(result.data?.geoWithin).toBeTruthy();
      const response = JSON.parse(result.data?.geoWithin as string);
      expect(response.type).toBe('Polygon');
      expect(response.polygonPointsCount).toBe(1);
    });

    it('should reject invalid latitude in nested point', async () => {
      const invalidQuery = gql`
        query {
          geoWithin(within: {
            type: Polygon
            polygon: [
              [
                { lat: 91, lng: -74.0060 }
                { lat: 40.7580, lng: -73.9855 }
                { lat: 40.7489, lng: -73.9680 }
                { lat: 91, lng: -74.0060 }
              ]
            ]
          })
        }
      `;

      const result = await execute({
        schema,
        document: invalidQuery,
        contextValue: {},
      });

      expect(result.errors).toBeDefined();
      expect(result.data?.geoWithin).toBeNull();
      expect(result.errors?.[0]?.message).toMatchInlineSnapshot(
        `"Validation error: within.polygon.0.0.lat: Too big: expected number to be <=90, within.polygon.0.3.lat: Too big: expected number to be <=90"`,
      );
    });

    it('should reject invalid longitude in nested point', async () => {
      const invalidQuery = gql`
        query {
          geoWithin(within: {
            type: Polygon
            polygon: [
              [
                { lat: 40.7128, lng: -181 }
                { lat: 40.7580, lng: -73.9855 }
                { lat: 40.7489, lng: -73.9680 }
                { lat: 40.7128, lng: -181 }
              ]
            ]
          })
        }
      `;

      const result = await execute({
        schema,
        document: invalidQuery,
        contextValue: {},
      });

      expect(result.errors).toBeDefined();
      expect(result.data?.geoWithin).toBeNull();
      // The error should mention the validation failure for longitude
      expect(result.errors?.[0]?.message).toMatchInlineSnapshot(
        `"Validation error: within.polygon.0.0.lng: Too small: expected number to be >=-180, within.polygon.0.3.lng: Too small: expected number to be >=-180"`,
      );
    });

    it('should validate points in multiple polygon rings', async () => {
      const validQuery = gql`
        query {
          geoWithin(within: {
            type: Polygon
            polygon: [
              [
                { lat: 40.7128, lng: -74.0060 }
                { lat: 40.7580, lng: -73.9855 }
                { lat: 40.7489, lng: -73.9680 }
                { lat: 40.7128, lng: -74.0060 }
              ],
              [
                { lat: 40.7300, lng: -74.0000 }
                { lat: 40.7400, lng: -73.9900 }
                { lat: 40.7350, lng: -73.9800 }
                { lat: 40.7300, lng: -74.0000 }
              ]
            ]
          })
        }
      `;

      const result = await execute({
        schema,
        document: validQuery,
        contextValue: {},
      });

      expect(result.errors).toBeUndefined();
      expect(result.data?.geoWithin).toBeTruthy();
      const response = JSON.parse(result.data?.geoWithin as string);
      expect(response.type).toBe('Polygon');
      expect(response.polygonPointsCount).toBe(2);
    });

    it('should validate points in multiPolygon (triple nested arrays)', async () => {
      const validQuery = gql`
        query {
          geoWithin(within: {
            type: MultiPolygon
            multiPolygon: [
              [
                [
                  { lat: 40.7128, lng: -74.0060 }
                  { lat: 40.7580, lng: -73.9855 }
                  { lat: 40.7489, lng: -73.9680 }
                  { lat: 40.7128, lng: -74.0060 }
                ]
              ],
              [
                [
                  { lat: 41.8781, lng: -87.6298 }
                  { lat: 41.8850, lng: -87.6200 }
                  { lat: 41.8800, lng: -87.6100 }
                  { lat: 41.8781, lng: -87.6298 }
                ]
              ]
            ]
          })
        }
      `;

      const result = await execute({
        schema,
        document: validQuery,
        contextValue: {},
      });

      expect(result.errors).toBeUndefined();
      expect(result.data?.geoWithin).toBeTruthy();
      const response = JSON.parse(result.data?.geoWithin as string);
      expect(response.type).toBe('MultiPolygon');
      expect(response.multiPolygonCount).toBe(2);
    });

    it('should reject invalid points in multiPolygon', async () => {
      const invalidQuery = gql`
        query {
          geoWithin(within: {
            type: MultiPolygon
            multiPolygon: [
              [
                [
                  { lat: 95, lng: -74.0060 }
                  { lat: 40.7580, lng: -73.9855 }
                  { lat: 40.7489, lng: -73.9680 }
                  { lat: 95, lng: -74.0060 }
                ]
              ]
            ]
          })
        }
      `;

      const result = await execute({
        schema,
        document: invalidQuery,
        contextValue: {},
      });

      expect(result.errors).toBeDefined();
      expect(result.data?.geoWithin).toBeNull();
      expect(result.errors?.[0]?.message).toMatchInlineSnapshot(
        `"Validation error: within.multiPolygon.0.0.0.lat: Too big: expected number to be <=90, within.multiPolygon.0.0.3.lat: Too big: expected number to be <=90"`,
      );
    });

    it('should handle mixed valid and invalid points correctly', async () => {
      const mixedQuery = gql`
        query {
          geoWithin(within: {
            type: Polygon
            polygon: [
              [
                { lat: 40.7128, lng: -74.0060 }
                { lat: -91, lng: -73.9855 }
                { lat: 40.7489, lng: 185 }
                { lat: 40.7128, lng: -74.0060 }
              ]
            ]
          })
        }
      `;

      const result = await execute({
        schema,
        document: mixedQuery,
        contextValue: {},
      });

      expect(result.errors).toBeDefined();
      expect(result.data?.geoWithin).toBeNull();
      expect(result.errors?.[0]?.message).toMatchInlineSnapshot(
        `"Validation error: within.polygon.0.1.lat: Too small: expected number to be >=-90, within.polygon.0.2.lng: Too big: expected number to be <=180"`,
      );
    });

    it('should validate empty arrays appropriately', async () => {
      const emptyQuery = gql`
        query {
          geoWithin(within: {
            type: Polygon
            polygon: []
          })
        }
      `;

      const result = await execute({
        schema,
        document: emptyQuery,
        contextValue: {},
      });

      expect(result.data?.geoWithin).toBeTruthy();
      const response = JSON.parse(result.data?.geoWithin as string);
      expect(response.polygonPointsCount).toBe(0);
    });

    it('should handle both polygon and multiPolygon in same query', async () => {
      const combinedQuery = gql`
        query {
          geoWithin(within: {
            type: Polygon
            polygon: [
              [
                { lat: 40.7128, lng: -74.0060 }
                { lat: 40.7580, lng: -73.9855 }
                { lat: 40.7489, lng: -73.9680 }
                { lat: 40.7128, lng: -74.0060 }
              ]
            ]
            multiPolygon: [
              [
                [
                  { lat: 41.8781, lng: -87.6298 }
                  { lat: 41.8850, lng: -87.6200 }
                  { lat: 41.8800, lng: -87.6100 }
                  { lat: 41.8781, lng: -87.6298 }
                ]
              ]
            ]
          })
        }
      `;

      const result = await execute({
        schema,
        document: combinedQuery,
        contextValue: {},
      });

      expect(result.errors).toBeUndefined();
      expect(result.data?.geoWithin).toBeTruthy();
      const response = JSON.parse(result.data?.geoWithin as string);
      expect(response.type).toBe('Polygon');
      expect(response.polygonPointsCount).toBe(1);
      expect(response.multiPolygonCount).toBe(1);
    });
  });

  describe('Field-only validation in nested arrays', () => {
    it('should validate matrix is rectangular', async () => {
      const invalidQuery = gql`
        query {
          validateMatrix(matrix: { rows: [[1, 2, 3], [4, 5], [6, 7, 8]] })
        }
      `;

      const result = await execute({
        schema,
        document: invalidQuery,
        contextValue: {},
      });

      expect(result.errors).toBeDefined();
      expect(result.errors?.[0]?.message).toMatchInlineSnapshot(
        `"Validation error: matrix.rows: Matrix must be rectangular"`,
      );
    });

    it('should accept valid rectangular matrix', async () => {
      const validQuery = gql`
        query {
          validateMatrix(matrix: { rows: [[1, 2, 3], [4, 5, 6], [7, 8, 9]] })
        }
      `;

      const result = await execute({
        schema,
        document: validQuery,
        contextValue: {},
      });

      expect(result.errors).toBeUndefined();
      expect(result.data?.validateMatrix).toBeTruthy();
    });
  });

  describe('Nullable items at various nesting levels', () => {
    it('should handle nulls in simple list', async () => {
      const query = gql`
        query {
          validateNullablePoints(
            simpleList: [
              { lat: 45.5, lng: -122.5 },
              null,
              { lat: 40.7, lng: -74.0 },
              { lat: null, lng: -118.2 }
            ],
            nestedList: [[{ lat: 30, lng: -90 }]]
          )
        }
      `;

      const result = await execute({
        schema,
        document: query,
        contextValue: {},
      });

      expect(result.errors).toBeUndefined();
      const data = JSON.parse(result.data?.validateNullablePoints as string);
      expect(data.simpleList).toHaveLength(4);
      expect(data.simpleList[1]).toBeNull();
      expect(data.simpleList[3].lat).toBeNull();
    });

    it('should handle nulls in nested lists', async () => {
      const query = gql`
        query {
          validateNullablePoints(
            simpleList: [{ lat: 0, lng: 0 }],
            nestedList: [
              [{ lat: 45.5, lng: -122.5 }, null, { lat: 40.7, lng: -74.0 }],
              null,
              [{ lat: 30, lng: null }]
            ]
          )
        }
      `;

      const result = await execute({
        schema,
        document: query,
        contextValue: {},
      });

      expect(result.errors).toBeUndefined();
      const data = JSON.parse(result.data?.validateNullablePoints as string);
      expect(data.nestedList).toHaveLength(3);
      expect(data.nestedList[0]).toHaveLength(3);
      expect(data.nestedList[0][1]).toBeNull();
      expect(data.nestedList[1]).toBeNull();
      expect(data.nestedList[2][0].lng).toBeNull();
    });

    it('should validate non-null values correctly', async () => {
      const invalidQuery = gql`
        query {
          validateNullablePoints(
            simpleList: [
              { lat: 95, lng: -122.5 },
              null,
              { lat: 40.7, lng: -185 }
            ],
            nestedList: [[{ lat: 30, lng: -90 }]]
          )
        }
      `;

      const result = await execute({
        schema,
        document: invalidQuery,
        contextValue: {},
      });

      expect(result.errors).toBeDefined();
      expect(result.errors?.length).toBeGreaterThan(0);
    });
  });

  describe('Root-level nested list validation', () => {
    it('should validate nested numeric arrays at root level', async () => {
      const invalidQuery = gql`
        query {
          validateRootNestedList(
            matrix: [[1, 2, -3], [4, 5, 6]]
            deepList: [
              [["ab", "cd"], ["ef", "gh"]],
              [["ij", "kl"], ["mn", "op"]]
            ]
          )
        }
      `;

      const result = await execute({
        schema,
        document: invalidQuery,
        contextValue: {},
      });

      expect(result.errors).toBeDefined();
      expect(result.errors?.[0]?.message).toMatchInlineSnapshot(
        `"Validation error: matrix.0.2: Too small: expected number to be >0"`,
      );
    });

    it('should validate deep nested string arrays', async () => {
      const invalidQuery = gql`
        query {
          validateRootNestedList(
            matrix: [[1, 2, 3], [4, 5, 6]]
            deepList: [
              [["ab", "c"], ["ef", "gh"]],
              [["toolongstring", "kl"], ["mn", "op"]]
            ]
          )
        }
      `;

      const result = await execute({
        schema,
        document: invalidQuery,
        contextValue: {},
      });

      expect(result.errors).toBeDefined();
      const errorMessage = result.errors?.[0]?.message;
      expect(errorMessage).toMatch(/Too small|Too big/);
    });

    it('should accept valid nested arrays at root level', async () => {
      const validQuery = gql`
        query {
          validateRootNestedList(
            matrix: [[1, 2, 3], [4, 5, 6]]
            deepList: [
              [["ab", "cd"], ["ef", "gh"]],
              [["ij", "kl"], ["mn", "op"]]
            ]
          )
        }
      `;

      const result = await execute({
        schema,
        document: validQuery,
        contextValue: {},
      });

      expect(result.errors).toBeUndefined();
      const data = JSON.parse(result.data?.validateRootNestedList as string);
      expect(data.matrix).toHaveLength(2);
      expect(data.deepList).toHaveLength(2);
      expect(data.deepList[0]).toHaveLength(2);
      expect(data.deepList[0][0]).toHaveLength(2);
    });

    it('should validate nested point arrays with field-level rules', async () => {
      const invalidQuery = gql`
        query {
          validatePointMatrix(
            points: [
              [{ lat: 45, lng: -122 }]
            ]
          )
        }
      `;

      const result = await execute({
        schema,
        document: invalidQuery,
        contextValue: {},
      });

      expect(result.errors).toBeDefined();
      expect(result.errors?.[0]?.message).toMatchInlineSnapshot(
        `"Validation error: points: Each row must have at least 2 points"`,
      );
    });

    it('should validate point values in nested arrays', async () => {
      const invalidQuery = gql`
        query {
          validatePointMatrix(
            points: [
              [{ lat: 95, lng: -122 }, { lat: 45, lng: -74 }],
              [{ lat: 40, lng: -185 }, { lat: 30, lng: -90 }]
            ]
          )
        }
      `;

      const result = await execute({
        schema,
        document: invalidQuery,
        contextValue: {},
      });

      expect(result.errors).toBeDefined();
      expect(result.errors?.[0]?.message).toMatchInlineSnapshot(
        `"Validation error: points.0.0.lat: Too big: expected number to be <=90, points.1.0.lng: Too small: expected number to be >=-180"`,
      );
    });

    it('should accept valid nested point arrays', async () => {
      const validQuery = gql`
        query {
          validatePointMatrix(
            points: [
              [{ lat: 45.5, lng: -122.5 }, { lat: 47.6, lng: -122.3 }],
              [{ lat: 40.7, lng: -74.0 }, { lat: 42.3, lng: -71.0 }]
            ]
          )
        }
      `;

      const result = await execute({
        schema,
        document: validQuery,
        contextValue: {},
      });

      expect(result.errors).toBeUndefined();
      const data = JSON.parse(result.data?.validatePointMatrix as string);
      expect(data).toHaveLength(2);
      expect(data[0]).toHaveLength(2);
      expect(data[1]).toHaveLength(2);
    });

    it('should report errors with correct paths for deeply nested arrays', async () => {
      const invalidQuery = gql`
        query {
          validateRootNestedList(
            matrix: [[1, 2], [3, -4], [5, -6]]
            deepList: [[["ab", "cd"]]]
          )
        }
      `;

      const result = await execute({
        schema,
        document: invalidQuery,
        contextValue: {},
      });

      expect(result.errors).toBeDefined();
      expect(result.errors?.[0]?.message).toMatchInlineSnapshot(
        `"Validation error: matrix.1.1: Too small: expected number to be >0, matrix.2.1: Too small: expected number to be >0"`,
      );
    });
  });

  describe('Field-level validation with transforms', () => {
    it('should apply field-level transforms before higher-level validation', async () => {
      const query = gql`
        query {
          testFieldTransforms(data: {
            points: [
              [
                { lat: 40.712811111, lng: -74.006011111 }
                { lat: 40.758022222, lng: -73.985533333 }
              ]
            ]
            multiplier: 5.5
          })
        }
      `;

      const result = await execute({
        schema,
        document: query,
        contextValue: {},
      });

      expect(result.errors).toBeUndefined();
      const data = JSON.parse(result.data?.testFieldTransforms as string);

      expect(data.points[0][0].lat).toBe(40.713);
      expect(data.points[0][0].lng).toBe(-74.006);
      expect(data.points[0][1].lat).toBe(40.758);
      expect(data.points[0][1].lng).toBe(-73.986);
      expect(data.multiplier).toBe(11);
    });

    it('should validate after field transforms are applied', async () => {
      const query = gql`
        query {
          testFieldTransforms(data: {
            points: [
              [{ lat: 40.7, lng: -74.0 }]
            ]
            multiplier: 15
          })
        }
      `;

      const result = await execute({
        schema,
        document: query,
        contextValue: {},
      });

      expect(result.errors).toBeDefined();
      expect(result.errors?.[0]?.message).toMatchInlineSnapshot(
        `"Validation error: data.multiplier: Multiplier too large after doubling"`,
      );
    });

    it('should apply transforms to string lists and deduplicate', async () => {
      const query = gql`
        query {
          testStringListTransforms(input: {
            tags: [" JavaScript ", "TYPESCRIPT", " typescript ", "React"]
            nested: [["A", "B"], ["C", "D"]]
          })
        }
      `;

      const result = await execute({
        schema,
        document: query,
        contextValue: {},
      });

      expect(result.errors).toBeUndefined();
      const data = JSON.parse(result.data?.testStringListTransforms as string);

      expect(data.tags).toEqual(['javascript', 'typescript', 'react']);
      expect(data.nested).toEqual([
        ['A', 'B'],
        ['C', 'D'],
      ]);
    });

    it('should apply transforms to direct field arguments', async () => {
      const query = gql`
        query {
          testNestedFieldValidation(
            matrix: [
              [
                { lat: 1.123456789, lng: 2.987654321 }
                { lat: 3.555555555, lng: 4.444444444 }
              ]
            ]
            factor: 2.5
          )
        }
      `;

      const result = await execute({
        schema,
        document: query,
        contextValue: {},
      });

      expect(result.errors).toBeUndefined();
      const data = JSON.parse(result.data?.testNestedFieldValidation as string);

      expect(data.matrix[0][0].lat).toBe(1.123);
      expect(data.matrix[0][0].lng).toBe(2.988);
      expect(data.matrix[0][1].lat).toBe(3.556);
      expect(data.matrix[0][1].lng).toBe(4.444);
      expect(data.factor).toBe(12.5);
    });

    it('should validate field-level constraints before transforms', async () => {
      const query = gql`
        query {
          testNestedFieldValidation(
            matrix: [[{ lat: 1.0, lng: 2.0 }]]
            factor: -5
          )
        }
      `;

      const result = await execute({
        schema,
        document: query,
        contextValue: {},
      });

      expect(result.errors).toBeDefined();
      expect(result.errors?.[0]?.message).toMatchInlineSnapshot(
        `"Validation error: factor: Too small: expected number to be >0"`,
      );
    });

    it('should handle validation errors in nested transformed fields', async () => {
      const query = gql`
        query {
          testFieldTransforms(data: {
            points: []
            multiplier: 1
          })
        }
      `;

      const result = await execute({
        schema,
        document: query,
        contextValue: {},
      });

      expect(result.errors).toBeDefined();
      expect(result.errors?.[0]?.message).toMatchInlineSnapshot(
        `"Validation error: data.points: Must have at least one row"`,
      );
    });
  });
});
