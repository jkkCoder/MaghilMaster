import { Database } from '@nozbe/watermelondb';
import MqttBroker from '../nativeModules/MqttBrokerModule';
import { applyRemoteChanges, getChangesSince } from './watermelonSyncHelpers';

export function setupMasterSync(database: Database) {
  
  // 🔽 Handle PULL request from client
  MqttBroker.subscribe('sync/pull/+', async (topic: string, rawMessage: string) => {
    const [, , clientId] = topic.split('/');
    const { lastPulledAt, syncId } = JSON.parse(rawMessage.toString());

    console.log(`🔽 PULL request from client ${clientId}`);

    const result = await getChangesSince(database, lastPulledAt);

    // Reply directly to client
    MqttBroker.publish(
      `sync/pull/response/${clientId}/${syncId}`,
      JSON.stringify(result)
    );
  });

  // 🔼 Handle PUSH request from client
  MqttBroker.subscribe('sync/push/+', async (topic: string, rawMessage: string) => {
    const [, , clientId] = topic.split('/');
    const { changes, lastPulledAt } = JSON.parse(rawMessage.toString());

    console.log(`🔼 PUSH from client ${clientId}`);

    await applyRemoteChanges(database, { changes, lastPulledAt });

    // Optionally broadcast to other clients
    MqttBroker.publish(
      'sync/broadcast',
      JSON.stringify({ origin: clientId, changes })
    );
  });
}
