import type { TableSchema } from '@nozbe/watermelondb/Schema';

export type SchemaModule = {
  readonly name: string;
  readonly tables: ReadonlyArray<TableSchema>;
};


