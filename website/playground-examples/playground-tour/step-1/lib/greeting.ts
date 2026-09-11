import type { Context } from '../builder';

// #region greeting
export function greet(name: string, locale: Context['locale']) {
  return `${locale === 'fr' ? 'Bonjour' : 'Hello'}, ${name}!`;
}
// #endregion greeting
