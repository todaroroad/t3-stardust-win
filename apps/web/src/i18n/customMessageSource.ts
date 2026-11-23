/** Escape literal punctuation while preserving the legacy {name} interpolation contract. */
export function customMessageSource(source: string): string {
  return source.replace(/'|\{[A-Za-z0-9_]+\}|[{}]/g, (part) =>
    part === "'" ? "''" : part.length > 1 ? part : `'${part}'`,
  );
}
