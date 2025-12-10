import { execute } from 'graphql';
import { gql } from 'graphql-tag';
import { prisma, queries } from './example/builder';
import schema from './example/schema';

describe('prisma - fragment alias with composite cursor', () => {
  afterEach(() => {
    queries.length = 0;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('should use lateral join for both fragments when they share alias with different fields', async () => {
    const query = gql`
      query {
        properties(first: 1) {
          edges {
            node {
              id
              name
              ...FragmentA
              ...FragmentB
            }
          }
        }
      }

      fragment FragmentA on Property {
        yearlyMetrics: metrics(
          first: 10
          filter: { month: 0, startDate: "2020-01-01T00:00:00.000Z", endDate: "2021-01-01T00:00:00.000Z" }
        ) {
          edges {
            node {
              fieldA
              fieldB
            }
          }
        }
      }

      fragment FragmentB on Property {
        yearlyMetrics: metrics(
          first: 10
          filter: { month: 0, startDate: "2020-01-01T00:00:00.000Z", endDate: "2021-01-01T00:00:00.000Z" }
        ) {
          edges {
            node {
              fieldB
              fieldC
            }
          }
        }
      }
    `;

    const result = await execute({
      schema,
      document: query,
      contextValue: { user: { id: 1 } },
    });

    // Check that the query executed successfully
    expect(result.errors).toBeUndefined();
    expect(result.data).toBeDefined();

    // Log all queries
    console.log('\n======= ALL QUERIES =======');
    queries.forEach((q, i) => {
      console.log(`\nQuery ${i + 1}:`);
      console.log(q);
    });
    console.log('===========================\n');

    // Check that we don't have the problematic OR pattern
    // The bug would show up as a query like:
    // WHERE (("property_id" = $1 AND "end_date" = $2) OR ("property_id" = $3 AND "end_date" = $4) OR ...)
    const hasORPattern = queries.some((q) => {
      const queryStr = String(q);
      // Check if there's an OR pattern with multiple property_id/end_date pairs
      return queryStr.includes('OR') && queryStr.match(/property_id.*AND.*end_date.*OR/i);
    });

    // The test should pass when the bug is fixed (no OR pattern)
    expect(hasORPattern).toBe(false);

    // Verify we have the expected data structure
    const properties = result.data?.properties as any;
    expect(properties.edges).toHaveLength(1);
    const property = properties.edges[0].node;
    expect(property.yearlyMetrics).toBeDefined();
    expect(property.yearlyMetrics.edges).toBeDefined();

    // Verify all fields are present (fieldA, fieldB, fieldC)
    const metrics = property.yearlyMetrics.edges;
    if (metrics.length > 0) {
      const firstMetric = metrics[0].node;
      expect(firstMetric.fieldA).toBeDefined();
      expect(firstMetric.fieldB).toBeDefined();
      expect(firstMetric.fieldC).toBeDefined();
    }
  });

  it('should work correctly with different aliases (no bug)', async () => {
    const query = gql`
      query {
        properties(first: 1) {
          edges {
            node {
              id
              name
              ...FragmentA
              ...FragmentB
            }
          }
        }
      }

      fragment FragmentA on Property {
        metricsA: metrics(
          first: 10
          filter: { month: 0, startDate: "2020-01-01T00:00:00.000Z", endDate: "2021-01-01T00:00:00.000Z" }
        ) {
          edges {
            node {
              fieldA
              fieldB
            }
          }
        }
      }

      fragment FragmentB on Property {
        metricsB: metrics(
          first: 10
          filter: { month: 0, startDate: "2020-01-01T00:00:00.000Z", endDate: "2021-01-01T00:00:00.000Z" }
        ) {
          edges {
            node {
              fieldB
              fieldC
            }
          }
        }
      }
    `;

    const result = await execute({
      schema,
      document: query,
      contextValue: { user: { id: 1 } },
    });

    // Check that the query executed successfully
    expect(result.errors).toBeUndefined();
    expect(result.data).toBeDefined();

    // Log all queries
    console.log('\n======= QUERIES WITH DIFFERENT ALIASES (WORKING) =======');
    queries.forEach((q, i) => {
      console.log(`\nQuery ${i + 1}:`);
      console.log(q);
    });
    console.log('=========================================================\n');

    // With different aliases, this should work correctly
    const hasORPattern = queries.some((q) => {
      const queryStr = String(q);
      return queryStr.includes('OR') && queryStr.match(/property_id.*AND.*end_date.*OR/i);
    });

    expect(hasORPattern).toBe(false);

    // Verify we have the expected data structure
    const properties = result.data?.properties as any;
    expect(properties.edges).toHaveLength(1);
    const property = properties.edges[0].node;
    expect(property.metricsA).toBeDefined();
    expect(property.metricsB).toBeDefined();
  });
});
