import { loadCategoryConfig } from '../utils/categories';

/** Get all default category IDs for initial state */
export async function getDefaultCategoryIds(): Promise<string[]> {
  const config = await loadCategoryConfig();
  return config.aggregations
    .filter((agg) => agg.includeByDefault)
    .map((agg) => agg.id);
}
