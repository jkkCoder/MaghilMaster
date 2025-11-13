import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  FlatList,
} from 'react-native';
import { database } from '../database';
import Order from '../models/Order';
import { mySync } from '../database/sync';
import { Q } from '@nozbe/watermelondb';

const OrderScreen = () => {
  const [locationId, setLocationId] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [orderNo, setOrderNo] = useState('');
  const [orderTypeId, setOrderTypeId] = useState('');
  const [ipAddress, setIpAddress] = useState('');
  const [userAgent, setUserAgent] = useState('');
  const [orders, setOrders] = useState<Order[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadOrders();
  }, []);

  const loadOrders = async () => {
    try {
      const ordersCollection = database.get<Order>('mh_off_orders');
      const allOrders = await ordersCollection.query().fetch();
      setOrders(allOrders);
    } catch (error) {
      console.error('Error loading orders:', error);
    }
  };

  const addOrder = async () => {
    if (!locationId || !orderNo || !orderTypeId || !ipAddress || !userAgent) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }

    setLoading(true);
    try {
      await database.write(async () => {
        await database.get<Order>('mh_off_orders').create(order => {
          order.locationId = locationId;
          order.customerId = customerId || undefined;
          order.orderNo = orderNo;
          order.orderTypeId = orderTypeId;
          order.orderDate = new Date();
          order.orderTime = new Date().toTimeString().split(' ')[0];
          order.ipAddress = ipAddress;
          order.userAgent = userAgent;
        });
      });

      Alert.alert('Success', 'Order added successfully!');
      clearForm();
      loadOrders();
    } catch (error) {
      console.error('Error adding order:', error);
      Alert.alert('Error', 'Failed to add order');
    } finally {
      setLoading(false);
    }
  };

  const syncData = async () => {
    setIsSyncing(true);
    try {
      await mySync(database);
      Alert.alert('Success', 'Data synchronized successfully!');
      loadOrders();
    } catch (error) {
      console.error('Sync error:', error);
      Alert.alert('Error', 'Sync failed. Please check your connection.');
    } finally {
      setIsSyncing(false);
    }
  };

  const clearForm = () => {
    setLocationId('');
    setCustomerId('');
    setOrderNo('');
    setOrderTypeId('');
    setIpAddress('');
    setUserAgent('');
  };

  const fillRandomData = () => {
    const randomId = () => Math.random().toString(36).substring(2, 15);
    const randomOrderNo = () => `ORD${Math.floor(Math.random() * 100000).toString().padStart(5, '0')}`;
    const randomIP = () => 
      `${Math.floor(Math.random() * 256)}.${Math.floor(Math.random() * 256)}.${Math.floor(Math.random() * 256)}.${Math.floor(Math.random() * 256)}`;
    
    const userAgents = [
      'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X)',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
      'Mozilla/5.0 (Android 12; Mobile)',
    ];

    setLocationId(randomId());
    setCustomerId(randomId());
    setOrderNo(randomOrderNo());
    setOrderTypeId(randomId());
    setIpAddress(randomIP());
    setUserAgent(userAgents[Math.floor(Math.random() * userAgents.length)]);
  };

  const renderOrderItem = ({ item }: { item: Order }) => (
    <View style={styles.orderItem}>
      <Text style={styles.orderText}>Order No: {item.orderNo}</Text>
      <Text style={styles.orderText}>Location ID: {item.locationId}</Text>
      <Text style={styles.orderText}>Type ID: {item.orderTypeId}</Text>
      <Text style={styles.orderText}>
        Date: {new Date(item.orderDate).toLocaleDateString()}
      </Text>
      <Text style={styles.orderText}>Time: {item.orderTime}</Text>
      {item.customerId && (
        <Text style={styles.orderText}>Customer ID: {item.customerId}</Text>
      )}
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Order Management</Text>
        <TouchableOpacity
          style={[styles.syncButton, isSyncing && styles.buttonDisabled]}
          onPress={syncData}
          disabled={isSyncing}>
          {isSyncing ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.syncButtonText}>🔄 Sync</Text>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.formContainer}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Add New Order</Text>
          <TouchableOpacity
            style={styles.randomButton}
            onPress={fillRandomData}>
            <Text style={styles.randomButtonText}>🎲 Fill Random</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.label}>Location ID *</Text>
        <TextInput
          style={styles.input}
          value={locationId}
          onChangeText={setLocationId}
          placeholder="Enter location ID"
          placeholderTextColor="#999"
        />

        <Text style={styles.label}>Customer ID</Text>
        <TextInput
          style={styles.input}
          value={customerId}
          onChangeText={setCustomerId}
          placeholder="Enter customer ID (optional)"
          placeholderTextColor="#999"
        />

        <Text style={styles.label}>Order Number *</Text>
        <TextInput
          style={styles.input}
          value={orderNo}
          onChangeText={setOrderNo}
          placeholder="Enter order number"
          placeholderTextColor="#999"
          maxLength={15}
        />

        <Text style={styles.label}>Order Type ID *</Text>
        <TextInput
          style={styles.input}
          value={orderTypeId}
          onChangeText={setOrderTypeId}
          placeholder="Enter order type ID"
          placeholderTextColor="#999"
        />

        <Text style={styles.label}>IP Address *</Text>
        <TextInput
          style={styles.input}
          value={ipAddress}
          onChangeText={setIpAddress}
          placeholder="Enter IP address"
          placeholderTextColor="#999"
          maxLength={40}
        />

        <Text style={styles.label}>User Agent *</Text>
        <TextInput
          style={styles.input}
          value={userAgent}
          onChangeText={setUserAgent}
          placeholder="Enter user agent"
          placeholderTextColor="#999"
          maxLength={256}
          multiline
        />

        <TouchableOpacity
          style={[styles.addButton, loading && styles.buttonDisabled]}
          onPress={addOrder}
          disabled={loading}>
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.addButtonText}>Add Order</Text>
          )}
        </TouchableOpacity>

        <Text style={styles.sectionTitle}>Orders List ({orders.length})</Text>

        {orders.length === 0 ? (
          <Text style={styles.emptyText}>No orders yet. Add one above!</Text>
        ) : (
          <FlatList
            data={orders}
            renderItem={renderOrderItem}
            keyExtractor={item => item.id}
            scrollEnabled={false}
            style={styles.ordersList}
          />
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    paddingTop: 50,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  syncButton: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    minWidth: 80,
    alignItems: 'center',
  },
  syncButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
  formContainer: {
    flex: 1,
    padding: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 15,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  randomButton: {
    backgroundColor: '#FF9800',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 6,
  },
  randomButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#555',
    marginBottom: 5,
    marginTop: 10,
  },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#333',
  },
  addButton: {
    backgroundColor: '#2196F3',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 10,
  },
  addButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  ordersList: {
    marginBottom: 20,
  },
  orderItem: {
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 8,
    marginBottom: 10,
    borderLeftWidth: 4,
    borderLeftColor: '#2196F3',
  },
  orderText: {
    fontSize: 14,
    color: '#555',
    marginBottom: 4,
  },
  emptyText: {
    textAlign: 'center',
    color: '#999',
    fontSize: 16,
    marginTop: 20,
    fontStyle: 'italic',
  },
});

export default OrderScreen;

