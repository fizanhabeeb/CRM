import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { Ionicons } from '@expo/vector-icons';
import { AuthProvider } from '../context/AuthContext'; 

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
import SettingsScreen from '../screens/SettingsScreen'; // ✅ 1. Import Settings

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();

function HomeStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen name="Dashboard" component={DashboardScreen} options={{headerShown:false}} />
      <Stack.Screen name="NewSale" component={NewSaleScreen} options={{title:'New Fuel Sale'}} />
      <Stack.Screen name="Offers" component={OffersScreen} options={{title:'Manage Offers'}} />
      <Stack.Screen name="AuditLogs" component={AuditLogScreen} options={{title:'Security Audit Logs'}} />
      <Stack.Screen name="QRScanner" component={QRScannerScreen} options={{title:'Scan Vehicle QR'}} /> 
      <Stack.Screen name="Inventory" component={InventoryScreen} options={{title:'Fuel Inventory'}} /> 
      
      {/* ✅ 2. Register Settings Screen Here */}
      <Stack.Screen name="Settings" component={SettingsScreen} options={{title:'System Settings'}} />
    </Stack.Navigator>
  );
}

function CustomerStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen name="CustomerList" component={CustomersScreen} options={{headerShown:false}} />
      <Stack.Screen name="AddCustomer" component={AddCustomerScreen} options={{title:'New Customer'}} />
      <Stack.Screen name="CustomerDetail" component={CustomerDetailScreen} options={{title:'Customer Profile'}} />
    </Stack.Navigator>
  );
}

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName = 'ellipse';
          if (route.name === 'Home') iconName = focused ? 'home' : 'home-outline';
          if (route.name === 'Customers') iconName = focused ? 'people' : 'people-outline';
          if (route.name === 'Reports') iconName = focused ? 'receipt' : 'receipt-outline';
          return <Ionicons name={iconName} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Home" component={HomeStack} />
      <Tab.Screen name="Customers" component={CustomerStack} />
      <Tab.Screen name="Reports" component={ReportsScreen} options={{title:'Invoices'}} />
    </Tab.Navigator>
  );
}

export default function AppNavigator() {
  return (
    <AuthProvider>
      <Stack.Navigator screenOptions={{headerShown: false}}>
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="MainTabs" component={MainTabs} />
      </Stack.Navigator>
    </AuthProvider>
  );
}