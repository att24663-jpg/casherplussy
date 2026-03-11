import React, { createContext, useContext, useState, useEffect } from 'react';
import localforage from 'localforage';
import { io, Socket } from 'socket.io-client';

export type UserRole = 'guest' | 'manager' | 'regular' | 'advanced' | 'deputy';
export type AccountType = 'guest' | 'manager' | 'employee';

interface User {
  id: number;
  username?: string;
  name?: string;
  phone?: string;
  password?: string;
  manager_code?: string;
  role: UserRole;
  accountType: AccountType;
  is_pro?: boolean;
  pro_expiry?: string;
  currency?: string;
  company_name?: string;
  manager_id?: number;
  status?: 'pending' | 'approved' | 'rejected';
}

interface AppContextType {
  user: User | null;
  setUser: (user: User | null) => void;
  isPro: boolean;
  logout: () => void;
  socket: Socket | null;
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUserState] = useState<User | null>(null);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [activeTab, setActiveTab] = useState('sales');

  useEffect(() => {
    localforage.getItem<User>('user').then((savedUser) => {
      if (savedUser) setUserState(savedUser);
      else setUserState({ id: 0, role: 'guest', accountType: 'guest' });
    });
  }, []);

  useEffect(() => {
    let interval: any;
    if (user && user.accountType === 'employee' && user.status === 'pending') {
      interval = setInterval(async () => {
        try {
          const res = await fetch(`/api/auth/employee/status/${user.id}`);
          if (res.ok) {
            const data = await res.json();
            if (data.status === 'approved') {
              setUser({ ...user, status: 'approved', role: data.role });
            } else if (data.status === 'rejected') {
              logout();
              alert('تم رفض طلب الانضمام');
            }
          }
        } catch (e) {
          console.error('Status check failed', e);
        }
      }, 5000);
    }
    return () => clearInterval(interval);
  }, [user?.id, user?.status]);

  useEffect(() => {
    if (user && user.id !== 0) {
      const newSocket = io();
      setSocket(newSocket);

      if (user.accountType === 'manager') {
        newSocket.emit('join_manager', user.manager_code);
      } else {
        newSocket.emit('join_employee', user.id);
      }

      newSocket.on('approved', (data) => {
        if (user && user.id !== 0) {
          setUser({ ...user, status: 'approved', role: data.role });
          alert('تم قبول طلب انضمامك!');
        }
      });

      newSocket.on('kicked', () => {
        logout();
        alert('تم إنهاء جلستك من قبل المدير');
      });

      return () => {
        newSocket.disconnect();
      };
    }
  }, [user?.id]);

  const setUser = (newUser: User | null) => {
    setUserState(newUser);
    if (newUser) localforage.setItem('user', newUser);
    else localforage.removeItem('user');
  };

  const logout = () => {
    setUser({ id: 0, role: 'guest', accountType: 'guest' });
  };

  const isPro = user?.is_pro || false;

  return (
    <AppContext.Provider value={{ user, setUser, isPro, logout, socket, activeTab, setActiveTab }}>
      {children}
    </AppContext.Provider>
  );
};

export const useAppContext = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error('useAppContext must be used within AppProvider');
  return context;
};
