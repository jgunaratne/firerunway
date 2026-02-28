// Hook to run Monte Carlo simulations in a Web Worker
import { useState, useCallback, useRef, useEffect } from 'react';

interface LifeEvent {
  id: string;
  type: 'quit' | 'layoff' | 'college' | 'purchase' | 'windfall' | 'expense';
  label: string;
  emoji: string;
  year: number;
  params: Record<string, number>;
}

interface SimulationParams {
  startingPortfolio: number;
  annualContribution: number;
  annualSpend: number;
  retirementSpend: number;
  equityPct: number;
  bondPct: number;
  inflationRate: number;
  years: number;
  fireNumber: number;
  lifeEvents: LifeEvent[];
  numSimulations: number;
}

interface SimulationResult {
  percentiles: {
    p10: number[];
    p25: number[];
    p50: number[];
    p75: number[];
    p90: number[];
  };
  successRate: number;
  medianFinalValue: number;
}

export function useMonteCarloWorker() {
  const workerRef = useRef<Worker | null>(null);
  const [result, setResult] = useState<SimulationResult | null>(null);
  const [isRunning, setIsRunning] = useState(false);

  useEffect(() => {
    // Create the worker
    workerRef.current = new Worker(
      new URL('../workers/monteCarlo.worker.ts', import.meta.url)
    );

    workerRef.current.onmessage = (event: MessageEvent<SimulationResult>) => {
      setResult(event.data);
      setIsRunning(false);
    };

    workerRef.current.onerror = (error) => {
      console.error('Monte Carlo Worker error:', error);
      setIsRunning(false);
    };

    return () => {
      workerRef.current?.terminate();
    };
  }, []);

  const runSimulation = useCallback((params: SimulationParams) => {
    if (workerRef.current) {
      setIsRunning(true);
      workerRef.current.postMessage(params);
    }
  }, []);

  return { result, isRunning, runSimulation };
}
