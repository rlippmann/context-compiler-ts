import foldcase from '@ar-nelson/foldcase';

/** Apply Unicode Default Case Folding (the full, potentially expanding form). */
export function unicodeCaseFold(value: string): string {
  return foldcase.full(value);
}
