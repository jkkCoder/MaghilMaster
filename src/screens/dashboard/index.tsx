import { View, Text, AppState, NativeEventEmitter, SafeAreaView, FlatList } from 'react-native'
import React from 'react'
import Order from '../../watermelondb-example/models/order';
import { useDispatch } from 'react-redux';
import MqttBroker from '../../nativeModules/MqttBrokerModule';
import { clearEmptyOrders, getAllOrderIds, saveOrderIdToDB } from '../../watermelondb-example/simplifiedWatermelonDBUtils';
import database from '../../watermelondb-example/database';
import { Q } from '@nozbe/watermelondb';
import { getPrinters } from '../../api/printer/printerActions';

const mqttEmitter = new NativeEventEmitter(MqttBroker);

const Dashboard = () => {
  const [watermelonOrders, setWatermelonOrders] = React.useState<Order[]>([]);
  const dispatch = useDispatch()

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

  // Initialize MQTT background service
  React.useEffect(() => {
    (async () => {
      console.log('🚀 Starting background MQTT service...');
      MqttBroker.startBackgroundService();
      await new Promise(resolve => setTimeout(resolve, 1000));

      console.log('🖥️ Starting MQTT broker...');
      await MqttBroker.startBroker();
      MqttBroker.subscribe('test/topic');
      MqttBroker.subscribe('sync/request');
      
    })();

    return () => console.log('🔄 App cleanup - MQTT continues in background');
  }, []);

  // MQTT message handling with chunk support
  React.useEffect(() => {
    const chunkBuffer: Record<
      string,
      { chunks: string[]; total: number; timeoutId: NodeJS.Timeout }
    > = {};

    const MAX_PROCESSED_MESSAGES = 1000;
    const cleanProcessedMessages = () => {
      if (processedMessages.size > MAX_PROCESSED_MESSAGES) processedMessages.clear();
    };

    const handleFullMessage = async (topic: string, msg: any) => {
      cleanProcessedMessages();
      if (topic === 'test/topic') {
        try {
          const orderData = typeof msg === 'string' ? JSON.parse(msg) : msg;
          const messageId = `${orderData.orderId}-${orderData.orderNo || 'no-number'}`;

          if (processedMessages.has(messageId)) {
            console.log(`🚫 Duplicate message skipped: ${orderData.orderId}`);
            return;
          }

          processedMessages.add(messageId);
          console.log('🔄 Processing order:', orderData.orderId);
          await saveOrderIdToDB(orderData);
          console.log('✅ Order saved:', orderData.orderId);

          // Verify
          const foundOrders = await database
            .get('orders')
            .query(Q.where('order_id', orderData.orderId))
            .fetch();
          if (foundOrders.length > 0) console.log('✅ Order confirmed in DB:', orderData.orderId);
          else console.error('❌ Order not found after save');

          // Remove after 1 min
          setTimeout(() => processedMessages.delete(messageId), 60 * 1000);
        } catch (err) {
          console.error('❌ Error processing MQTT message:', err);
        }
      } else if (topic === 'sync/request') {
        try {
          console.log('🔁 Sync request received');
          const orderIds = await getAllOrderIds();
          const safeOrders = orderIds.map(id => ({ orderId: id }));
          await sendSyncData(safeOrders);
        } catch (err) {
          console.error('❌ Error handling sync request:', err);
        }
      }
    };

    const messageListener = mqttEmitter.addListener('mqtt_message', async (data) => {
      const [topic, msg] = data.split('|');

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
        MqttBroker.subscribe('test/topic');
        MqttBroker.subscribe('sync/request');
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
      dispatch(getPrinters({ locationId: 'd15139f6-ea2b-4b4c-8541-7a9112bfd8bf' , deviceIdentifier: 'merchant-de446aca7248f766-d15139f6-ea2b-4b4c-8541-7a9112bfd8bf', sagaResponseCB:async(printers:any) => {        
        //success callback
      }}));
    })()
    
  },[])

  // Fetch WatermelonDB orders
  const getWatermelonOrders = async () => {
    console.log('🔍 Fetching orders from WatermelonDB...');
    try {
      const orders = await database.get<Order>('orders').query().fetch();
      setWatermelonOrders(orders);
    } catch (err) {
      console.error('❌ Error fetching orders:', err);
    }
  };

  const clearEmptyOrdersFromDB = async () => {
    console.log('🧹 Clearing empty orders...');
    try {
      const deletedCount = await clearEmptyOrders();
      console.log(`✅ Cleared ${deletedCount} empty orders`);
      await getWatermelonOrders();
    } catch (err) {
      console.error('❌ Error clearing orders:', err);
    }
  };

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
      <Text onPress={getWatermelonOrders} style={{ marginTop: 20, fontSize: 16, color: 'black' }}>
        Fetch Orders from WatermelonDB
      </Text>
      <Text onPress={clearEmptyOrdersFromDB} style={{ marginTop: 10, fontSize: 16, color: 'red' }}>
        Clear Empty Orders
      </Text>

      {watermelonOrders?.length > 0 && (
        <View style={{ marginVertical: 10 ,flex:1,padding:10,borderRadius:8}}>
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
                  flex:1,
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
}

export default Dashboard