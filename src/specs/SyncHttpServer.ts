import { NativeModules } from 'react-native';

export interface ServerInfo {
  ip: string;
  port: number;
  url: string;
  running: boolean;
  version: string;
  server: string;
}

export interface SyncHttpServerModule {
  startServer(port: number): Promise<ServerInfo>;
  stopServer(): Promise<string>;
  setSyncData(requestId: string, dataJson: string): void;
  isRunning(): Promise<boolean>;
  getServerInfo(): Promise<ServerInfo>;
}

export default NativeModules.SyncHttpServer as SyncHttpServerModule;
