import { Cardinality, LinkDesc } from '../types';

export function isMultiLink(field: LinkDesc): boolean {
  return field.cardinality === Cardinality.Many || field.cardinality === Cardinality.AtLeastOne;
}
