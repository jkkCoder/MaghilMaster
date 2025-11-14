import { Database } from '@nozbe/watermelondb';
import MqttBroker from '../nativeModules/MqttBrokerModule';
import { applyRemoteChanges, getChangesSince } from './watermelonSyncHelpers';

export function setupMasterSync(database: Database) {
  
  // 🔽 Handle PULL request from client
  MqttBroker.subscribe('sync/pull/+');

  // 🔼 Handle PUSH request from client
  MqttBroker.subscribe('sync/push/+');
}
