/**
 * File system utilities for JSON data persistence.
 * Provides change-detection to avoid unnecessary writes.
 * @module scripts/utils/file-utils
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';

/**
 * Error thrown when file operations fail.
 */
export class FileOperationError extends Error {
  constructor(
    message: string,
    public readonly filePath: string,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = 'FileOperationError';
  }
}

/**
 * Write JSON to file only if content has changed.
 * Prevents unnecessary file modifications that would show up in version control.
 *
 * @param filePath - Path to the JSON file
 * @param data - Data to serialize and write
 * @returns true if file was written, false if unchanged
 * @throws {FileOperationError} If file read or write fails
 */
export function writeJsonIfChanged(filePath: string, data: unknown): boolean {
  let newContent: string;
  try {
    newContent = JSON.stringify(data, null, 2);
  } catch (err) {
    throw new FileOperationError(
      `Failed to serialize data for ${filePath}`,
      filePath,
      err instanceof Error ? err : undefined
    );
  }

  try {
    if (existsSync(filePath)) {
      const existingContent = readFileSync(filePath, 'utf-8');
      if (existingContent === newContent) {
        return false;
      }
    }
  } catch (err) {
    throw new FileOperationError(
      `Failed to read existing file ${filePath}`,
      filePath,
      err instanceof Error ? err : undefined
    );
  }

  try {
    writeFileSync(filePath, newContent);
    return true;
  } catch (err) {
    throw new FileOperationError(
      `Failed to write file ${filePath}`,
      filePath,
      err instanceof Error ? err : undefined
    );
  }
}
