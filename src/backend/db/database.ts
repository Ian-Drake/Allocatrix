import sqlite3 from 'sqlite3';
import path from 'path';
import fs from 'fs';

const dbPath = process.env.DATABASE_URL || 'data/allocatrix.db';
// Remove file: protocol if present
const cleanPath = dbPath.replace(/^file:/, '');
// Resolve to absolute path from project root
const filePath = path.isAbsolute(cleanPath)
  ? cleanPath
  : path.join(process.cwd(), cleanPath);

// Ensure data directory exists
const dataDir = path.dirname(filePath);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

let db: sqlite3.Database | null = null;

/**
 * Get or create the database connection
 */
export function getDatabase(): sqlite3.Database {
  if (!db) {
    db = new sqlite3.Database(filePath, (err) => {
      if (err) {
        // eslint-disable-next-line no-console
        console.error('Failed to connect to database:', err);
        process.exit(1);
      }
      // eslint-disable-next-line no-console
      console.log('Connected to SQLite database at', filePath);
    });

    // Enable foreign keys
    db.run('PRAGMA foreign_keys = ON');
  }

  return db;
}

/**
 * Run a query and return a promise
 */
export function runAsync(query: string, params: unknown[] = []): Promise<void> {
  return new Promise((resolve, reject) => {
    const database = getDatabase();
    database.run(query, params, function (err) {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  });
}

/**
 * Get a single row
 */
export function getAsync<T = Record<string, unknown>>(
  query: string,
  params: unknown[] = []
): Promise<T | undefined> {
  return new Promise((resolve, reject) => {
    const database = getDatabase();
    database.get(query, params, (err, row) => {
      if (err) {
        reject(err);
      } else {
        resolve(row as T | undefined);
      }
    });
  });
}

/**
 * Get all rows
 */
export function allAsync<T = Record<string, unknown>>(
  query: string,
  params: unknown[] = []
): Promise<T[]> {
  return new Promise((resolve, reject) => {
    const database = getDatabase();
    database.all(query, params, (err, rows) => {
      if (err) {
        reject(err);
      } else {
        resolve((rows as T[]) || []);
      }
    });
  });
}

/**
 * Close the database connection
 */
export function closeDatabase(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (db) {
      db.close((err) => {
        if (err) {
          reject(err);
        } else {
          db = null;
          // eslint-disable-next-line no-console
          console.log('Database connection closed');
          resolve();
        }
      });
    } else {
      resolve();
    }
  });
}

/**
 * Execute a transaction
 */
export async function transaction<T>(
  callback: (db: sqlite3.Database) => Promise<T>
): Promise<T> {
  const database = getDatabase();

  try {
    await runAsync('BEGIN TRANSACTION');
    const result = await callback(database);
    await runAsync('COMMIT');
    return result;
  } catch (error) {
    await runAsync('ROLLBACK');
    throw error;
  }
}
