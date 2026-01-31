import React, { createContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true); 
  const [isDarkMode, setIsDarkMode] = useState(false);

  // 🎨 Centralized Theme Logic
  const theme = {
    bg: isDarkMode ? '#121212' : '#f5f5f5',
    card: isDarkMode ? '#1e1e1e' : '#fff',
    text: isDarkMode ? '#fff' : '#000',
    subText: isDarkMode ? '#aaa' : '#666',
    border: isDarkMode ? '#333' : '#ddd',
    inputBg: isDarkMode ? '#2c2c2c' : '#fff',
    tabBar: isDarkMode ? '#1e1e1e' : '#fff',
    success: '#4caf50',
    danger: '#f44336',
    primary: '#2196f3',
    warning: '#ff9800'
  };

  useEffect(() => {
    const loadData = async () => {
      try {
        const storedUser = await AsyncStorage.getItem('user_session');
        if (storedUser) setUser(JSON.parse(storedUser));

        const storedTheme = await AsyncStorage.getItem('app_theme');
        if (storedTheme === 'dark') setIsDarkMode(true);
      } catch (e) {
        console.log("Failed to load data", e);
      } finally {
        setIsLoading(false); 
      }
    };
    loadData();
  }, []);

  const login = async (userData) => {
    try {
      await AsyncStorage.setItem('user_session', JSON.stringify(userData));
      setUser(userData);
    } catch (e) { console.log(e); }
  };

  const logout = async () => {
    try {
      await AsyncStorage.removeItem('user_session');
      setUser(null);
    } catch (e) { console.log(e); }
  };

  const toggleTheme = async () => {
    try {
      const newMode = !isDarkMode;
      setIsDarkMode(newMode);
      await AsyncStorage.setItem('app_theme', newMode ? 'dark' : 'light');
    } catch (e) { console.log(e); }
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, isLoading, isDarkMode, toggleTheme, theme }}>
      {children}
    </AuthContext.Provider>
  );
};