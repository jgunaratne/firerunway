'use client';

import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import { usePathname } from 'next/navigation';

/**
 * PageContextProvider allows any page to expose local data to the ChatRail.
 * 
 * Pages call `setPageContext("key=value\nkey=value")` to register their data.
 * The ChatRail reads `pageContext` to include it in the AI prompt.
 * Context auto-clears on route changes.
 */

interface PageContextType {
  pageContext: string;
  setPageContext: (context: string) => void;
}

const PageContext = createContext<PageContextType>({
  pageContext: '',
  setPageContext: () => {},
});

export function usePageContext() {
  return useContext(PageContext);
}

export function PageContextProvider({ children }: { children: ReactNode }) {
  const [pageContext, setPageContextState] = useState('');
  const pathname = usePathname();

  // Clear on route change
  useEffect(() => {
    setPageContextState('');
  }, [pathname]);

  const setPageContext = useCallback((context: string) => {
    setPageContextState(context);
  }, []);

  return (
    <PageContext.Provider value={{ pageContext, setPageContext }}>
      {children}
    </PageContext.Provider>
  );
}
