import React, { useState } from 'react';
import { AppState, NativeEventEmitter, SafeAreaView, View, Text, FlatList, StyleSheet, TouchableOpacity } from 'react-native';
import MqttBroker from './src/nativeModules/MqttBrokerModule';
import { Q } from '@nozbe/watermelondb';
import { Provider, useDispatch } from 'react-redux';
import { getPrinters } from './src/api/printer/printerActions';
import { Store } from './src/api/configureStore';
import Routes from './src/Navigator';
import OrderScreen from './src/screens/OrderScreen';
import ProductScreen from './src/screens/ProductScreen';
import { startMasterSync } from './src/sync/MasterSyncManager';
import { insertOrderFromJSON } from './src/utils/orderUtils';
import { database } from './src/Storage/database';
import { applyRemoteChanges, getChangesSince } from './src/utils/watermelon-helper';
import Order from './src/models/Order';

export const mock = {
  "orderId": "9c20d582-5eed-4386-8adc-a49aead5f262",
  "orderNo": "ORD-001",
  "fullName": "John Doe",
  "phone": "+1234567890",
  "orderTypeId": "dine-in",
  "orderTotal": 16.62,
  "orderTime": "2025-10-07T05:45:00Z",
  "discount": 0,
  "discountType": "none",
  "items": [
    {
      "id": "36c1440d-e171-46c6-b8ff-d439f053edb8",
      "itemId": "01999f00-840a-7a9a-9ae7-85ea1b3518fe",
      "customerId": null,
      "cuisineId": null,
      "categoryId": "ffb02757-7c75-46b1-b0aa-97dd32132ffa",
      "categoryName": "Tea",
      "subCategoryId": "d2f5bd1e-d61b-40ab-85d2-3cf906c0e41c",
      "subCategoryName": "SGDSG",
      "itemName": "Datacap 15.11",
      "orderItemId": "36c1440d-e171-46c6-b8ff-d439f053edb8",
      "itemAltName": "",
      "quantity": "1",
      "initialQuantity": "1",
      "price": 15.11,
      "subTotal": "15.11",
      "comment": "",
      "cancelReason": null,
      "taxFees": "1.5110",
      "classesPerMonth": null,
      "startDate": null,
      "endDate": null,
      "durationOfClasses": null,
      "totalClasses": null,
      "isItemModified": null,
      "masterKOT": true,
      "stationKOT": false,
      "orderId": "9c20d582-5eed-4386-8adc-a49aead5f262",
      "options": [],
      "isCompOff": null,
      "isHold": null,
      "sortOrder": 649,
      "status": null,
      "timeIn": null,
      "isWeightBased": false,
      "priceUnit": null,
      "name": null,
      "isCustomizationItem": null
    }
  ],
  "totals": [
    {
      "id": "5cf391f2-4831-4ce9-b944-c433d78aeec9",
      "code": "1.0",
      "title": "Item Total",
      "value": "15.11",
      "sortOrder": "1"
    },
    {
      "id": "9a0c2532-f22e-4438-8f12-0a7ee9db1803",
      "code": "2.0",
      "title": "Tax",
      "value": "1.51",
      "sortOrder": "2"
    },
    {
      "id": "dcf07082-3869-4009-9b35-f2664af6e88e",
      "code": "8.0",
      "title": "Gratuity",
      "value": "0.00",
      "sortOrder": "3"
    },
    {
      "id": "f9c527bd-0508-41d7-9607-3c6320bfa30d",
      "code": "3.0",
      "title": "Tip",
      "value": "0.00",
      "sortOrder": "6"
    },
    {
      "id": "2fb5a381-e04d-45fc-9497-28e3bdf46c24",
      "code": "6.0",
      "title": "Discount",
      "value": "0.00",
      "sortOrder": "7"
    },
    {
      "id": "522904f7-ee1d-4ae4-9cca-6d3cbf2b9ac7",
      "code": "5.0",
      "title": "Grand Total",
      "value": "16.62",
      "sortOrder": "9"
    }
  ],
  "transactions": [
    {
      "id": "bff7b44c-85b9-4930-93c6-97df9551895b",
      "locationId": "d15139f6-ea2b-4b4c-8541-7a9112bfd8bf",
      "paymentProviderId": "OFFLINE_CASH_TRANSACTION",
      "orderId": "9c20d582-5eed-4386-8adc-a49aead5f262",
      "message": "Offline Payment is initiated",
      "request": "{\"tokenExpired\":false,\"tipAmount\":0.0,\"discountAmount\":0.0}",
      "response": null,
      "statusCode": "25",
      "authorizationCode": null,
      "transactionAmount": 16.62,
      "amountTendered": 16.62,
      "tenderType": "POS",
      "transactionType": null,
      "cardName": null,
      "cardType": null,
      "cardLast4": null,
      "cardInfo": null,
      "createdTime": "10/07/2025 - 05:45AM",
      "modifiedTime": "10/07/2025 - 10:45AM",
      "sortedTime": null
    }
  ]
}

