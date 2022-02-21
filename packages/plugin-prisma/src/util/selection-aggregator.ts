import type { DMMF } from '@prisma/generator-helper';
import { deepEqual } from '.';

import { SelectionMap } from '..';

export type SelectionMode = 'select' | 'include';

export class SelectionAggregator {
  mode: SelectionMode;
  fields = new Set<string>();
  counts = new Set<string>();
  relations = new Map<string, SelectionAggregator>();
  query: object;
  model: DMMF.Model;
  relationNames: Set<string>;

  constructor(selection: SelectionMap, model: DMMF.Model) {
    const { include, select, ...query } = selection;

    this.mode = include ? 'include' : (select && 'select') || 'include';
    this.query = query;
    this.model = model;
    this.relationNames = new Set(
      model.fields.filter((field) => field.kind === 'object').map((field) => field.name),
    );

    this.merge(selection);
  }

  merge({ select, include, ...query }: SelectionMap) {
    if (this.mode === 'select' && include) {
      this.mode = 'include';
    }

    if (include) {
      Object.keys(include).forEach((key) => {
        if (!include[key]) {
          return;
        }

        const selection = include[key] === true ? {} : (include[key] as SelectionMap);

        if (this.relations.has(key)) {
          this.relations.get(key)!.merge(selection);
        } else {
          const modelName = this.model.fieldMap![key]!.type as string;

          this.relations.set(
            key,
            new SelectionAggregator(selection, this.model.fieldMap![key]!.type),
          );
        }
      });
    }
  }

  compatible(selectionMap: SelectionMap | boolean): boolean {
    if (typeof selectionMap === 'boolean') {
      return this.queryCompatible(selectionMap);
    }

    const { select, include, ...query } = selectionMap;

    if (
      select &&
      Object.keys(select).some(
        (key) =>
          select[key] &&
          this.relations.has(key) &&
          this.relations.get(key)!.compatible(select[key]),
      )
    ) {
      return false;
    }

    if (
      include &&
      Object.keys(include).some(
        (key) =>
          include[key] &&
          this.relations.has(key) &&
          this.relations.get(key)!.compatible(include[key]),
      )
    ) {
      return false;
    }

    return this.queryCompatible(query);
  }

  queryCompatible(query: boolean | object) {
    if (!query) {
      return true;
    }

    if (query === true) {
      return Object.keys(this.query).length === 0;
    }

    return deepEqual(query, this.query);
  }
}
