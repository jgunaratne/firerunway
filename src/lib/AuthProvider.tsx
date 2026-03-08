'use client';

import { createContext, useContext, useEffect, useState, ReactNode} from 'react';
import { auth, onAuthStateChanged, type User } from '@/lib/firebase';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  /** Get a fresh ID token for API calls */
  getIdToken: () => Promise<string | null>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  getIdToken: async () => null,
});

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const getIdToken = async () => {
    if (!user) return null;
    return user.getIdToken();
  };

  return (
    <AuthContext.Provider value={{ user, loading, getIdToken }}>
      {children}
    </AuthContext.Provider>
  );
}
