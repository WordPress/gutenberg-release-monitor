import { readFileSync, writeFileSync, existsSync } from 'node:fs';

/**
 * Write JSON to file only if content has changed.
 * Prevents unnecessary file modifications that would show up in version control.
 *
 * @param filePath - Path to the JSON file
 * @param data - Data to serialize and write
 * @returns true if file was written, false if unchanged
 */
export function writeJsonIfChanged(filePath: string, data: unknown): boolean {
  const newContent = JSON.stringify(data, null, 2);

  if (existsSync(filePath)) {
    const existingContent = readFileSync(filePath, 'utf-8');
    if (existingContent === newContent) {
      return false;
    }
  }

  writeFileSync(filePath, newContent);
  return true;
}
