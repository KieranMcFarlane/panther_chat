'use client';

import { motion } from 'framer-motion';

interface PageLoadingStateProps {
  isLoading: boolean;
}

export default function PageLoadingState({ isLoading }: PageLoadingStateProps) {
  if (!isLoading) return null;

  return (
    <motion.div
      className="fixed top-4 right-4 z-50 bg-black/80 backdrop-blur-sm rounded-lg px-4 py-2 flex items-center gap-2"
      initial={{ opacity: 0, x: 100 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 100 }}
      transition={{ duration: 0.2 }}
    >
      <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
      <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }}></div>
      <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" style={{ animationDelay: '0.4s' }}></div>
    </motion.div>
  );
}