// Shared dish-name search predicate for the swap (Replace) and add pickers.
// Token-based AND matching: the query is split on whitespace into tokens, and a
// dish matches when EVERY token appears somewhere in its name (each token an
// independent substring), rather than the whole query being one contiguous
// substring. So "thai curry" matches "Thai green curry chicken" even though the
// word "green" sits between the two query words. Matching is case-insensitive,
// and an empty / whitespace-only query matches everything (preserving the
// pristine-list behaviour the pickers rely on).

/** True if every whitespace-separated token of `query` is a substring of `name`. */
export function matchesQuery(name: string, query: string): boolean {
  const tokens = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return true; // empty query -> match all
  const hay = name.toLowerCase();
  return tokens.every((token) => hay.includes(token));
}
