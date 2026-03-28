// ═══════════════════════════════════════════════════════════════
// MCC SHOP – HOW TO USE THE SERVICES IN YOUR SCREENS
// Copy the relevant snippet into your existing screen files
// ═══════════════════════════════════════════════════════════════


// ─── 1. WRAP YOUR APP (App.js) ──────────────────────────────────
/*
import { AuthProvider } from './src/context/AuthContext';
import { CartProvider } from './src/context/CartContext';

export default function App() {
  return (
    <AuthProvider>
      <CartProvider>
        <NavigationContainer>
          ...your navigators here...
        </NavigationContainer>
      </CartProvider>
    </AuthProvider>
  );
}
*/


// ─── 2. LOGIN SCREEN ────────────────────────────────────────────
/*
import { useAuth } from '../context/AuthContext';

export default function LoginScreen({ navigation }) {
  const { login } = useAuth();
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleLogin = async () => {
    try {
      await login({ phone, password });
      navigation.replace('Home'); // go to home after login
    } catch (e) {
      setError(e.message);
    }
  };

  return (
    <View>
      <TextInput placeholder="Phone" value={phone} onChangeText={setPhone} />
      <TextInput placeholder="Password" secureTextEntry value={password} onChangeText={setPassword} />
      {error ? <Text style={{ color: 'red' }}>{error}</Text> : null}
      <Button title="Login" onPress={handleLogin} />
    </View>
  );
}
*/


// ─── 3. HOME / PRODUCT LIST SCREEN ─────────────────────────────
/*
import { useEffect, useState } from 'react';
import ProductService from '../services/product.service';
import { useCart } from '../context/CartContext';

export default function HomeScreen() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const { addItem } = useCart();

  useEffect(() => {
    ProductService.getAll({ limit: 20 })
      .then(data => setProducts(data.products))
      .finally(() => setLoading(false));
  }, []);

  // Search example
  const handleSearch = async (query) => {
    const data = await ProductService.search(query);
    setProducts(data.products);
  };

  return (
    <FlatList
      data={products}
      keyExtractor={item => item.id}
      renderItem={({ item }) => (
        <View>
          <Text>{item.name}</Text>
          <Text>GHS {item.sellingPrice}</Text>
          <Button title="Add to Cart" onPress={() => addItem(item, 1)} />
        </View>
      )}
    />
  );
}
*/


// ─── 4. CART & CHECKOUT SCREEN ──────────────────────────────────
/*
import { useCart } from '../context/CartContext';
import OrderService from '../services/order.service';
import PaymentService from '../services/payment.service';

export default function CartScreen({ navigation }) {
  const { items, subtotal, toOrderItems, clearCart } = useCart();

  const handleCheckout = async () => {
    try {
      // 1. Place the order
      const { order } = await OrderService.placeOrder({
        items: toOrderItems(),
        deliveryAddress: '123 Accra Road, East Legon',
        vehicleType: 'BIKE',
        deliveryFee: 15,
      });

      // 2. Pay with MoMo
      await PaymentService.payWithMoMo({
        orderId: order.id,
        momoPhone: '0241234567', // customer's MoMo number
      });

      clearCart();
      navigation.navigate('OrderTracking', { orderId: order.id });
    } catch (e) {
      alert(e.message);
    }
  };

  return (
    <View>
      {items.map(i => (
        <Text key={i.product.id}>{i.product.name} x{i.quantity}</Text>
      ))}
      <Text>Total: GHS {subtotal}</Text>
      <Button title="Pay with MoMo" onPress={handleCheckout} />
    </View>
  );
}
*/


// ─── 5. ORDER TRACKING SCREEN ───────────────────────────────────
/*
import { useEffect, useState } from 'react';
import OrderService from '../services/order.service';
import SocketService from '../services/socket.service';

export default function OrderTrackingScreen({ route }) {
  const { orderId } = route.params;
  const [order, setOrder] = useState(null);
  const [riderLocation, setRiderLocation] = useState(null);

  useEffect(() => {
    // Load order details
    OrderService.getById(orderId).then(data => setOrder(data.order));

    // Connect real-time socket
    SocketService.connect();
    SocketService.trackOrder(orderId);

    // Listen for rider GPS
    SocketService.onRiderLocation(({ lat, lng }) => {
      setRiderLocation({ lat, lng });
    });

    // Listen for status updates
    SocketService.onOrderStatus(({ status }) => {
      setOrder(prev => ({ ...prev, status }));
    });

    return () => SocketService.removeListeners();
  }, [orderId]);

  return (
    <View>
      <Text>Status: {order?.status}</Text>
      {riderLocation && (
        <Text>Rider at: {riderLocation.lat}, {riderLocation.lng}</Text>
      )}
    </View>
  );
}
*/


// ─── 6. RIDER APP – AVAILABLE ORDERS ───────────────────────────
/*
import { useEffect, useState } from 'react';
import DispatchService from '../services/dispatch.service';
import SocketService from '../services/socket.service';

export default function RiderOrdersScreen() {
  const [orders, setOrders] = useState([]);

  useEffect(() => {
    DispatchService.getAvailableOrders().then(data => setOrders(data.orders));
  }, []);

  const handleAccept = async (orderId) => {
    await DispatchService.acceptOrder(orderId);
    // After accepting, start sending GPS every 10 seconds
    setInterval(async () => {
      const { coords } = await Location.getCurrentPositionAsync();
      DispatchService.updateLocation({
        lat: coords.latitude,
        lng: coords.longitude,
        orderId,
      });
      // Also send via socket for real-time
      SocketService.sendLocation({ orderId, lat: coords.latitude, lng: coords.longitude });
    }, 10000);
  };

  const handleDelivered = async (orderId, photoUri) => {
    await DispatchService.uploadProof(orderId, photoUri);
    alert('Delivery confirmed!');
  };

  return (
    <FlatList
      data={orders}
      renderItem={({ item }) => (
        <View>
          <Text>{item.deliveryAddress}</Text>
          <Text>GHS {item.total}</Text>
          <Button title="Accept Order" onPress={() => handleAccept(item.id)} />
        </View>
      )}
    />
  );
}
*/
