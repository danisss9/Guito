/**
 * Normalizes text for search. Insensitive search ignores both letter casing
 * and combining accents; sensitive search preserves the original text.
 */
export function normalizeSearchText(value: string, sensitive: boolean): string {
  if (sensitive) return value;
  return value.normalize('NFD').replace(/\p{M}/gu, '').toLocaleLowerCase();
}
