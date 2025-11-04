'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';

interface UserContextType {
  userId: string;
  setUserId: (id: string) => void;
  ensureUserId: () => string;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [userId, setUserIdState] = useState<string>('');
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
    // Load userId from localStorage on mount
    const storedUserId = localStorage.getItem('sports-intelligence-user-id');
    if (storedUserId) {
      setUserIdState(storedUserId);
    } else {
      // Generate new userId if none exists
      const newUserId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      setUserIdState(newUserId);
      localStorage.setItem('sports-intelligence-user-id', newUserId);
    }
  }, []);

  // Return null during SSR to prevent hydration mismatch
  if (!isClient) {
    return (
      <UserContext.Provider value={{ userId: '', setUserId: () => {}, ensureUserId: () => '' }}>
        {children}
      </UserContext.Provider>
    );
  }

  const setUserId = (id: string) => {
    setUserIdState(id);
    if (isClient) {
      localStorage.setItem('sports-intelligence-user-id', id);
    }
  };

  const ensureUserId = (): string => {
    if (!userId) {
      const newUserId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      setUserIdState(newUserId);
      if (isClient) {
        localStorage.setItem('sports-intelligence-user-id', newUserId);
      }
      return newUserId;
    }
    return userId;
  };

  const value = {
    userId,
    setUserId,
    ensureUserId,
  };

  return (
    <UserContext.Provider value={value}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
}