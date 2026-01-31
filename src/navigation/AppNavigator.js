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
import ShiftScreen from '../screens/ShiftScreen'; // NEW
import ExpenseScreen from '../screens/ExpenseScreen'; // NEW

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
      <Stack.Screen name="Settings" component={SettingsScreen} options={{title:'System Settings'}} />
      <Stack.Screen name="Shift" component={ShiftScreen} options={{title:'Shift Management'}} />
      <Stack.Screen name="Expenses" component={ExpenseScreen} options={{title:'Station Expenses'}} />
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