const mqttEmitter = new NativeEventEmitter(MqttBroker);

const AppContent = () => {
  const [watermelonOrders, setWatermelonOrders] = React.useState<Order[]>([]);
  const dispatch = useDispatch()

  const [activeTab, setActiveTab] = useState<'orders' | 'products'>('orders');

  // Track processed messages to prevent duplicates
  const processedMessages = React.useRef(new Set<string>()).current;
  // Handle AppState changes
  React.useEffect(() => {
    const handleAppStateChange = (nextAppState: string) => {
      console.log('📱 App state changed to:', nextAppState);

      if (nextAppState === 'background' || nextAppState === 'inactive') {
        console.log('🔄 App going to background - MQTT service continues running');
      } else if (nextAppState === 'active') {
        console.log('🔄 App coming to foreground - checking MQTT service status');
        MqttBroker.isBackgroundServiceRunning()
          .then((isRunning: boolean) => {
            if (!isRunning) {
              console.log('⚠️ MQTT service not running, restarting...');
              MqttBroker.startBackgroundService();
            } else {
              console.log('✅ MQTT service is running');
            }
          })
          .catch((error: any) => console.error('❌ Error checking MQTT service:', error));
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription.remove();
  }, []);

  // Initialize Master Sync System (MQTT + HTTP Server)
  React.useEffect(() => {
    (async () => {
      console.log('🚀 Initializing Master Device...');

      // Start MQTT background service
      MqttBroker.startBackgroundService();
      await new Promise(resolve => setTimeout(resolve, 1000));

      console.log('🖥️ Starting MQTT broker...');
//       await MqttBroker.startBroker();
//       setupMasterSync(database);
//       MqttBroker.subscribe('test/topic');
//       MqttBroker.subscribe('sync/request');

      // Start hybrid sync system (MQTT + HTTP)
      try {
        const serverInfo = await startMasterSync();
        console.log('✅ Master device ready!');
        console.log('   MQTT Broker: tcp://127.0.0.1:1883');
        console.log('   HTTP Server:', serverInfo.url);
        // MqttBroker.subscribe('sync/pull/+');
        // MqttBroker.subscribe('sync/push/+');
        MqttBroker.subscribe('offline_events');
      } catch (error) {
        console.error('❌ Master initialization failed:', error);
      }
    })();

    return () => console.log('🔄 App cleanup - services continue in background');
  }, []);

  // MQTT message handling with chunk support
  React.useEffect(() => {
    const chunkBuffer: Record<
      string,
      { chunks: string[]; total: number; timeoutId: NodeJs.Timeout }
    > = {};

    const MAX_PROCESSED_MESSAGES = 1000;
    const cleanProcessedMessages = () => {
      if (processedMessages.size > MAX_PROCESSED_MESSAGES) processedMessages.clear();
    };

    const handleFullMessage = async (topic: string, msg: any) => {
      console.log("topic, msg", topic, " ", msg);
      const parsedJson = JSON.parse(msg);
      const actualTopic = parsedJson.topic;
      const actualMessage = parsedJson.message;
      const fromDeviceId = parsedJson.fromDeviceId;

      cleanProcessedMessages();
      if (actualTopic === 'order/data') {
        try {
          const orderData = actualMessage
          const messageId = `${orderData.orderId}-${orderData.orderNo || 'no-number'}`;

          if (processedMessages.has(messageId)) {
            console.log(`🚫 Duplicate message skipped: ${orderData.orderId}`);
            return;
          }

          processedMessages.add(messageId);
          console.log('🔄 Processing order:', orderData.orderId);
          await insertOrderFromJSON(orderData);
          console.log('✅ Order saved:', orderData.orderId);

          // // Verify
          // const foundOrders = await database
          //   .get('mh_nxt_orders')
          //   .query(Q.where('order_id', orderData.orderId))
          //   .fetch();
          // if (foundOrders.length > 0) console.log('✅ Order confirmed in DB:', orderData.orderId);
          // else console.error('❌ Order not found after save');

          // Remove after 1 min
          setTimeout(() => processedMessages.delete(messageId), 60 * 1000);
        } catch (err) {
          console.error('❌ Error processing MQTT message:', err);
        }
      } else if (actualTopic === 'sync/request') {
        try {
          console.log('🔁 Sync request received');
          // const orderIds = await getAllOrderIds();
          // const safeOrders = orderIds.map(id => ({ orderId: id }));
          // await sendSyncData(safeOrders);
        } catch (err) {
          console.error('❌ Error handling sync request:', err);
        }
      } else if (actualTopic.startsWith('sync/pull/')) {
        const [, , clientId] = topic.split('/');
        const { lastPulledAt, syncId } = JSON.parse(actualMessage.toString());

        console.log(`🔽 PULL request from client ${clientId}`);

        const result = await getChangesSince(database, lastPulledAt);

        // Reply directly to client
        MqttBroker.publish(
          `sync/pull/response/${clientId}/${syncId}`,
          JSON.stringify(result)
        );
      } else if (actualTopic.startsWith('sync/push/')) {
        const [, , clientId] = topic.split('/');
        const { changes, lastPulledAt } = JSON.parse(actualMessage.toString());

        console.log(`🔼 PUSH from client ${clientId}`);

        await applyRemoteChanges(database, { changes, lastPulledAt });

        // Optionally broadcast to other clients
        MqttBroker.publish(
          'sync/broadcast',
          JSON.stringify({ origin: clientId, changes })
        );
      }
    };

    const messageListener = mqttEmitter.addListener('mqtt_message', async (data) => {
      const [topic, msg] = data.split('|');

      console.log("topic, msg", topic, " ", msg);
      if (!msg.startsWith('chunk:')) {
        await handleFullMessage(topic, msg);
        return;
      }

      // Chunked messages
      const match = msg.match(/^chunk:(\d+)\/(\d+)\|(.*)$/s);
      if (!match) return;
      const [, partNoStr, totalStr, chunkData] = match;
      const partNo = parseInt(partNoStr, 10);
      const total = parseInt(totalStr, 10);

      if (!chunkBuffer[topic]) {
        const timeoutId = setTimeout(() => {
          console.warn(`⚠️ Incomplete chunk cleared for topic: ${topic}`);
          delete chunkBuffer[topic];
        }, 30_000);
        chunkBuffer[topic] = { chunks: [], total, timeoutId };
      }

      chunkBuffer[topic].chunks[partNo - 1] = chunkData;

      if (chunkBuffer[topic].chunks.filter(Boolean).length === chunkBuffer[topic].total) {
        const combined = chunkBuffer[topic].chunks.join('');
        clearTimeout(chunkBuffer[topic].timeoutId);
        delete chunkBuffer[topic];
        try {
          await handleFullMessage(topic, JSON.parse(combined));
        } catch (err) {
          console.error('❌ Error parsing reconstructed message', err);
        }
      }
    });

    const subListener = mqttEmitter.addListener('mqtt_subscribed', (topic) =>
      console.log(`✅ Subscribed to: ${topic}`)
    );

    const connLostListener = mqttEmitter.addListener('mqtt_connection_lost', async () => {
      console.warn('⚠️ MQTT connection lost, reconnecting...');
      try {
        await MqttBroker.startBroker();
        // MqttBroker.subscribe('sync/pull/+');
        // MqttBroker.subscribe('sync/push/+');
        MqttBroker.subscribe('offline_events');
        console.log('✅ MQTT reconnected');
      } catch (err) {
        console.error('❌ Failed to reconnect MQTT:', err);
      }
    });

    return () => {
      messageListener.remove();
      subListener.remove();
      connLostListener.remove();
      Object.values(chunkBuffer).forEach(({ timeoutId }) => clearTimeout(timeoutId));
    };
  }, []);

  React.useEffect(() => {
    (async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
      dispatch(getPrinters({
        locationId: 'd15139f6-ea2b-4b4c-8541-7a9112bfd8bf', deviceIdentifier: 'merchant-de446aca7248f766-d15139f6-ea2b-4b4c-8541-7a9112bfd8bf', sagaResponseCB: async (printers: any) => {
          //success callback
          console.log("printers ", printers)
        }
      }));
    })()

  }, [])

  const trigger = async () => {
    console.log("creating an order...");

    const uniqueOrderId = `mock-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const paddedOrderNo = Math.random().toString().padStart(3, '0');

    // Create a copy of mock with unique IDs
    const uniqueMock = {
      ...mock,
      orderId: uniqueOrderId,
      orderNo: `ORD-${paddedOrderNo}`,
      items: [],
      totals: [],
      transactions: [],
      transactionsWithTip: []
    };

    const stringified = JSON.stringify(uniqueMock);
    // saveOrderToDB(JSON.parse(stringified));
  }

  const sendSyncData = async (safeOrders: { orderId: string }[]) => {
    try {
      const payloadString = JSON.stringify({ orders: safeOrders, timestamp: new Date().toISOString() });
      const MAX_CHARS = 50_000;

      if (payloadString.length > MAX_CHARS) {
        console.log('📦 Payload too large, sending in batches...');
        const batchSize = 5;
        const totalBatches = Math.ceil(safeOrders.length / batchSize);

        for (let i = 0; i < safeOrders.length; i += batchSize) {
          const batch = safeOrders.slice(i, i + batchSize);
          const batchPayload = {
            orders: batch,
            batchIndex: Math.floor(i / batchSize),
            totalBatches,
            timestamp: new Date().toISOString()
          };
          MqttBroker.publish('sync/data', JSON.stringify(batchPayload), 0);
          console.log(`📦 Sent batch ${Math.floor(i / batchSize) + 1}/${totalBatches}`);
          await new Promise((resolve) => setTimeout(resolve, 100));
        }

        console.log('✅ All batches sent successfully');
      } else {
        MqttBroker.publish('sync/data', payloadString, 1);
        console.log('✅ Sync data sent successfully');
      }
    } catch (err) {
      console.error('❌ Error sending sync data:', err);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: 'white', padding: 10 }}>
      <Text style={{ backgroundColor: 'black', color: 'white', padding: 5 }}>Server App</Text>
      <Text onPress={() => {}} style={{ marginTop: 20, fontSize: 16, color: 'black' }}>
        Fetch Orders from WatermelonDB
      </Text>

      <View style={{ flexDirection: 'row', gap: 20 }}>
        <Text onPress={() => {}} style={{ marginTop: 10, fontSize: 16, color: 'red' }}>
          Clear Empty Orders
        </Text>

        <Text onPress={trigger} style={{ marginTop: 10, fontSize: 16, color: 'red' }}>
          Generate one Order
        </Text>
      </View>

      <View style={styles.container}>
        <View style={styles.tabBar}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'orders' && styles.activeTab]}
            onPress={() => setActiveTab('orders')}>
            <Text style={[styles.tabText, activeTab === 'orders' && styles.activeTabText]}>
              📋 Orders
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'products' && styles.activeTab]}
            onPress={() => setActiveTab('products')}>
            <Text style={[styles.tabText, activeTab === 'products' && styles.activeTabText]}>
              📦 Products
            </Text>
          </TouchableOpacity>
        </View>

        {activeTab === 'orders' ? <OrderScreen /> : <ProductScreen />}
      </View>

      {watermelonOrders?.length > 0 && (
        <View style={{ marginVertical: 10, flex: 1, padding: 10, borderRadius: 8 }}>
          <Text style={{ fontSize: 16, fontWeight: 'bold', marginBottom: 10, color: 'black' }}>
            Orders from WatermelonDB:{watermelonOrders.length}
          </Text>
          <FlatList
            data={watermelonOrders}
            contentContainerStyle={{ paddingBottom: 20 }}
            keyExtractor={(item, index) => `${item.orderId}-${index}`}
            renderItem={({ item, index }) => (
              <View key={index}
                style={{
                  flex: 1,
                  backgroundColor: '#f0f0f0',
                  padding: 10,
                  marginVertical: 5,
                  borderRadius: 8,
                  borderLeftWidth: 4,
                  borderLeftColor: '#007bff'
                }}
              >
                <Text style={{ fontSize: 14, fontWeight: 'bold', color: 'black' }}>Order #{index + 1}</Text>
                <Text style={{ fontSize: 12, color: '#666' }}>ID: {item.orderId}</Text>
                <Text style={{ fontSize: 12, color: '#666' }}>Total: ${item.orderTotal || 0}</Text>
                <Text style={{ fontSize: 12, color: '#666' }}>Customer: {item.fullName || 'N/A'}</Text>
                <Text style={{ fontSize: 12, color: '#666' }}>Phone: {item.phone || 'N/A'}</Text>
                <Text style={{ fontSize: 12, color: '#666' }}>
                  Created: {item.createdAt ? new Date(item.createdAt).toLocaleString() : 'N/A'}
                </Text>
                <Text style={{ fontSize: 12, color: '#666' }}>Order No: {item.orderNo || 'N/A'}</Text>
              </View>
            )}
            style={{ flex: 1 }}
            showsVerticalScrollIndicator={true}
          />
        </View>
      )}
    </SafeAreaView>
  );
};

const App = () => {
  return (
    <Provider store={Store}>
      <AppContent />
    </Provider>
  );
};

export default App;



const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  tab: {
    flex: 1,
    paddingVertical: 15,
    alignItems: 'center',
    borderBottomWidth: 3,
    borderBottomColor: 'transparent',
  },
  activeTab: {
    borderBottomColor: '#2196F3',
  },
  tabText: {
    fontSize: 16,
    color: '#999',
    fontWeight: '600',
  },
  activeTabText: {
    color: '#2196F3',
  },
});