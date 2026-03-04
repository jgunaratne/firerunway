'use client';

import { ReactNode } from 'react';
import { useUserData } from '@/lib/UserDataContext';
import { BrokerageDataProvider } from '@/lib/BrokerageDataContext';

/**
 * Bridges UserDataContext (which provides clerkId) and BrokerageDataContext.
 * Must be a client component in its own file so 'use client' works.
 */
export default function BrokerageWrapper({ children }: { children: ReactNode }) {
  const { clerkId } = useUserData();
  return <BrokerageDataProvider clerkId={clerkId}>{children}</BrokerageDataProvider>;
}
