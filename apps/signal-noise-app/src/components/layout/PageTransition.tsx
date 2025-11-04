'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

interface PageTransitionProps {
  children: React.ReactNode;
}

export default function PageTransition({ children }: PageTransitionProps) {
  const pathname = usePathname();
  const [displayChildren, setDisplayChildren] = useState(children);
  const [transitionStage, setTransitionStage] = useState<'hidden' | 'visible'>('visible');

  useEffect(() => {
    if (children !== displayChildren) {
      // New route detected - start transition
      setTransitionStage('hidden');
    }
  }, [children, displayChildren]);

  return (
    <motion.div
      className="w-full h-full"
      initial={false}
      animate={transitionStage}
      variants={{
        hidden: { 
          opacity: 0,
          y: 20 // Move down while fading out
        },
        visible: { 
          opacity: 1,
          y: 0 // Return to original position
        }
      }}
      transition={{
        duration: 0.2, // Slightly longer for smooth animation
        ease: "easeOut" // Smooth easing
      }}
      onAnimationComplete={() => {
        if (transitionStage === 'hidden') {
          // When fade-out is complete, update content and fade-in
          setDisplayChildren(children);
          setTransitionStage('visible');
        }
      }}
    >
      {displayChildren}
    </motion.div>
  );
}
