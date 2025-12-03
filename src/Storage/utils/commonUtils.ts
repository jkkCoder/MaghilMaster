import { v4 as uuidv4 } from 'uuid';

// unique id using uuidv4 for database id.
export const generateDatabaseUniqueId = () => {
  return uuidv4();
}