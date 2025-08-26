import { describe, expect, it } from 'vitest';
import type { StandardSchemaV1 } from '../src/standard-schema';
import { createInputValueMapper, reduceMaybeAsync } from '../src/utils';

describe('reduceMaybeAsync', () => {
  describe('synchronous operations', () => {
    it('reduces an array of numbers synchronously', () => {
      const result = reduceMaybeAsync([1, 2, 3, 4], 0, (acc, val) => acc + val);
      expect(result).toBe(10);
    });

    it('handles empty arrays', () => {
      const result = reduceMaybeAsync([], 'initial', (acc, val) => acc + val);
      expect(result).toBe('initial');
    });

    it('provides correct index to reducer function', () => {
      const indices: number[] = [];
      reduceMaybeAsync([10, 20, 30], 0, (acc, val, i) => {
        indices.push(i);
        return acc + val;
      });
      expect(indices).toEqual([0, 1, 2]);
    });

    it('stops processing when null is returned', () => {
      const processed: number[] = [];
      const result = reduceMaybeAsync([1, 2, 3, 4, 5], 0, (acc, val) => {
        processed.push(val);
        if (val === 3) {
          return null;
        }
        return acc + val;
      });

      expect(result).toBe(null);
      expect(processed).toEqual([1, 2, 3]);
    });
  });

  describe('asynchronous operations', () => {
    it('reduces an array with async operations', async () => {
      const result = await reduceMaybeAsync([1, 2, 3], 0, async (acc, val) => {
        await new Promise((resolve) => setTimeout(resolve, 1));
        return acc + val;
      });

      expect(result).toBe(6);
    });

    it('handles mixed sync and async operations', async () => {
      const result = await reduceMaybeAsync([1, 2, 3, 4], 0, (acc, val, i) => {
        if (i % 2 === 0) {
          return acc + val;
        }
        return Promise.resolve(acc + val);
      });

      expect(result).toBe(10);
    });

    it('stops processing on async null return', async () => {
      const processed: number[] = [];
      const result = await reduceMaybeAsync([1, 2, 3, 4, 5], 0, async (acc, val) => {
        processed.push(val);
        await new Promise((resolve) => setTimeout(resolve, 1));

        if (val === 3) {
          return null;
        }
        return acc + val;
      });

      expect(result).toBe(null);
      expect(processed).toEqual([1, 2, 3]);
    });

    it('preserves order with async operations', async () => {
      const order: number[] = [];

      await reduceMaybeAsync([1, 2, 3], 0, async (acc, val, i) => {
        await new Promise((resolve) => setTimeout(resolve, 3 - i));
        order.push(val);
        return acc + val;
      });

      expect(order).toEqual([1, 2, 3]);
    });

    it('propagates errors from async operations', async () => {
      const promise = reduceMaybeAsync([1, 2, 3], 0, (acc, val) => {
        if (val === 2) {
          return Promise.reject(new Error('Test error'));
        }
        return Promise.resolve(acc + val);
      });

      await expect(promise).rejects.toThrow('Test error');
    });
  });

  describe('edge cases', () => {
    it('handles single item array', () => {
      const result = reduceMaybeAsync([42], 0, (acc, val) => acc + val);
      expect(result).toBe(42);
    });

    it('handles null initial value', () => {
      const result = reduceMaybeAsync([1, 2, 3], null as number | null, (acc, val) => {
        return acc === null ? val : acc + val;
      });
      expect(result).toBe(6);
    });

    it('handles undefined values in array', () => {
      const result = reduceMaybeAsync([1, undefined, 3], 0, (acc, val) => {
        return acc + (val ?? 0);
      });
      expect(result).toBe(4);
    });

    it('properly chains multiple async operations', async () => {
      const operations = [
        (x: number) => Promise.resolve(x * 2),
        (x: number) => Promise.resolve(x + 10),
        (x: number) => Promise.resolve(x / 2),
      ];

      const result = await reduceMaybeAsync(operations, 5, (value, operation) => {
        return operation(value);
      });

      expect(result).toBe(10); // (5 * 2 + 10) / 2 = 10
    });

    it('handles mixed promises and values in reducer', async () => {
      const items = [1, 2, 3, 4, 5];
      const result = await reduceMaybeAsync(items, [], async (acc: number[], val) => {
        if (val % 2 === 0) {
          await new Promise((resolve) => setTimeout(resolve, 1));
          return [...acc, val * 2];
        }
        return [...acc, val];
      });

      expect(result).toEqual([1, 4, 3, 8, 5]);
    });

    it('correctly handles Promise.reject in async operations', async () => {
      const error = new Error('Async error');
      const promise = reduceMaybeAsync([1, 2, 3], 0, (acc, val) => {
        if (val === 2) {
          return Promise.reject(error);
        }
        return acc + val;
      });

      await expect(promise).rejects.toBe(error);
    });
  });
});

