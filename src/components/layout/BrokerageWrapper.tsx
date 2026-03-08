'use client';

import { ReactNode } from 'react';
import { useUserData } from '@/lib/UserDataContext';
import { BrokerageDataProvider } from '@/lib/BrokerageDataContext';

/**
 * Bridges UserDataContext (which provides uid) and BrokerageDataContext.
 * Must be a client component in its own file so 'use client' works.
 */
export default function BrokerageWrapper({ children }: { children: ReactNode }) {
  const { uid } = useUserData();
  return <BrokerageDataProvider uid={uid}>{children}</BrokerageDataProvider>;
}
