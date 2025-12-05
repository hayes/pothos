'use client';

import type { Fetcher } from '@graphiql/toolkit';
import { GraphiQL } from 'graphiql';
import { graphql, type GraphQLSchema } from 'graphql';
import 'graphiql/style.css';
import { useMemo, useRef } from 'react';

interface GraphiQLPanelProps {
  schema: GraphQLSchema | null;
  defaultQuery?: string;
}

function createFetcher(schema: GraphQLSchema): Fetcher {
  return async ({ query, variables, operationName }) => {
    const result = await graphql({
      schema,
      source: query,
      variableValues: variables,
      operationName,
    });
    return result;
  };
}

export function GraphiQLPanel({ schema, defaultQuery }: GraphiQLPanelProps) {
  const schemaVersionRef = useRef(0);
  const prevSchemaRef = useRef<GraphQLSchema | null>(null);

  if (schema !== prevSchemaRef.current) {
    prevSchemaRef.current = schema;
    schemaVersionRef.current += 1;
  }

  const fetcher = useMemo(() => {
    if (!schema) {
      return null;
    }
    return createFetcher(schema);
  }, [schema]);

  if (!schema || !fetcher) {
    return (
      <div className="flex h-full items-center justify-center text-fd-muted-foreground">
        {schema === null ? 'Compiling schema...' : 'Invalid schema'}
      </div>
    );
  }

  return (
    <div className="playground-graphiql h-full">
      <GraphiQL
        key={schemaVersionRef.current}
        fetcher={fetcher}
        defaultQuery={defaultQuery}
        schema={schema}
      />
    </div>
  );
}
