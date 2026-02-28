'use client';

import { ReactNode } from 'react';
import { motion } from 'framer-motion';

interface CardProps {
  children: ReactNode;
  className?: string;
  hover?: boolean;
  delay?: number;
  padding?: string;
}

export default function Card({ children, className = '', hover = false, delay = 0, padding = 'p-6' }: CardProps) {
  return (
    <motion.div
      className={`${hover ? 'glass-card-hover' : 'glass-card'} ${padding} ${className}`}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay, ease: 'easeOut' }}
    >
      {children}
    </motion.div>
  );
}
