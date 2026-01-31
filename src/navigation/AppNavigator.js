import React, { useContext } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { Ionicons } from '@expo/vector-icons';
import { AuthContext, AuthProvider } from '../context/AuthContext'; 

// Import Screens
import LoginScreen from '../screens/LoginScreen'; 
import DashboardScreen from '../screens/DashboardScreen';
import CustomersScreen from '../screens/CustomersScreen';
import AddCustomerScreen from '../screens/AddCustomerScreen';
import CustomerDetailScreen from '../screens/CustomerDetailScreen';
import NewSaleScreen from '../screens/NewSaleScreen';
import ReportsScreen from '../screens/ReportsScreen';
import OffersScreen from '../screens/OffersScreen'; 
import AuditLogScreen from '../screens/AuditLogScreen'; 
import QRScannerScreen from '../screens/QRScannerScreen'; 
import InventoryScreen from '../screens/InventoryScreen'; 
import SettingsScreen from '../screens/SettingsScreen';
import ShiftScreen from '../screens/ShiftScreen';
import ExpenseScreen from '../screens/ExpenseScreen';

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();

// 🌑 Helper for Common Header Styles
const getHeaderOptions = (isDarkMode) => ({
  headerStyle: { backgroundColor: isDarkMode ? '#1e1e1e' : '#ffffff' },
  headerTintColor: isDarkMode ? '#ffffff' : '#000000',
  headerTitleStyle: { fontWeight: 'bold' },
  cardStyle: { backgroundColor: isDarkMode ? '#121212' : '#f5f5f5' } // Default background for screens
});

function HomeStack() {
  const { isDarkMode } = useContext(AuthContext); // 🌑 Get Theme

  return (
    <Stack.Navigator screenOptions={getHeaderOptions(isDarkMode)}>
      <Stack.Screen name="Dashboard" component={DashboardScreen} options={{headerShown:false}} />
      <Stack.Screen name="NewSale" component={NewSaleScreen} options={{title:'New Fuel Sale'}} />
      <Stack.Screen name="Offers" component={OffersScreen} options={{title:'Manage Offers'}} />
      <Stack.Screen name="AuditLogs" component={AuditLogScreen} options={{title:'Security Audit Logs'}} />
      <Stack.Screen name="QRScanner" component={QRScannerScreen} options={{title:'Scan Vehicle QR'}} /> 
      <Stack.Screen name="Inventory" component={InventoryScreen} options={{title:'Fuel Inventory'}} /> 
      <Stack.Screen name="Settings" component={SettingsScreen} options={{title:'System Settings'}} />
      <Stack.Screen name="Shift" component={ShiftScreen} options={{title:'Shift Management'}} />
      <Stack.Screen name="Expenses" component={ExpenseScreen} options={{title:'Station Expenses'}} />
    </Stack.Navigator>
  );
}

function CustomerStack() {
  const { isDarkMode } = useContext(AuthContext); // 🌑 Get Theme

  return (
    <Stack.Navigator screenOptions={getHeaderOptions(isDarkMode)}>
      <Stack.Screen name="CustomerList" component={CustomersScreen} options={{headerShown:false}} />
      <Stack.Screen name="AddCustomer" component={AddCustomerScreen} options={{title:'New Customer'}} />
      <Stack.Screen name="CustomerDetail" component={CustomerDetailScreen} options={{title:'Customer Profile'}} />
    </Stack.Navigator>
  );
}

function MainTabs() {
  const { isDarkMode } = useContext(AuthContext); // 🌑 Get Theme

  // Colors for Dark Mode
  const theme = {
    barBg: isDarkMode ? '#1e1e1e' : '#ffffff',
    text: isDarkMode ? '#ffffff' : '#000000',
    border: isDarkMode ? '#333333' : '#dddddd',
    inactive: isDarkMode ? '#888888' : 'gray',
  };

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        // 1. Fix Bottom Tab Bar Colors
        tabBarStyle: { 
          backgroundColor: theme.barBg, 
          borderTopColor: theme.border 
        },
        tabBarActiveTintColor: '#2196f3',
        tabBarInactiveTintColor: theme.inactive,
        
        // 2. Fix Top Header Colors (Home, Customers, Reports)
        headerStyle: { backgroundColor: theme.barBg },
        headerTintColor: theme.text,

        tabBarIcon: ({ focused, color, size }) => {
          let iconName = 'ellipse';
          if (route.name === 'Home') iconName = focused ? 'home' : 'home-outline';
          if (route.name === 'Customers') iconName = focused ? 'people' : 'people-outline';
          if (route.name === 'Reports') iconName = focused ? 'receipt' : 'receipt-outline';
          return <Ionicons name={iconName} size={size} color={color} />;
        },
      })}
    >
      {/* Note: 'headerShown: false' on Home usually looks better if Dashboard has its own header */}
      <Tab.Screen name="Home" component={HomeStack} options={{headerShown: false}} />
      <Tab.Screen name="Customers" component={CustomerStack} options={{headerShown: false}} />
      <Tab.Screen name="Reports" component={ReportsScreen} options={{title:'Analytics & Reports'}} />
    </Tab.Navigator>
  );
}

// Wrapper to handle Auth State
function RootNavigator() {
  const { user, isLoading } = useContext(AuthContext);

  if (isLoading) {
    return (
      <View style={{flex:1, justifyContent:'center', alignItems:'center'}}>
        <ActivityIndicator size="large" color="#2196f3" />
      </View>
    );
  }

  return (
    <Stack.Navigator screenOptions={{headerShown: false}}>
      {user ? (
        <Stack.Screen name="MainTabs" component={MainTabs} />
      ) : (
        <Stack.Screen name="Login" component={LoginScreen} />
      )}
    </Stack.Navigator>
  );
}

export default function AppNavigator() {
  return (
    <AuthProvider>
      <RootNavigator />
    </AuthProvider>
  );
}