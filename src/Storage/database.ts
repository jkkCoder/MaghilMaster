import { Database } from '@nozbe/watermelondb';
import SQLiteAdapter from '@nozbe/watermelondb/adapters/sqlite';
// import { migrations } from '@nozbe/watermelondb/Schema/migrations';

import { mySchema } from './schema/index';
import { allModels } from './models';

// Define migrations


const adapter = new SQLiteAdapter({
  schema: mySchema,
  // migrations: myMigrations,
});

export const database = new Database({
  adapter,
  modelClasses: allModels,
});