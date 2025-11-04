'use client';

import { useEffect, useState, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import ShinyText from './ShinyText';

const actionVerbs = [
  'Accomplishing','Actioning','Actualizing','Analyzing','Baking','Brewing',
  'Calculating','Cerebrating','Churning','Clauding','Coalescing',
  'Cogitating','Computing','Conjuring','Considering','Cooking',
  'Crafting','Creating','Crunching','Deliberating','Determining',
  'Effecting','Executing','Exploring','Finagling','Forging','Forming',
  'Generating','Gathering','Hatching','Herding','Honking','Hustling',
  'Ideating','Inferring','Investigating','Manifesting','Marinating',
  'Moseying','Mulling','Mustering','Musing','Noodling','Percolating',
  'Pondering','Processing','Puttering','Querying','Reticulating',
  'Ruminating','Sarching','Schlepping','Scraping','Searching',
  'Shucking','Simmering','Smooshing','Spinning','Stewing',
  'Synthesizing','Thinking','Transmuting','Vibing','Working'
];

const toolActionMap = {
  'mcp__neo4j-mcp__execute_query': ['Querying', 'Analyzing', 'Investigating'],
  'mcp__neo4j-mcp__search_nodes': ['Searching', 'Finding', 'Discovering'],
  'mcp__brightData__search_engine': ['Searching', 'Scouring', 'Exploring'],
  'mcp__brightData__scrape_as_markdown': ['Scraping', 'Gathering', 'Collecting'],
  'mcp__perplexity-mcp__chat_completion': ['Analyzing', 'Reasoning', 'Synthesizing'],
  'WebSearch': ['Searching', 'Exploring', 'Discovering'],
  'WebFetch': ['Fetching', 'Gathering', 'Retrieving'],
};

const bloomSequence = ['·','∙','⁕','✣','✢','✤','✺','✻']; // 8-step expansion

function DynamicStatusClaude({ currentTool, isLoading = true, statusMessage }) {
  const [verb, setVerb] = useState('Analyzing');
  const [symbol, setSymbol] = useState('·');
  const [displayTool, setDisplayTool] = useState('');
  const [direction, setDirection] = useState(1); // 1 = expand, -1 = contract
  const [index, setIndex] = useState(0);

  // 🌸 Bloom morph — expands then contracts
  useEffect(() => {
    if (!isLoading) return;

    const t = setInterval(() => {
      setIndex(prev => {
        const next = prev + direction;
        if (next >= bloomSequence.length - 1) setDirection(-1); // reverse
        if (next <= 0) setDirection(1); // expand again
        setSymbol(bloomSequence[next]);
        return next;
      });
    }, 200); // 0.2s per frame gives smooth breathing

    return () => clearInterval(t);
  }, [isLoading, direction]);

  // Verb logic (tool-specific persists, random cycles only when no specific tool)
  useEffect(() => {
    if (!isLoading) return;
    
    if (currentTool && toolActionMap[currentTool]) {
      // When we have a specific tool, use its mapped verb and persist it
      const verbs = toolActionMap[currentTool];
      const persistentVerb = verbs[Math.floor(Math.random() * verbs.length)];
      setVerb(persistentVerb);
    }
  }, [currentTool, isLoading]);

  // Random verb cycling when no specific tool is active
  useEffect(() => {
    if (!isLoading) return;
    
    // Only cycle if we don't have a specific tool
    if (!currentTool || !toolActionMap[currentTool]) {
      const verbInterval = setInterval(() => {
        const randomVerb = actionVerbs[Math.floor(Math.random() * actionVerbs.length)];
        setVerb(randomVerb);
      }, 3000); // Cycle random verbs every 3 seconds
      
      return () => clearInterval(verbInterval);
    }
  }, [currentTool, isLoading]);

  useEffect(() => {
    if (currentTool) {
      setDisplayTool(currentTool.replace('mcp__', '').replace('__', ' - '));
    } else {
      setDisplayTool('');
    }
  }, [currentTool]);

  if (!isLoading) return null;

  const glyphVariants = {
    animate: {
      scale: [0.4, 0.9, 1.2, 0.9, 0.4],
      opacity: [0.2, 0.7, 1, 0.8, 0.2],
      transition: { duration: 2.4, ease: 'easeInOut', repeat: Infinity },
    },
  };

  return (
    <div className="flex flex-col items-center justify-center space-y-3 min-h-[200px] relative">
      <motion.div
        variants={glyphVariants}
        animate="animate"
        className="text-5xl font-serif text-[#f8f8f8] drop-shadow-[0_0_12px_rgba(255,255,255,0.3)]"
        style={{
          fontFamily: "IBM Plex Serif, Inter Tight, ui-serif, 'Times New Roman', serif"
        }}
      >
        <AnimatePresence mode="wait">
          <motion.span
            key={symbol}
            initial={{ opacity: 0, scale: 0.6 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.6 }}
            transition={{ duration: 0.4, ease: 'easeInOut' }}
          >
            {symbol}
          </motion.span>
        </AnimatePresence>
      </motion.div>

      <div className="text-base tracking-tight opacity-85">
        <ShinyText text={`✳ ${verb} ${statusMessage || 'RFP intelligence data...'}`} speed={3} />
      </div>

      {displayTool && (
        <div className="text-xs text-gray-500 text-center max-w-xs">
          Using <span className="font-medium text-blue-400">{displayTool}</span>
        </div>
      )}
    </div>
  );
}

export default memo(DynamicStatusClaude);