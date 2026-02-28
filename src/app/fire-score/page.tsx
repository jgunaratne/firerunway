'use client';

import { motion } from 'framer-motion';
import Card from '@/components/shared/Card';
import AnimatedNumber from '@/components/shared/AnimatedNumber';
import { calculateFIScore, formatCurrency } from '@/lib/calculations';
import { mockTotals, mockProfile, mockUser } from '@/lib/mock-data';

const fiData = calculateFIScore({
  currentInvestableAssets: mockTotals.investmentAccounts + mockTotals.retirementAccounts + mockTotals.rsuValueVested,
  fireNumber: mockProfile.fireNumber,
  liquidAssets: mockTotals.investmentAccounts + mockTotals.cashOther,
  annualSpend: mockProfile.annualSpend,
  employerStockValue: 280 * 190.50 + (875 - 280) * 190.50 * 0.2, // vested + partial unvested
  totalNetWorth: mockTotals.netWorth,
  isEmployed: mockUser.isEmployed,
  annualIncome: mockProfile.annualIncome,
});

const milestones = [
  { value: 0, label: 'Starting out' },
  { value: 25, label: 'Building base' },
  { value: 50, label: 'Halfway' },
  { value: 75, label: 'Approaching FI' },
  { value: 100, label: 'Financially independent' },
];

const projections = [
  {
    emoji: '🐻',
    label: 'Bear Case',
    percentile: '10th percentile',
    year: 2033,
    portfolioAtFI: 3200000,
    assumptions: 'Avg 5% returns, higher inflation, market corrections in early years',
  },
  {
    emoji: '📊',
    label: 'Base Case',
    percentile: '50th percentile',
    year: 2028,
    portfolioAtFI: 3800000,
    assumptions: 'Avg 8% returns, 3% inflation, steady savings rate',
  },
  {
    emoji: '🐂',
    label: 'Bull Case',
    percentile: '90th percentile',
    year: 2026,
    portfolioAtFI: 4500000,
    assumptions: 'Avg 12% returns, strong tech sector, RSU appreciation',
  },
];

const levers = [
  { action: 'Diversifying 10% of employer stock would raise your score by 4 points', impact: '+4', icon: '📊' },
  { action: 'Increasing savings rate to 45% moves base case FIRE date to 2027', impact: '+3', icon: '💰' },
  { action: 'Maxing out 401k contribution adds $4,500/yr to tax-advantaged growth', impact: '+2', icon: '🏦' },
];

export default function FireScorePage() {
  const score = fiData.total;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl lg:text-3xl text-text-primary">FIRE Score</h1>
        <p className="text-sm text-text-secondary mt-1">A single, honest answer to &quot;am I financially independent?&quot;</p>
      </div>

      {/* Score Hero */}
      <Card delay={0.1} className="py-10">
        <div className="text-center">
          <p className="number-display text-7xl lg:text-8xl font-bold text-text-primary">
            <AnimatedNumber value={score} />
          </p>
          <p className="text-text-secondary mt-2 text-sm">out of 100</p>
        </div>

        {/* Progress bar with milestones */}
        <div className="mt-8 px-4 lg:px-16">
          <div className="relative h-3 bg-white/5 rounded-full overflow-hidden">
            <motion.div
              className="absolute left-0 top-0 h-full rounded-full"
              style={{
                background: `linear-gradient(90deg, #ef4444 0%, #f59e0b 40%, #10b981 70%, #6366f1 100%)`,
              }}
              initial={{ width: 0 }}
              animate={{ width: `${score}%` }}
              transition={{ duration: 1.5, ease: 'easeOut', delay: 0.5 }}
            />
          </div>
          <div className="flex justify-between mt-3">
            {milestones.map((m) => (
              <div key={m.value} className="text-center" style={{ width: '20%' }}>
                <p className={`text-[10px] ${score >= m.value ? 'text-text-primary' : 'text-text-secondary/50'}`}>
                  {m.label}
                </p>
              </div>
            ))}
          </div>
        </div>
      </Card>

      {/* Score Breakdown */}
      <Card delay={0.2}>
        <h3 className="font-display text-lg text-text-primary mb-4">Score Breakdown</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-text-secondary border-b border-border">
                <th className="text-left pb-2 font-medium">Factor</th>
                <th className="text-left pb-2 font-medium">Your Value</th>
                <th className="text-right pb-2 font-medium">Weight</th>
                <th className="text-right pb-2 font-medium">Points</th>
              </tr>
            </thead>
            <tbody>
              {fiData.breakdown.map((row, i) => (
                <motion.tr
                  key={row.factor}
                  className="border-b border-border/50"
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.3 + i * 0.05 }}
                >
                  <td className="py-2.5 text-text-primary font-medium">{row.factor}</td>
                  <td className="py-2.5 number-display text-text-secondary">{row.value}</td>
                  <td className="py-2.5 text-right number-display text-text-secondary">{row.weight}%</td>
                  <td className="py-2.5 text-right number-display font-bold text-text-primary">{row.points}</td>
                </motion.tr>
              ))}
              <tr className="border-t-2 border-border">
                <td className="py-2.5 font-bold text-text-primary">Total</td>
                <td></td>
                <td></td>
                <td className="py-2.5 text-right number-display text-xl font-bold text-accent">{score}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </Card>

      {/* Three Timeline Projections */}
      <div>
        <h3 className="font-display text-lg text-text-primary mb-3">Timeline Projections</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {projections.map((proj, i) => (
            <Card key={proj.label} delay={0.4 + i * 0.1} hover className="text-center">
              <span className="text-3xl">{proj.emoji}</span>
              <p className="text-sm font-semibold text-text-primary mt-2">{proj.label}</p>
              <p className="text-xs text-text-secondary">{proj.percentile}</p>
              <p className="number-display text-3xl font-bold text-text-primary mt-3">{proj.year}</p>
              <p className="number-display text-sm text-text-secondary mt-1">
                Portfolio: {formatCurrency(proj.portfolioAtFI, true)}
              </p>
              <p className="text-[10px] text-text-secondary/60 mt-3 leading-relaxed">{proj.assumptions}</p>
            </Card>
          ))}
        </div>
      </div>

      {/* What Moves Your Score */}
      <Card delay={0.7}>
        <h3 className="font-display text-lg text-text-primary mb-4">What Moves Your Score</h3>
        <p className="text-xs text-text-secondary mb-4">AI-generated actions that would most improve your financial independence</p>
        <div className="space-y-3">
          {levers.map((lever, i) => (
            <motion.div
              key={i}
              className="flex items-start gap-3 p-3 rounded-lg bg-white/[0.02] border border-border/50 hover:border-accent/20 transition-colors"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.8 + i * 0.1 }}
            >
              <span className="text-xl">{lever.icon}</span>
              <div className="flex-1">
                <p className="text-sm text-text-primary">{lever.action}</p>
              </div>
              <span className="number-display text-sm font-bold text-emerald-400">{lever.impact}</span>
            </motion.div>
          ))}
        </div>
      </Card>

      <div className="disclaimer">
        FireRunway provides financial information for educational purposes only. Nothing on this platform constitutes personalized investment advice.
      </div>
    </div>
  );
}
