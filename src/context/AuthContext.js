import React, { createContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true); // Check if we are loading saved data

  // 1. Check for saved user when app starts
  useEffect(() => {
    const loadUser = async () => {
      try {
        const storedUser = await AsyncStorage.getItem('user_session');
        if (storedUser) {
          setUser(JSON.parse(storedUser));
        }
      } catch (e) {
        console.log("Failed to load user", e);
      } finally {
        setIsLoading(false); // Done checking
      }
    };
    loadUser();
  }, []);

  // 2. Login: Save to Storage
  const login = async (userData) => {
    try {
      await AsyncStorage.setItem('user_session', JSON.stringify(userData));
      setUser(userData);
    } catch (e) {
      console.log(e);
    }
  };

  // 3. Logout: Clear Storage
  const logout = async () => {
    try {
      await AsyncStorage.removeItem('user_session');
      setUser(null);
    } catch (e) {
      console.log(e);
    }
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
};