'use client';

/**
 * GraphRAG Test Page
 *
 * Interactive interface for testing the GraphRAG (Graph Retrieval-Augmented Generation)
 * capabilities of the knowledge graph system.
 */

import { useState } from 'react';

interface SearchResult {
  rank: number;
  fact: string;
  source: string;
  entities: string[];
  category: string;
  relevance: number;
}

interface SearchResponse {
  query: string;
  results: SearchResult[];
  count: number;
  timestamp: string;
}

const SAMPLE_QUERIES = [
  'What RFPs have been issued by Premier League clubs?',
  'Which clubs are looking for digital transformation projects?',
  'Tell me about stadium infrastructure opportunities',
  'What AI and analytics RFPs exist?',
  'Show me technology-related procurement opportunities',
];

export default function GraphRAGTestPage() {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<SearchResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = async (searchQuery?: string) => {
    const q = searchQuery || query;
    if (!q.trim()) return;

    setLoading(true);
    setError(null);
    setResponse(null);

    try {
      const res = await fetch(`/api/graphrag?query=${encodeURIComponent(q)}&num_results=5`);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Search failed');
      }

      setResponse(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSearch();
    }
  };

  return (
    <div className="min-h-screen bg-custom-bg text-white p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2 text-custom-accent">
            GraphRAG Knowledge Search
          </h1>
          <p className="text-custom-muted">
            Search the temporal knowledge graph using Graph RAG (Retrieval-Augmented Generation)
          </p>
        </div>

        {/* Search Input */}
        <div className="bg-custom-box border border-custom-border rounded-lg p-6 mb-6">
          <label className="block text-sm font-medium mb-2 text-custom-muted">
            Search Query
          </label>
          <textarea
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyPress}
            placeholder="Ask about RFPs, clubs, opportunities... (e.g., 'What digital transformation RFPs exist?')"
            className="w-full bg-custom-bg border border-custom-border rounded-lg p-3 text-white placeholder-custom-muted focus:outline-none focus:ring-2 focus:ring-custom-accent min-h-[100px] resize-y"
            rows={3}
          />

          <div className="flex justify-between items-center mt-4">
            <div className="text-sm text-custom-muted">
              Press Enter to search
            </div>
            <button
              onClick={() => handleSearch()}
              disabled={loading || !query.trim()}
              className="px-6 py-2 bg-custom-accent hover:bg-custom-accent/80 disabled:bg-custom-muted disabled:cursor-not-allowed rounded-lg font-medium transition-colors"
            >
              {loading ? 'Searching...' : 'Search Graph'}
            </button>
          </div>
        </div>

        {/* Sample Queries */}
        <div className="mb-6">
          <p className="text-sm text-custom-muted mb-2">Try these sample queries:</p>
          <div className="flex flex-wrap gap-2">
            {SAMPLE_QUERIES.map((sample, i) => (
              <button
                key={i}
                onClick={() => {
                  setQuery(sample);
                  handleSearch(sample);
                }}
                className="px-3 py-1 text-sm bg-custom-box border border-custom-border rounded-full hover:border-custom-accent transition-colors"
              >
                {sample}
              </button>
            ))}
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="bg-red-900/30 border border-red-700 rounded-lg p-4 mb-6">
            <p className="text-red-300">❌ Error: {error}</p>
          </div>
        )}

        {/* Results Display */}
        {response && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-semibold">
                Search Results
              </h2>
              <span className="text-sm text-custom-muted">
                {response.count} results • {new Date(response.timestamp).toLocaleTimeString()}
              </span>
            </div>

            {response.results.length === 0 ? (
              <div className="bg-custom-box border border-custom-border rounded-lg p-8 text-center">
                <p className="text-custom-muted">No results found. Try a different query.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {response.results.map((result) => (
                  <div
                    key={result.rank}
                    className="bg-custom-box border border-custom-border rounded-lg p-5 hover:border-custom-accent transition-colors"
                  >
                    <div className="flex justify-between items-start mb-2">
                      <span className="text-xs font-mono bg-custom-accent/20 text-custom-accent px-2 py-1 rounded">
                        Rank #{result.rank}
                      </span>
                      <span className="text-xs text-custom-muted">
                        Relevance: {(result.relevance * 100).toFixed(0)}%
                      </span>
                    </div>

                    <p className="text-white mb-3 leading-relaxed">
                      {result.fact}
                    </p>

                    <div className="flex flex-wrap gap-2 text-xs">
                      <span className="px-2 py-1 bg-custom-bg rounded text-custom-muted">
                        📁 {result.category}
                      </span>
                      {result.entities.map((entity) => (
                        <span
                          key={entity}
                          className="px-2 py-1 bg-custom-bg rounded text-custom-accent"
                        >
                          {entity}
                        </span>
                      ))}
                    </div>

                    <div className="mt-2 text-xs text-custom-muted">
                      Source: {result.source}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Info Panel */}
        <div className="mt-12 bg-custom-box border border-custom-border rounded-lg p-6">
          <h3 className="text-lg font-semibold mb-3">About GraphRAG</h3>
          <div className="space-y-2 text-sm text-custom-muted">
            <p>
              <strong className="text-white">GraphRAG</strong> combines knowledge graphs with
              retrieval-augmented generation to provide contextual, relevant information.
            </p>
            <p>
              This system uses <strong className="text-white">Graphiti</strong> to maintain
              a temporal knowledge graph of RFPs, entities, and relationships, enabling
              intelligent search across time and context.
            </p>
            <p className="text-xs mt-3 pt-3 border-t border-custom-border">
              Backend: Neo4j/FalkorDB + Graphiti | Embeddings: OpenAI/Voyage | LLM: Anthropic Claude
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
