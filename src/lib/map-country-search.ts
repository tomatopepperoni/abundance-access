import { findCountries } from './query';
import type { Country } from './schema';

export const MAP_SEARCH_LIMIT = 6;

// Geometry coverage never limits the country registry used for discovery.
export function searchMapCountries(countries: Country[], search: string) {
  if (!search.trim()) return { countries: [] as Country[], total: 0, remaining: 0 };
  const matches = findCountries(countries, search).sort((a, b) =>
    a.name.localeCompare(b.name, 'en'),
  );
  return {
    countries: matches.slice(0, MAP_SEARCH_LIMIT),
    total: matches.length,
    remaining: Math.max(0, matches.length - MAP_SEARCH_LIMIT),
  };
}
