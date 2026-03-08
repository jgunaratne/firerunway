'use client';

import { createContext, useContext, useEffect, useState, ReactNode} from 'react';
import { usePathname, useRouter } from 'next/navigation';
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

// Pages that don't require authentication
const PUBLIC_PATHS = ['/', '/sign-in', '/sign-up'];

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  // Redirect unauthenticated users to sign-in
  useEffect(() => {
    if (loading) return;
    const isPublicPath = PUBLIC_PATHS.includes(pathname) || pathname?.startsWith('/sign-in') || pathname?.startsWith('/sign-up');
    if (!user && !isPublicPath) {
      router.push('/');
    }
  }, [user, loading, pathname, router]);

  const getIdToken = async () => {
    if (!user) return null;
    return user.getIdToken();
  };

  // Show nothing while redirecting unauthenticated users
  const isPublicPath = PUBLIC_PATHS.includes(pathname) || pathname?.startsWith('/sign-in') || pathname?.startsWith('/sign-up');
  if (!loading && !user && !isPublicPath) {
    return null;
  }

  return (
    <AuthContext.Provider value={{ user, loading, getIdToken }}>
      {children}
    </AuthContext.Provider>
  );
}
