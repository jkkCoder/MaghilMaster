import { Q } from '@nozbe/watermelondb';
import { database } from './database';

const keyValuesCollection = database.collections.get('app_pref');

function withCallback(promise, callback) {
  if (typeof callback === 'function') {
    promise.then(result => callback(null, result)).catch(err => callback(err));
  }
  return promise;
}

// ----------------------- safeWrite instrumentation -----------------------
async function safeWrite(name, fn) {
  const start = Date.now();
  try {
    // console.log(`[🍉] writer start: ${name} ${new Date(start).toISOString()}`);
    const result = await database.write(fn);
    const took = Date.now() - start;
    // console.log(`[🍉] writer end: ${name} (ms: ${took})`);
    return result;
  } catch (err) {
    const took = Date.now() - start;
    // console.error(`[🍉] writer error: ${name} (ms: ${took})`, err);
    throw err;
  }
}

// ----------------------- batching helpers -----------------------
// Coalesces rapid setItem/multiSet calls within FLUSH_DELAY_MS into a single writer.
const pendingWrites = new Map(); // key -> { value, resolvers: [fn], rejecters: [fn] }
let flushHandle = null;
const FLUSH_DELAY_MS = 30; // tune this: small window to coalesce writes

function scheduleFlush() {
  if (flushHandle) return;
  flushHandle = setTimeout(() => {
    flushHandle = null;
    flushPendingWrites();
  }, FLUSH_DELAY_MS);
}

async function flushPendingWrites() {
  if (pendingWrites.size === 0) return;

  // Snapshot and clear pendingWrites so new requests can be accepted while flushing
  const snapshotEntries = Array.from(pendingWrites.entries()); // [ [key, {...}] , ... ]
  pendingWrites.clear();

  // Build key list + entries for writes
  const entries = snapshotEntries.map(([key, payload]) => [key, payload.value]);
  const keys = entries.map(([k]) => k);

  try {
    await safeWrite(`batchedSet:${keys.join(',')}`, async () => {
      // Fetch existing for all keys in one go
      const existingRecords = await keyValuesCollection
        .query(Q.where('key', Q.oneOf(keys)))
        .fetch();

      const existingMap = new Map(existingRecords.map(r => [r.key, r]));

      for (const [key, value] of entries) {
        const rec = existingMap.get(key);
        if (rec) {
          // update
          await rec.update(r => {
            r.value = value;
          });
        } else {
          // create
          await keyValuesCollection.create(r => {
            r.key = key;
            r.value = value;
          });
        }
      }
    });

    // Resolve per-key promises with the final value
    for (const [key, payload] of snapshotEntries) {
      const { value, resolvers = [] } = payload;
      for (const res of resolvers) {
        try {
          res(value);
        } catch (e) {
          // ignore per-resolver error
          console.warn('[Storage] resolver callback error', e);
        }
      }
    }
  } catch (err) {
    // Reject per-key promises
    for (const [, payload] of snapshotEntries) {
      const { rejecters = [] } = payload;
      for (const rej of rejecters) {
        try {
          rej(err);
        } catch (e) {
          console.warn('[Storage] rejecter callback error', e);
        }
      }
    }
    // rethrow so any top-level callers can see it if needed
    throw err;
  }
}

// ----------------------- Storage functions -----------------------

/**
 * setItem: batched. Returns a promise that resolves with the value.
 * Callback compatibility maintained.
 */
function setItem(key, value, callback) {
  const promise = new Promise((resolve, reject) => {
    const existing = pendingWrites.get(key);
    if (existing) {
      // coalesce: last write wins
      existing.value = value;
      existing.resolvers.push(resolve);
      existing.rejecters.push(reject);
    } else {
      pendingWrites.set(key, {
        value,
        resolvers: [resolve],
        rejecters: [reject],
      });
    }
    scheduleFlush();
  });

  // Keep callback behavior consistent: resolve returns the value
  return withCallback(promise, callback);
}

