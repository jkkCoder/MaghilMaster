export async function getChangesSince(database, lastPulledAt) {
    const result = await database.adapter.pullChanges({
      lastPulledAt: lastPulledAt || 0,
      schemaVersion: 1,
    });
    return result; // { changes: {tables}, timestamp }
  }
  
  
  export async function applyRemoteChanges(database, payload) {
    await database.adapter.pushChanges({
      changes: payload.changes,
    });
  }
  