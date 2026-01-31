import React, { createContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true); 
  const [isDarkMode, setIsDarkMode] = useState(false); // 🌑 Dark Mode State

  // 1. Check for saved user & theme when app starts
  useEffect(() => {
    const loadData = async () => {
      try {
        // Load User
        const storedUser = await AsyncStorage.getItem('user_session');
        if (storedUser) {
          setUser(JSON.parse(storedUser));
        }

        // Load Theme
        const storedTheme = await AsyncStorage.getItem('app_theme');
        if (storedTheme === 'dark') {
          setIsDarkMode(true);
        }
      } catch (e) {
        console.log("Failed to load data", e);
      } finally {
        setIsLoading(false); 
      }
    };
    loadData();
  }, []);

  // 2. Login
  const login = async (userData) => {
    try {
      await AsyncStorage.setItem('user_session', JSON.stringify(userData));
      setUser(userData);
    } catch (e) {
      console.log(e);
    }
  };

  // 3. Logout
  const logout = async () => {
    try {
      await AsyncStorage.removeItem('user_session');
      setUser(null);
    } catch (e) {
      console.log(e);
    }
  };

  // 4. Toggle Theme 🌑/☀️
  const toggleTheme = async () => {
    try {
      const newMode = !isDarkMode;
      setIsDarkMode(newMode);
      await AsyncStorage.setItem('app_theme', newMode ? 'dark' : 'light');
    } catch (e) {
      console.log(e);
    }
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, isLoading, isDarkMode, toggleTheme }}>
      {children}
    </AuthContext.Provider>
  );
};