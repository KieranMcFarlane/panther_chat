'use client';

import { useEffect, useState, memo } from "react";

const actionVerbs = [
  "Accomplishing", "Actioning", "Actualizing", "Analyzing", "Baking", "Brewing",
  "Calculating", "Cerebrating", "Churning", "Clauding", "Coalescing",
  "Cogitating", "Computing", "Conjuring", "Considering", "Cooking",
  "Crafting", "Creating", "Crunching", "Deliberating", "Determining",
  "Effecting", "Executing", "Exploring", "Finagling", "Forging", "Forming", 
  "Generating", "Gathering", "Hatching", "Herding", "Honking", "Hustling", 
  "Ideating", "Inferring", "Investigating", "Manifesting", "Marinating", 
  "Moseying", "Mulling", "Mustering", "Musing", "Noodling", "Percolating", 
  "Pondering", "Processing", "Puttering", "Querying", "Reticulating", 
  "Ruminating", "Sarching", "Schlepping", "Scraping", "Searching", 
  "Shucking", "Simmering", "Smooshing", "Spinning", "Stewing", 
  "Synthesizing", "Thinking", "Transmuting", "Vibing", "Working"
];

const toolActionMap: { [key: string]: string[] } = {
  "mcp__neo4j-mcp__execute_query": ["Querying", "Analyzing", "Investigating"],
  "mcp__neo4j-mcp__search_nodes": ["Searching", "Finding", "Discovering"],
  "mcp__brightData__search_engine": ["Searching", "Scouring", "Exploring"],
  "mcp__brightData__scrape_as_markdown": ["Scraping", "Gathering", "Collecting"],
  "mcp__perplexity-mcp__chat_completion": ["Analyzing", "Reasoning", "Synthesizing"],
  "WebSearch": ["Searching", "Exploring", "Discovering"],
  "WebFetch": ["Fetching", "Gathering", "Retrieving"]
};

interface DynamicStatusProps {
  currentTool?: string;
  isLoading?: boolean;
  statusMessage?: string;
}

function DynamicStatus({ currentTool, isLoading = true, statusMessage }: DynamicStatusProps) {
  const [verb, setVerb] = useState("Analyzing");
  const [displayTool, setDisplayTool] = useState<string>("");
  const [counter, setCounter] = useState(0);
  const [currentStatus, setCurrentStatus] = useState<string>("");

  useEffect(() => {
    if (!isLoading) return;

    const interval = setInterval(() => {
      setCounter(prev => prev + 1);
      
      // Change verb every 2.5 seconds for smoother cycling
      if (counter % 5 === 0) {
        let newVerb: string;
        
        if (currentTool && toolActionMap[currentTool]) {
          // Use tool-specific verbs
          const toolVerbs = toolActionMap[currentTool];
          newVerb = toolVerbs[Math.floor(Math.random() * toolVerbs.length)];
        } else {
          // Use general action verbs
          const random = Math.floor(Math.random() * actionVerbs.length);
          newVerb = actionVerbs[random];
        }
        
        setVerb(newVerb);
      }
    }, 500); // Update every 500ms for smooth transitions

    return () => clearInterval(interval);
  }, [counter, currentTool, isLoading]);

  useEffect(() => {
    if (currentTool) {
      // Format tool name for display
      const toolName = currentTool.replace('mcp__', '').replace('__', ' - ');
      setDisplayTool(toolName);
    } else {
      setDisplayTool("");
    }
  }, [currentTool]);

  useEffect(() => {
    if (statusMessage) {
      setCurrentStatus(statusMessage);
    }
  }, [statusMessage]);

  if (!isLoading) return null;

  return (
    <div className="flex flex-col items-center space-y-2">
      <div className="relative inline-block">
        <div className="shiny-text high-contrast text-lg font-medium" style={{ animationDuration: '2.5s' }}>
          {verb}…
        </div>
      </div>
      
      {/* Show single status message that replaces previous ones */}
      {currentStatus && (
        <div className="text-xs text-gray-600 text-center max-w-xs">
          {currentStatus}
        </div>
      )}
      
      {displayTool && !currentStatus && (
        <div className="text-sm text-gray-600 text-center max-w-xs">
          Using <span className="font-medium text-blue-500">{displayTool}</span>
        </div>
      )}
    </div>
  );
}

export default DynamicStatus;