/**
 * getItem: simple read
 */
function getItem(key, callback) {
  const task = (async () => {
    const existing = await keyValuesCollection.query(Q.where('key', key)).fetch();
    return existing.length > 0 ? existing[0].value : null;
  })();

  return withCallback(task, callback);
}

/**
 * multiSet: adds each pair into pendingWrites so they will be flushed together.
 * Returns a promise that resolves when the batch containing these keys has flushed.
 */
function multiSet(keyValuePairs, callback) {
  const promise = (async () => {
    if (!Array.isArray(keyValuePairs) || keyValuePairs.length === 0) return;

    // create per-key promises and insert into pendingWrites
    const perKeyPromises = keyValuePairs.map(([key, value]) => new Promise((res, rej) => {
      const existing = pendingWrites.get(key);
      if (existing) {
        existing.value = value;
        existing.resolvers.push(res);
        existing.rejecters.push(rej);
      } else {
        pendingWrites.set(key, {
          value,
          resolvers: [res],
          rejecters: [rej],
        });
      }
    }));

    scheduleFlush();

    // Wait for all per-key promises (resolved when flush completes)
    await Promise.all(perKeyPromises);
  })();

  return withCallback(promise, callback);
}

/**
 * multiGet: optimized single query for keys
 */
function multiGet(keys, callback) {
  const task = (async () => {
    if (!Array.isArray(keys) || keys.length === 0) {
      return keys.map(k => [k, null]);
    }

    const records = await keyValuesCollection
      .query(Q.where('key', Q.oneOf(keys)))
      .fetch();

    const lookup = new Map(records.map(r => [r.key, r.value]));
    return keys.map(key => [key, lookup.get(key) ?? null]);
  })();

  return withCallback(task, callback);
}

/**
 * removeItem: keep behavior but ensure destructive operation inside safeWrite
 */
function removeItem(key, callback) {
  const task = (async () => {
    const existing = await keyValuesCollection.query(Q.where('key', key)).fetch();
    if (existing.length > 0) {
      await safeWrite(`removeItem:${key}`, async () => {
        await existing[0].destroyPermanently();
      });
    }
  })();

  return withCallback(task, callback);
}

/**
 * multiRemove: remove multiple keys with a single writer
 */
function multiRemove(keys, callback) {
  const task = (async () => {
    if (!Array.isArray(keys) || keys.length === 0) return;

    const records = await keyValuesCollection
      .query(Q.where('key', Q.oneOf(keys)))
      .fetch();

    if (records.length > 0) {
      await safeWrite(`multiRemove:${keys.join(',')}`, async () => {
        for (const record of records) {
          await record.destroyPermanently();
        }
      });
    }
  })();

  return withCallback(task, callback);
}

/**
 * clear: fetch all then delete inside one write
 */
function clear(callback) {
  const task = (async () => {
    const all = await keyValuesCollection.query().fetch();
    if (all.length === 0) return;

    await safeWrite('clear:app_pref', async () => {
      for (const record of all) {
        await record.destroyPermanently();
      }
    });
  })();

  return withCallback(task, callback);
}

/**
 * getAllKeys: read-only
 */
function getAllKeys(callback) {
  const task = (async () => {
    const all = await keyValuesCollection.query().fetch();
    return all.map(r => r.key);
  })();

  return withCallback(task, callback);
}

/**
 * isAppPrefEmpty: lightweight check using fetchCount()
 */
async function isAppPrefEmpty() {
  try {
    const count = await keyValuesCollection.query().fetchCount();
    return count === 0;
  } catch (err) {
    // fallback
    const all = await keyValuesCollection.query().fetch();
    return all.length === 0;
  }
}

export const Storage = {
  setItem,
  getItem,
  multiSet,
  multiGet,
  removeItem,
  multiRemove,
  clear,
  getAllKeys,
  isAppPrefEmpty,
};
