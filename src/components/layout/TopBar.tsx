'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import dynamic from 'next/dynamic';

// Only load Clerk components when configured
const ClerkButtons = dynamic(() =>
  import('@clerk/nextjs').then(mod => {
    const { UserButton, SignedIn } = mod;
    return { default: () => <SignedIn><UserButton afterSignOutUrl="/sign-in" appearance={{ elements: { avatarBox: 'w-8 h-8' } }} /></SignedIn> };
  }), { ssr: false, loading: () => null }
);
import AnimatedNumber from '../shared/AnimatedNumber';
import { formatCurrency, calculateFIScore } from '@/lib/calculations';
import { useUserData } from '@/lib/UserDataContext';
import { useHoldingsCache } from '@/hooks/useHoldingsCache';
import { useStockPrice } from '@/hooks/useStockPrice';
import { useSafeAuth } from '@/hooks/useSafeAuth';

export default function TopBar() {
  const pathname = usePathname();
  const isOnboarding = pathname?.startsWith('/onboarding');
  const { profile, rsuGrants, realEstate, isLoading } = useUserData();
  const { userId } = useSafeAuth();
  const { totalInvestment } = useHoldingsCache(userId);
  const ticker = rsuGrants[0]?.company_ticker || 'AMZN';
  const stockPrice = useStockPrice(ticker);

  if (isOnboarding) return null;

  // Derive FI Score + Net Worth from context + SnapTrade
  const annualSpend = profile?.annual_spend || 120000;
  const annualIncome = profile?.annual_income || 380000;
  const fireNumber = profile?.fire_number || 3000000;
  const rsuValue = rsuGrants.reduce((sum, g) => sum + g.vested_shares * stockPrice, 0);
  const realEstateEquity = realEstate.reduce((sum, p) => sum + (p.current_value - p.mortgage_balance), 0);
  const investable = totalInvestment > 0 ? totalInvestment : rsuValue;
  const totalNetWorth = investable + realEstateEquity;

  const fiScore = isLoading ? 0 : calculateFIScore({
    currentInvestableAssets: investable,
    fireNumber,
    liquidAssets: investable,
    annualSpend,
    employerStockValue: rsuValue,
    totalNetWorth,
    isEmployed: true,
    annualIncome,
  }).total;

  return (
    <header className="fixed top-0 left-0 right-0 z-50 h-14 border-b border-border bg-bg-primary/80 backdrop-blur-xl">
      <div className="flex items-center justify-between h-full px-4 lg:px-6 max-w-[1400px] mx-auto">
        {/* Logo */}
        <Link href="/dashboard" className="flex items-center gap-2">
          <span className="text-xl">🔥</span>
          <span className="font-display text-lg text-text-primary tracking-tight">FireRunway</span>
        </Link>

        {/* Center stats */}
        <div className="hidden md:flex items-center gap-6">
          <div className="flex items-center gap-2">
            <span className="text-xs text-text-secondary uppercase tracking-wider">FI Score</span>
            <span className="number-display text-lg font-bold text-accent">
              <AnimatedNumber value={fiScore} />
            </span>
          </div>
          <div className="w-px h-6 bg-border" />
          <div className="flex items-center gap-2">
            <span className="text-xs text-text-secondary uppercase tracking-wider">Net Worth</span>
            <span className="number-display text-lg font-bold text-accent-green">
              <AnimatedNumber value={totalNetWorth} format={(n) => formatCurrency(n, true)} />
            </span>
          </div>
        </div>

        {/* User / Sign Out */}
        <div className="flex items-center gap-3">
          <ClerkButtons />
        </div>
      </div>
    </header>
  );
}