describe('createInputValueMapper', () => {
  type TestInputFieldMapping =
    | {
        kind: 'Scalar';
        isList: boolean;
        listDepth: number;
        config: Record<string, unknown>;
        value: unknown;
      }
    | {
        kind: 'InputObject';
        isList: boolean;
        listDepth: number;
        config: Record<string, unknown>;
        value: unknown | null;
        fields: {
          configs: Record<string, unknown>;
          map: Map<string, TestInputFieldMapping> | null;
        };
      }
    | {
        kind: 'Enum';
        isList: boolean;
        listDepth: number;
        config: Record<string, unknown>;
        value: unknown;
      };

  const createScalarMapping = (
    value: unknown,
    isList = false,
    listDepth = 1,
  ): TestInputFieldMapping => ({
    kind: 'Scalar',
    isList,
    listDepth: isList ? listDepth : 0,
    config: {},
    value,
  });

  const createInputObjectMapping = (
    value: unknown,
    fields: Record<string, TestInputFieldMapping>,
    isList = false,
    listDepth = 1,
  ): TestInputFieldMapping => ({
    kind: 'InputObject',
    isList,
    listDepth: isList ? listDepth : 0,
    config: {},
    value,
    fields: {
      configs: {},
      map: new Map(Object.entries(fields)),
    },
  });

  describe('basic mapping', () => {
    it('maps scalar fields', () => {
      const mapping = new Map<string, TestInputFieldMapping>([
        ['name', createScalarMapping('string')],
        ['age', createScalarMapping('number')],
      ]);

      const mapper = createInputValueMapper(
        mapping as never,
        (val, field) => {
          const mockField = field as unknown as TestInputFieldMapping;
          if (mockField.value === 'string') {
            return String(val).toUpperCase();
          }
          return val;
        },
        (val) => val,
      );

      const result = mapper({ name: 'john', age: 30 });
      expect(result).toEqual({
        value: { name: 'JOHN', age: 30 },
        issues: undefined,
      });
    });

    it('handles null and undefined values', () => {
      const mapping = new Map<string, TestInputFieldMapping>([
        ['name', createScalarMapping('string')],
        ['age', createScalarMapping('number')],
      ]);

      const mapper = createInputValueMapper(
        mapping as never,
        (val) => val,
        (val) => val,
      );

      const result = mapper({ name: null, age: undefined });
      expect(result).toEqual({
        value: { name: null, age: undefined },
        issues: undefined,
      });
    });

    it('collects validation issues', () => {
      const mapping = new Map<string, TestInputFieldMapping>([
        ['email', createScalarMapping('email')],
      ]);

      const mapper = createInputValueMapper(
        mapping as never,
        (val, field, addIssues) => {
          const mockField = field as unknown as TestInputFieldMapping;
          if (mockField.value === 'email' && !String(val).includes('@')) {
            addIssues([{ message: 'Invalid email' } as StandardSchemaV1.Issue]);
          }
          return val;
        },
        (val) => val,
      );

      const result = mapper({ email: 'not-an-email' });
      expect(result).toEqual({
        issues: [{ message: 'Invalid email', path: ['email'] }],
      });
    });
  });

  describe('nested object mapping', () => {
    it('maps nested input objects', () => {
      const addressFields: Record<string, TestInputFieldMapping> = {
        street: createScalarMapping('string'),
        city: createScalarMapping('string'),
      };

      const mapping = new Map<string, TestInputFieldMapping>([
        ['name', createScalarMapping('string')],
        ['address', createInputObjectMapping(null, addressFields)],
      ]);

      const mapper = createInputValueMapper(
        mapping as never,
        (val, field) => {
          const mockField = field as unknown as TestInputFieldMapping;
          if (mockField.value === 'string') {
            return String(val).toUpperCase();
          }
          return val;
        },
        (val) => val,
      );

      const result = mapper({
        name: 'john',
        address: {
          street: '123 main st',
          city: 'new york',
        },
      });

      expect(result).toEqual({
        value: {
          name: 'JOHN',
          address: {
            street: '123 MAIN ST',
            city: 'NEW YORK',
          },
        },
        issues: undefined,
      });
    });

    it('collects nested validation issues with correct paths', () => {
      const addressFields: Record<string, TestInputFieldMapping> = {
        zipCode: createScalarMapping('zip'),
      };

      const mapping = new Map<string, TestInputFieldMapping>([
        ['address', createInputObjectMapping(null, addressFields)],
      ]);

      const mapper = createInputValueMapper(
        mapping as never,
        (val, field, addIssues) => {
          const mockField = field as unknown as TestInputFieldMapping;
          if (mockField.value === 'zip' && String(val).length !== 5) {
            addIssues([{ message: 'Zip code must be 5 digits' } as StandardSchemaV1.Issue]);
          }
          return val;
        },
        (val) => val,
      );

      const result = mapper({
        address: { zipCode: '123' },
      });

      expect(result).toEqual({
        issues: [
          {
            message: 'Zip code must be 5 digits',
            path: ['address', 'zipCode'],
          },
        ],
      });
    });
  });

  describe('array mapping', () => {
    it('maps arrays of input objects', () => {
      const itemMapping = new Map<string, TestInputFieldMapping>([
        ['name', createScalarMapping('string')],
      ]);

      const mapping = new Map<string, TestInputFieldMapping>([
        [
          'items',
          {
            kind: 'InputObject',
            isList: true,
            listDepth: 1,
            config: {},
            value: null,
            fields: {
              configs: {},
              map: itemMapping,
            },
          },
        ],
      ]);

      const mapper = createInputValueMapper(
        mapping as never,
        (val, field) => {
          const mockField = field as unknown as TestInputFieldMapping;
          if (mockField.value === 'string') {
            return String(val).toUpperCase();
          }
          return val;
        },
        (val) => val,
      );

      const result = mapper({
        items: [{ name: 'item1' }, { name: 'item2' }],
      });

      expect(result).toEqual({
        value: {
          items: [{ name: 'ITEM1' }, { name: 'ITEM2' }],
        },
        issues: undefined,
      });
    });

    it('handles null values in arrays', () => {
      const itemMapping = new Map<string, TestInputFieldMapping>([
        ['name', createScalarMapping('string')],
      ]);

      const mapping = new Map<string, TestInputFieldMapping>([
        [
          'items',
          {
            kind: 'InputObject',
            isList: true,
            listDepth: 1,
            config: {},
            value: null,
            fields: {
              configs: {},
              map: itemMapping,
            },
          },
        ],
      ]);

      const mapper = createInputValueMapper(
        mapping as never,
        (val) => val,
        (val) => val,
      );

      const result = mapper({
        items: [{ name: 'item1' }, null, { name: 'item2' }],
      });

      expect(result).toEqual({
        value: {
          items: [{ name: 'item1' }, null, { name: 'item2' }],
        },
        issues: undefined,
      });
    });

    it('collects array validation issues with correct indices', () => {
      const itemMapping = new Map<string, TestInputFieldMapping>([
        ['value', createScalarMapping('positive')],
      ]);

      const mapping = new Map<string, TestInputFieldMapping>([
        [
          'numbers',
          {
            kind: 'InputObject',
            isList: true,
            listDepth: 1,
            config: {},
            value: null,
            fields: {
              configs: {},
              map: itemMapping,
            },
          },
        ],
      ]);

      const mapper = createInputValueMapper(
        mapping as never,
        (val, field, addIssues) => {
          const mockField = field as unknown as TestInputFieldMapping;
          if (mockField.value === 'positive' && Number(val) < 0) {
            addIssues([{ message: 'Must be positive' } as StandardSchemaV1.Issue]);
          }
          return val;
        },
        (val) => val,
      );

      const result = mapper({
        numbers: [{ value: 5 }, { value: -3 }, { value: 10 }, { value: -1 }],
      });

      expect(result).toEqual({
        issues: [
          { message: 'Must be positive', path: ['numbers', 1, 'value'] },
          { message: 'Must be positive', path: ['numbers', 3, 'value'] },
        ],
      });
    });
  });

  describe('nested arrays', () => {
    it('maps nested arrays of scalars', () => {
      const mapping = new Map<string, TestInputFieldMapping>([
        ['matrix', createScalarMapping('number', true, 2)],
      ]);

      const mapper = createInputValueMapper(
        mapping as never,
        (val, field) => {
          const mockField = field as unknown as TestInputFieldMapping;
          if (mockField.value === 'number') {
            return Number(val) * 2;
          }
          return val;
        },
        (val) => val,
      );

      const result = mapper({
        matrix: [
          [1, 2, 3],
          [4, 5, 6],
        ],
      });

      expect(result).toEqual({
        value: {
          matrix: [
            [2, 4, 6],
            [8, 10, 12],
          ],
        },
        issues: undefined,
      });
    });

    it('maps deeply nested arrays (3D)', () => {
      const mapping = new Map<string, TestInputFieldMapping>([
        ['tensor', createScalarMapping('string', true, 3)],
      ]);

      const mapper = createInputValueMapper(
        mapping as never,
        (val, field) => {
          const mockField = field as unknown as TestInputFieldMapping;
          if (mockField.value === 'string') {
            return String(val).toUpperCase();
          }
          return val;
        },
        (val) => val,
      );

      const result = mapper({
        tensor: [
          [
            ['a', 'b'],
            ['c', 'd'],
          ],
          [
            ['e', 'f'],
            ['g', 'h'],
          ],
        ],
      });

      expect(result).toEqual({
        value: {
          tensor: [
            [
              ['A', 'B'],
              ['C', 'D'],
            ],
            [
              ['E', 'F'],
              ['G', 'H'],
            ],
          ],
        },
        issues: undefined,
      });
    });

    it('validates nested arrays with correct paths', () => {
      const mapping = new Map<string, TestInputFieldMapping>([
        ['scores', createScalarMapping('positive', true, 2)],
      ]);

      const mapper = createInputValueMapper(
        mapping as never,
        (val, field, addIssues) => {
          const mockField = field as unknown as TestInputFieldMapping;
          if (mockField.value === 'positive' && Number(val) < 0) {
            addIssues([{ message: 'Must be positive' } as StandardSchemaV1.Issue]);
          }
          return val;
        },
        (val) => val,
      );

      const result = mapper({
        scores: [
          [10, -5, 20],
          [30, 40, -2],
          [-1, 50, 60],
        ],
      });

      expect(result).toEqual({
        issues: [
          { message: 'Must be positive', path: ['scores', 0, 1] },
          { message: 'Must be positive', path: ['scores', 1, 2] },
          { message: 'Must be positive', path: ['scores', 2, 0] },
        ],
      });
    });

    it('handles nested arrays of input objects', () => {
      const itemMapping = new Map<string, TestInputFieldMapping>([
        ['name', createScalarMapping('string')],
        ['value', createScalarMapping('number')],
      ]);

      const mapping = new Map<string, TestInputFieldMapping>([
        [
          'groups',
          {
            kind: 'InputObject',
            isList: true,
            listDepth: 2,
            config: {},
            value: null,
            fields: {
              configs: {},
              map: itemMapping,
            },
          },
        ],
      ]);

      const mapper = createInputValueMapper(
        mapping as never,
        (val, field) => {
          const mockField = field as unknown as TestInputFieldMapping;
          if (mockField.value === 'string') {
            return String(val).toUpperCase();
          }
          if (mockField.value === 'number') {
            return Number(val) * 10;
          }
          return val;
        },
        (val) => val,
      );

      const result = mapper({
        groups: [
          [
            { name: 'item1', value: 1 },
            { name: 'item2', value: 2 },
          ],
          [
            { name: 'item3', value: 3 },
            { name: 'item4', value: 4 },
          ],
        ],
      });

      expect(result).toEqual({
        value: {
          groups: [
            [
              { name: 'ITEM1', value: 10 },
              { name: 'ITEM2', value: 20 },
            ],
            [
              { name: 'ITEM3', value: 30 },
              { name: 'ITEM4', value: 40 },
            ],
          ],
        },
        issues: undefined,
      });
    });

    it('handles null values in nested arrays', () => {
      const mapping = new Map<string, TestInputFieldMapping>([
        ['data', createScalarMapping('string', true, 2)],
      ]);

      const mapper = createInputValueMapper(
        mapping as never,
        (val) => val,
        (val) => val,
      );

      const result = mapper({
        data: [['a', null, 'b'], null, ['c', 'd']],
      });

      expect(result).toEqual({
        value: {
          data: [['a', null, 'b'], null, ['c', 'd']],
        },
        issues: undefined,
      });
    });

    it('applies field validation to the outermost array', () => {
      const mapping = new Map<string, TestInputFieldMapping>([
        ['matrix', createScalarMapping('number', true, 2)],
      ]);

      const mapper = createInputValueMapper(
        mapping as never,
        (val) => val,
        (val, _field, addIssues) => {
          if (Array.isArray(val) && val.length < 2) {
            addIssues([{ message: 'Matrix must have at least 2 rows' } as StandardSchemaV1.Issue]);
          }
          return val;
        },
      );

      const result = mapper({
        matrix: [[1, 2, 3]],
      });

      expect(result).toEqual({
        issues: [{ message: 'Matrix must have at least 2 rows', path: ['matrix'] }],
      });
    });

    it('processes nested arrays with mixed depths', () => {
      const nestedObjFields = new Map<string, TestInputFieldMapping>([
        ['tags', createScalarMapping('string', true, 1)],
      ]);

      const mapping = new Map<string, TestInputFieldMapping>([
        ['data', createScalarMapping('number', true, 2)],
        [
          'metadata',
          {
            kind: 'InputObject',
            isList: false,
            listDepth: 0,
            config: {},
            value: null,
            fields: {
              configs: {},
              map: nestedObjFields,
            },
          },
        ],
      ]);

      const mapper = createInputValueMapper(
        mapping as never,
        (val, field) => {
          const mockField = field as unknown as TestInputFieldMapping;
          if (mockField.value === 'number') {
            return Number(val) + 1;
          }
          if (mockField.value === 'string') {
            return String(val).toLowerCase();
          }
          return val;
        },
        (val) => val,
      );

      const result = mapper({
        data: [
          [1, 2],
          [3, 4],
        ],
        metadata: {
          tags: ['TAG1', 'TAG2', 'TAG3'],
        },
      });

      expect(result).toEqual({
        value: {
          data: [
            [2, 3],
            [4, 5],
          ],
          metadata: {
            tags: ['tag1', 'tag2', 'tag3'],
          },
        },
        issues: undefined,
      });
    });
  });

  describe('async mapping', () => {
    it('handles async value transformations', async () => {
      const mapping = new Map<string, TestInputFieldMapping>([
        ['username', createScalarMapping('username')],
      ]);

      const mapper = createInputValueMapper(
        mapping as never,
        async (val, field) => {
          const mockField = field as unknown as TestInputFieldMapping;
          if (mockField.value === 'username') {
            await new Promise((resolve) => setTimeout(resolve, 1));
            return String(val).toLowerCase();
          }
          return val;
        },
        (val) => val,
      );

      const result = await mapper({ username: 'JOHN_DOE' });
      expect(result).toEqual({
        value: { username: 'john_doe' },
        issues: undefined,
      });
    });

    it('handles async validation', async () => {
      const mapping = new Map<string, TestInputFieldMapping>([
        ['username', createScalarMapping('username')],
      ]);

      const mapper = createInputValueMapper(
        mapping as never,
        async (val, field, addIssues) => {
          const mockField = field as unknown as TestInputFieldMapping;
          if (mockField.value === 'username') {
            await new Promise((resolve) => setTimeout(resolve, 1));
            if (val === 'taken') {
              addIssues([{ message: 'Username is taken' } as StandardSchemaV1.Issue]);
            }
          }
          return val;
        },
        (val) => val,
      );

      const result = await mapper({ username: 'taken' });
      expect(result).toEqual({
        issues: [{ message: 'Username is taken', path: ['username'] }],
      });
    });

    it('processes nested async operations in parallel', async () => {
      const itemMapping = new Map<string, TestInputFieldMapping>([
        ['id', createScalarMapping('async-id')],
      ]);

      const mapping = new Map<string, TestInputFieldMapping>([
        [
          'items',
          {
            kind: 'InputObject',
            isList: true,
            listDepth: 1,
            config: {},
            value: null,
            fields: {
              configs: {},
              map: itemMapping,
            },
          },
        ],
      ]);

      const processOrder: number[] = [];

      const mapper = createInputValueMapper(
        mapping as never,
        async (val, field) => {
          const mockField = field as unknown as TestInputFieldMapping;
          if (mockField.value === 'async-id') {
            const id = Number(val);
            await new Promise((resolve) => setTimeout(resolve, 10 - id));
            processOrder.push(id);
            return val;
          }
          return val;
        },
        (val) => val,
      );

      const result = await mapper({
        items: [{ id: 1 }, { id: 2 }, { id: 3 }],
      });

      expect(result).toEqual({
        value: {
          items: [{ id: 1 }, { id: 2 }, { id: 3 }],
        },
        issues: undefined,
      });

      expect(processOrder.length).toBe(3);
    });
  });

  describe('edge cases', () => {
    it('handles empty objects', () => {
      const mapping = new Map<string, TestInputFieldMapping>();
      const mapper = createInputValueMapper(
        mapping as never,
        (val) => val,
        (val) => val,
      );

      const result = mapper({});
      expect(result).toEqual({
        value: {},
        issues: undefined,
      });
    });

    it('preserves extra fields not in mapping', () => {
      const mapping = new Map<string, TestInputFieldMapping>([
        ['name', createScalarMapping('string')],
      ]);

      const mapper = createInputValueMapper(
        mapping as never,
        (val) => val,
        (val) => val,
      );

      const result = mapper({
        name: 'john',
        age: 30,
        extra: 'data',
      });

      expect(result).toEqual({
        value: {
          name: 'john',
          age: 30,
          extra: 'data',
        },
        issues: undefined,
      });
    });

    it('stops processing subsequent fields after first validation error', () => {
      const mapping = new Map<string, TestInputFieldMapping>([
        ['email', createScalarMapping('email')],
        ['age', createScalarMapping('positive')],
      ]);

      let emailProcessed = false;
      let ageProcessed = false;

      const mapper = createInputValueMapper(
        mapping as never,
        (val, field, addIssues) => {
          const mockField = field as unknown as TestInputFieldMapping;

          if (mockField.value === 'email') {
            emailProcessed = true;
            if (!String(val).includes('@')) {
              addIssues([{ message: 'Invalid email format' } as StandardSchemaV1.Issue]);
            }
          }

          if (mockField.value === 'positive') {
            ageProcessed = true;
            if (Number(val) < 0) {
              addIssues([{ message: 'Must be positive' } as StandardSchemaV1.Issue]);
            }
          }

          return val;
        },
        (val) => val,
      );

      const result = mapper({ email: 'invalid', age: -5 });

      expect(emailProcessed).toBe(true);
      expect(ageProcessed).toBe(false);

      expect(result).toEqual({
        issues: [{ message: 'Invalid email format', path: ['email'] }],
      });
    });

    it('handles deeply nested structures', () => {
      const level3Fields: Record<string, TestInputFieldMapping> = {
        value: createScalarMapping('string'),
      };

      const level2Fields: Record<string, TestInputFieldMapping> = {
        nested: createInputObjectMapping(null, level3Fields),
      };

      const level1Fields: Record<string, TestInputFieldMapping> = {
        data: createInputObjectMapping(null, level2Fields),
      };

      const mapping = new Map<string, TestInputFieldMapping>([
        ['root', createInputObjectMapping(null, level1Fields)],
      ]);

      const mapper = createInputValueMapper(
        mapping as never,
        (val, field) => {
          const mockField = field as unknown as TestInputFieldMapping;
          if (mockField.value === 'string') {
            return String(val).toUpperCase();
          }
          return val;
        },
        (val) => val,
      );

      const result = mapper({
        root: {
          data: {
            nested: {
              value: 'test',
            },
          },
        },
      });

      expect(result).toEqual({
        value: {
          root: {
            data: {
              nested: {
                value: 'TEST',
              },
            },
          },
        },
        issues: undefined,
      });
    });
  });
});
