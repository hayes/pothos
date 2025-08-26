import SchemaBuilder from '@pothos/core';
import { execute } from 'graphql';
import { gql } from 'graphql-tag';
import * as zod from 'zod';
import '../src';

// Create a minimal schema just for testing the GeoJSON nested array validation
const builder = new SchemaBuilder<{
  Scalars: {
    ID: { Input: bigint | number | string; Output: bigint | number | string };
  };
}>({
  plugins: ['validation'],
  validation: {},
});

// Define the PointInput type with validation
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

// Define the GeoJSON type enum
const GeoJsonTypeEnum = builder.enumType('GeoJsonType', {
  values: ['Polygon', 'MultiPolygon'] as const,
});

// Define the GeoWithinInput type with nested arrays
const GeoWithinInput = builder.inputType('GeoWithinInput', {
  fields: (t) => ({
    type: t.field({
      type: GeoJsonTypeEnum,
      description: 'Type of GeoJSON object.',
      required: true,
    }),
    polygon: t.field({
      type: t.listRef(t.listRef(PointInput)), // [[PointInput]]
      description: 'Polygon coordinates - array of rings, each ring is array of points',
    }),
    multiPolygon: t.field({
      type: t.listRef(t.listRef(t.listRef(PointInput))), // [[[PointInput]]]
      description: 'MultiPolygon coordinates - array of polygons',
    }),
  }),
});

// Create a simple query with just the geoWithin field
builder.queryType({
  fields: (t) => ({
    geoWithin: t.string({
      args: {
        within: t.arg({
          type: GeoWithinInput,
          description: 'Geospatial area to filter assets by.',
        }),
      },
      resolve: (_parent, args) => {
        // Simple resolver that returns the input data as JSON for inspection
        const result = {
          type: args.within?.type,
          polygonPointsCount: args.within?.polygon?.length,
          multiPolygonCount: args.within?.multiPolygon?.length,
          // Include the actual data to verify validation is working
          polygonData: args.within?.polygon,
          multiPolygonData: args.within?.multiPolygon,
        };
        return JSON.stringify(result);
      },
    }),
  }),
});

// Build the schema
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
      // The error should mention the validation failure for latitude
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
      // The error should mention the validation failure for latitude in the multiPolygon
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
      // Should report multiple validation errors
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

      // Empty polygon should be allowed by the type system but might fail business logic
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
});
