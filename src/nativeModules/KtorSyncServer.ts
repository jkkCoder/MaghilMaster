import { NativeEventEmitter } from 'react-native';
import NativeKtorSyncServer from '../specs/SyncHttpServer';

export const syncServerEmitter = new NativeEventEmitter(NativeKtorSyncServer as any);

export default NativeKtorSyncServer;

