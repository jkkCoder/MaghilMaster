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
  Switch,
} from 'react-native';
import { database } from '../database';
import Product from '../models/Product';
import { mySync } from '../database/sync';
import { checkSyncStatus, forceMarkProductsForSync } from '../database/debugSync';

const ProductScreen = () => {
  const [productCode, setProductCode] = useState('');
  const [productName, setProductName] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [stockQuantity, setStockQuantity] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [products, setProducts] = useState<Product[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadProducts();
  }, []);

  const loadProducts = async () => {
    try {
      const productsCollection = database.get<Product>('mh_products');
      const allProducts = await productsCollection.query().fetch();
      setProducts(allProducts);
    } catch (error) {
      console.error('Error loading products:', error);
    }
  };

  const addProduct = async () => {
    if (!productCode || !productName || !price || !stockQuantity) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }

    const priceNum = parseFloat(price);
    const stockNum = parseInt(stockQuantity);

    if (isNaN(priceNum) || priceNum < 0) {
      Alert.alert('Error', 'Please enter a valid price');
      return;
    }

    if (isNaN(stockNum) || stockNum < 0) {
      Alert.alert('Error', 'Please enter a valid stock quantity');
      return;
    }

    setLoading(true);
    try {
      await database.write(async () => {
        await database.get<Product>('mh_products').create(product => {
          product.productCode = productCode;
          product.productName = productName;
          product.description = description || undefined;
          product.price = priceNum;
          product.stockQuantity = stockNum;
          product.isActive = isActive;
        });
      });

      Alert.alert('Success', 'Product added successfully!');
      clearForm();
      loadProducts();
    } catch (error) {
      console.error('Error adding product:', error);
      Alert.alert('Error', 'Failed to add product');
    } finally {
      setLoading(false);
    }
  };

  const syncData = async () => {
    setIsSyncing(true);
    try {
      await mySync(database);
      Alert.alert('Success', 'Data synchronized successfully!');
      loadProducts();
    } catch (error) {
      console.error('Sync error:', error);
      Alert.alert('Error', 'Sync failed. Please check your connection.');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleCheckSyncStatus = async () => {
    await checkSyncStatus();
    Alert.alert(
      'Sync Status',
      'Check your Metro bundler console for detailed sync status of all products.'
    );
  };

  const handleForceSync = async () => {
    try {
      setLoading(true);
      await forceMarkProductsForSync();
      Alert.alert(
        'Products Marked for Sync',
        'All products have been marked for sync. Now click the Sync button to push them to the server.',
        [
          {
            text: 'Sync Now',
            onPress: () => syncData(),
          },
          {
            text: 'Later',
            style: 'cancel',
          },
        ]
      );
    } catch (error) {
      console.error('Error marking products:', error);
      Alert.alert('Error', 'Failed to mark products for sync');
    } finally {
      setLoading(false);
    }
  };

  const clearForm = () => {
    setProductCode('');
    setProductName('');
    setDescription('');
    setPrice('');
    setStockQuantity('');
    setIsActive(true);
  };

  const fillRandomData = () => {
    const randomId = () => Math.random().toString(36).substring(2, 10).toUpperCase();
    const randomPrice = () => (Math.random() * 1000 + 10).toFixed(2);
    const randomStock = () => Math.floor(Math.random() * 500);
    
    const productNames = [
      'Laptop Pro', 'Wireless Mouse', 'Mechanical Keyboard', 'USB-C Cable',
      'Monitor 27"', 'Webcam HD', 'Headphones', 'Phone Case', 'Tablet Stand',
      'Power Bank', 'Smart Watch', 'Bluetooth Speaker',
    ];

    setProductCode(`PRD${randomId()}`);
    setProductName(productNames[Math.floor(Math.random() * productNames.length)]);
    setDescription(`High quality product with excellent features`);
    setPrice(randomPrice());
    setStockQuantity(randomStock().toString());
    setIsActive(Math.random() > 0.3); // 70% active
  };

  const renderProductItem = ({ item }: { item: Product }) => (
    <View style={styles.productItem}>
      <View style={styles.productHeader}>
        <Text style={styles.productName}>{item.productName}</Text>
        <View style={[styles.statusBadge, item.isActive ? styles.activeBadge : styles.inactiveBadge]}>
          <Text style={styles.statusText}>
            {item.isActive ? 'Active' : 'Inactive'}
          </Text>
        </View>
      </View>
      <Text style={styles.productText}>Code: {item.productCode}</Text>
      {item.description && (
        <Text style={styles.productText}>Description: {item.description}</Text>
      )}
      <Text style={styles.productText}>Price: ${item.price.toFixed(2)}</Text>
      <Text style={styles.productText}>Stock: {item.stockQuantity} units</Text>
      <Text style={styles.productText}>
        Last Updated: {new Date(item.updatedAt).toLocaleString()}
      </Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Product Management</Text>
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
          <Text style={styles.sectionTitle}>Add New Product</Text>
          <TouchableOpacity
            style={styles.randomButton}
            onPress={fillRandomData}>
            <Text style={styles.randomButtonText}>🎲 Fill Random</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.label}>Product Code *</Text>
        <TextInput
          style={styles.input}
          value={productCode}
          onChangeText={setProductCode}
          placeholder="Enter product code"
          placeholderTextColor="#999"
        />

        <Text style={styles.label}>Product Name *</Text>
        <TextInput
          style={styles.input}
          value={productName}
          onChangeText={setProductName}
          placeholder="Enter product name"
          placeholderTextColor="#999"
        />

        <Text style={styles.label}>Description</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          value={description}
          onChangeText={setDescription}
          placeholder="Enter description (optional)"
          placeholderTextColor="#999"
          multiline
          numberOfLines={3}
        />

        <Text style={styles.label}>Price *</Text>
        <TextInput
          style={styles.input}
          value={price}
          onChangeText={setPrice}
          placeholder="Enter price"
          placeholderTextColor="#999"
          keyboardType="decimal-pad"
        />

        <Text style={styles.label}>Stock Quantity *</Text>
        <TextInput
          style={styles.input}
          value={stockQuantity}
          onChangeText={setStockQuantity}
          placeholder="Enter stock quantity"
          placeholderTextColor="#999"
          keyboardType="number-pad"
        />

        <View style={styles.switchContainer}>
          <Text style={styles.label}>Active</Text>
          <Switch
            value={isActive}
            onValueChange={setIsActive}
            trackColor={{ false: '#767577', true: '#4CAF50' }}
            thumbColor={isActive ? '#fff' : '#f4f3f4'}
          />
        </View>

        <TouchableOpacity
          style={[styles.addButton, loading && styles.buttonDisabled]}
          onPress={addProduct}
          disabled={loading}>
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.addButtonText}>Add Product</Text>
          )}
        </TouchableOpacity>

        {/* Debug Tools */}
        <View style={styles.debugSection}>
          <Text style={styles.debugTitle}>🔧 Sync Debug Tools</Text>
          <View style={styles.debugButtons}>
            <TouchableOpacity
              style={styles.debugButton}
              onPress={handleCheckSyncStatus}>
              <Text style={styles.debugButtonText}>📊 Check Status</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.debugButton, styles.forceButton]}
              onPress={handleForceSync}>
              <Text style={styles.debugButtonText}>🔄 Force Mark</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.debugHint}>
            If products aren't syncing: 1) Check Status 2) Force Mark 3) Sync
          </Text>
        </View>

        <Text style={styles.sectionTitle}>Products List ({products.length})</Text>

        {products.length === 0 ? (
          <Text style={styles.emptyText}>No products yet. Add one above!</Text>
        ) : (
          <FlatList
            data={products}
            renderItem={renderProductItem}
            keyExtractor={item => item.id}
            scrollEnabled={false}
            style={styles.productsList}
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
    marginTop: 20,
    marginBottom: 15,
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
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  switchContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 15,
    paddingVertical: 10,
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
  productsList: {
    marginBottom: 20,
  },
  productItem: {
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 8,
    marginBottom: 10,
    borderLeftWidth: 4,
    borderLeftColor: '#FF9800',
  },
  productHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  productName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  activeBadge: {
    backgroundColor: '#4CAF50',
  },
  inactiveBadge: {
    backgroundColor: '#999',
  },
  statusText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  productText: {
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
  debugSection: {
    backgroundColor: '#FFF3E0',
    padding: 15,
    borderRadius: 8,
    marginTop: 20,
    marginBottom: 10,
    borderWidth: 2,
    borderColor: '#FF9800',
  },
  debugTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#F57C00',
    marginBottom: 10,
  },
  debugButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  debugButton: {
    flex: 1,
    backgroundColor: '#2196F3',
    padding: 12,
    borderRadius: 6,
    alignItems: 'center',
    marginHorizontal: 5,
  },
  forceButton: {
    backgroundColor: '#FF5722',
  },
  debugButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  debugHint: {
    fontSize: 12,
    color: '#F57C00',
    marginTop: 10,
    fontStyle: 'italic',
  },
});

export default ProductScreen;

