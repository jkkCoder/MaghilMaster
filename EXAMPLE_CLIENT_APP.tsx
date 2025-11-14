/**
 * EXAMPLE CLIENT APP
 * 
 * This is a complete example of how to integrate a client device
 * with the MaghilMaster server.
 * 
 * Copy this code to your client app and modify as needed.
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Button,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  TouchableOpacity,
  Alert
} from 'react-native';

// Import the sync managers (copy these files to your client app)
import { 
  initializeClientSync, 
  syncWithMaster, 
  getMasterInfo,
  setMasterURL 
} from './src/sync/ClientSyncManager';

// Import your database
import { database } from './src/database';

// Import MQTT module
import MqttBroker from './src/nativeModules/MqttBrokerModule';

const ClientApp = () => {
  const [syncing, setSyncing] = useState(false);
  const [masterInfo, setMasterInfo] = useState(getMasterInfo());
  const [syncHistory, setSyncHistory] = useState<string[]>([]);
  const [ordersCount, setOrdersCount] = useState(0);
  const [productsCount, setProductsCount] = useState(0);

  // Initialize client on startup
  useEffect(() => {
    initializeClient();
  }, []);

  // Update master info periodically
  useEffect(() => {
    const interval = setInterval(() => {
      setMasterInfo(getMasterInfo());
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  // Load data counts
  useEffect(() => {
    loadDataCounts();
    const interval = setInterval(loadDataCounts, 5000);
    return () => clearInterval(interval);
  }, []);

  const initializeClient = async () => {
    try {
      console.log('📱 Initializing client device...');
      
      // Option 1: Auto-discovery (recommended)
      // Just call this and wait for master to announce itself
      initializeClientSync(database);
      addToHistory('✅ Client initialized - waiting for master...');
      
      // Option 2: Manual IP (if you know the master IP)
      // Uncomment and replace with your master IP if auto-discovery doesn't work
      // await connectToMasterManually('192.168.1.100');
      
    } catch (error) {
      console.error('❌ Initialization error:', error);
      addToHistory('❌ Initialization failed: ' + error.message);
    }
  };

  const connectToMasterManually = async (masterIP: string) => {
    try {
      addToHistory(`🔌 Connecting to master at ${masterIP}...`);
      
      // Connect to MQTT broker
      await MqttBroker.connectToBroker(`tcp://${masterIP}:1883`);
      addToHistory('✅ Connected to MQTT');
      
      // Set master URL
      setMasterURL(`http://${masterIP}:3001`);
      addToHistory('✅ Master URL set');
      
      // Initialize sync
      initializeClientSync(database);
      addToHistory('✅ Sync initialized');
      
    } catch (error) {
      addToHistory('❌ Connection failed: ' + error.message);
      throw error;
    }
  };

  const handleSync = async () => {
    if (!masterInfo.connected) {
      Alert.alert('Error', 'Master server not discovered yet');
      return;
    }

    setSyncing(true);
    addToHistory('🔄 Starting sync...');
    
    try {
      await syncWithMaster(database);
      addToHistory('✅ Sync complete!');
      await loadDataCounts();
      Alert.alert('Success', 'Data synchronized successfully!');
    } catch (error) {
      console.error('Sync error:', error);
      addToHistory('❌ Sync failed: ' + error.message);
      Alert.alert('Error', 'Sync failed: ' + error.message);
    } finally {
      setSyncing(false);
    }
  };

  const loadDataCounts = async () => {
    try {
      const orders = await database.get('mh_off_orders').query().fetch();
      const products = await database.get('mh_products').query().fetch();
      setOrdersCount(orders.length);
      setProductsCount(products.length);
    } catch (error) {
      console.error('Error loading counts:', error);
    }
  };

  const addToHistory = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setSyncHistory(prev => [`[${timestamp}] ${message}`, ...prev.slice(0, 9)]);
  };

  const testConnection = async () => {
    if (!masterInfo.url) {
      Alert.alert('Error', 'Master URL not known');
      return;
    }

    addToHistory('🔍 Testing connection...');
    
    try {
      const response = await fetch(`${masterInfo.url}/health`);
      const data = await response.json();
      
      addToHistory(`✅ Connected to: ${data.device}`);
      Alert.alert('Success', `Connected to: ${data.device}\nServer: ${data.server}`);
    } catch (error) {
      addToHistory('❌ Connection test failed');
      Alert.alert('Error', 'Cannot reach master server');
    }
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Client Device</Text>
      
      {/* Master Status */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Master Server Status</Text>
        <View style={styles.statusRow}>
          <Text style={styles.label}>Connected:</Text>
          <Text style={masterInfo.connected ? styles.connected : styles.disconnected}>
            {masterInfo.connected ? '✅ Yes' : '❌ No'}
          </Text>
        </View>
        <View style={styles.statusRow}>
          <Text style={styles.label}>URL:</Text>
          <Text style={styles.value}>
            {masterInfo.url || 'Discovering...'}
          </Text>
        </View>
        <View style={styles.statusRow}>
          <Text style={styles.label}>IP:</Text>
          <Text style={styles.value}>
            {masterInfo.ip || 'Unknown'}
          </Text>
        </View>
      </View>

      {/* Data Status */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Local Data</Text>
        <View style={styles.statusRow}>
          <Text style={styles.label}>Orders:</Text>
          <Text style={styles.value}>{ordersCount}</Text>
        </View>
        <View style={styles.statusRow}>
          <Text style={styles.label}>Products:</Text>
          <Text style={styles.value}>{productsCount}</Text>
        </View>
      </View>

      {/* Actions */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Actions</Text>
        
        <TouchableOpacity
          style={[
            styles.button,
            styles.syncButton,
            (!masterInfo.connected || syncing) && styles.buttonDisabled
          ]}
          onPress={handleSync}
          disabled={!masterInfo.connected || syncing}
        >
          {syncing ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>
              🔄 Sync with Master
            </Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.button,
            styles.testButton,
            !masterInfo.url && styles.buttonDisabled
          ]}
          onPress={testConnection}
          disabled={!masterInfo.url}
        >
          <Text style={styles.buttonText}>
            🔍 Test Connection
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.refreshButton]}
          onPress={loadDataCounts}
        >
          <Text style={styles.buttonText}>
            🔃 Refresh Counts
          </Text>
        </TouchableOpacity>
      </View>

      {/* Sync History */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Sync History</Text>
        {syncHistory.length === 0 ? (
          <Text style={styles.emptyText}>No sync activity yet</Text>
        ) : (
          syncHistory.map((item, index) => (
            <Text key={index} style={styles.historyItem}>
              {item}
            </Text>
          ))
        )}
      </View>

      {/* Manual Connection (if auto-discovery fails) */}
      {!masterInfo.connected && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Manual Connection</Text>
          <Text style={styles.helpText}>
            If auto-discovery doesn't work, uncomment the manual connection code in initializeClient()
            and set your master device IP address.
          </Text>
          <Text style={styles.codeExample}>
            Example: 192.168.1.100
          </Text>
        </View>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    padding: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 20,
    textAlign: 'center',
  },
  section: {
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 10,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  label: {
    fontSize: 14,
    color: '#666',
    fontWeight: '600',
  },
  value: {
    fontSize: 14,
    color: '#333',
  },
  connected: {
    fontSize: 14,
    color: '#4CAF50',
    fontWeight: 'bold',
  },
  disconnected: {
    fontSize: 14,
    color: '#f44336',
    fontWeight: 'bold',
  },
  button: {
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 10,
  },
  syncButton: {
    backgroundColor: '#2196F3',
  },
  testButton: {
    backgroundColor: '#FF9800',
  },
  refreshButton: {
    backgroundColor: '#4CAF50',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  historyItem: {
    fontSize: 12,
    color: '#555',
    paddingVertical: 4,
    fontFamily: 'monospace',
  },
  emptyText: {
    fontSize: 14,
    color: '#999',
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: 10,
  },
  helpText: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
    marginBottom: 10,
  },
  codeExample: {
    fontSize: 14,
    fontFamily: 'monospace',
    backgroundColor: '#f0f0f0',
    padding: 10,
    borderRadius: 5,
    color: '#333',
  },
});

export default ClientApp;

