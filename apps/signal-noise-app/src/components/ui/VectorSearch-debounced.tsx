'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Search, X, Loader2 } from 'lucide-react';
import { useDebouncedCallback } from 'use-debounce';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

interface SearchResult {
	id: string;
	entity_id?: string;
	name: string;
	type: 'club' | 'sportsperson' | 'poi' | 'tender' | 'contact' | 'unknown';
	score: number;
	metadata?: Record<string, any>;
}

interface VectorSearchProps {
	className?: string;
	variant?: 'default' | 'navitem';
}

export default function VectorSearch({ className, variant = 'default' }: VectorSearchProps) {
	const router = useRouter();
	const [isOpen, setIsOpen] = useState(false);
	const [query, setQuery] = useState('');
	const [results, setResults] = useState<SearchResult[]>([]);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [searchCount, setSearchCount] = useState(0);
	const inputRef = useRef<HTMLInputElement>(null);

	// Debounced search function - only fires after user stops typing for 200ms
	const debouncedSearch = useDebouncedCallback(
		async (searchQuery: string) => {
			if (!searchQuery.trim()) {
				setResults([]);
				setLoading(false);
				return;
			}

			setLoading(true);
			setError(null);
			setSearchCount(prev => prev + 1);

			try {
				const response = await fetch('/api/vector-search', {
					method: 'POST',
					headers: { 
						'Content-Type': 'application/json',
						'Cache-Control': 'no-cache',
						'Pragma': 'no-cache'
					},
					body: JSON.stringify({ 
						query: searchQuery, 
						limit: 10, 
						score_threshold: 0.1,
						entity_types: null,
						timestamp: Date.now() // Add timestamp to prevent caching
					}),
				});
				if (!response.ok) throw new Error(`HTTP ${response.status}`);
				const data = await response.json();
				setResults(data.results || []);
				console.log('Vector search results for', searchQuery, ':', data.results);
			} catch (err) {
				console.error('Vector search error:', err);
				setError('Search failed. Please try again.');
				setResults([]);
			} finally {
				setLoading(false);
			}
		},
		200, // 200ms delay - much more responsive!
		{ leading: false, trailing: true, maxWait: 1000 }
	);

	// Trigger debounced search when query changes
	useEffect(() => {
		if (query) {
			debouncedSearch(query);
		} else {
			setResults([]);
			setLoading(false);
		}
	}, [query, debouncedSearch]);

	// Handle Escape key to close modal
	useEffect(() => {
		const handleKeyDown = (event: KeyboardEvent) => {
			if (event.key === 'Escape' && isOpen) {
				handleOpenChange(false);
			}
		};

		if (isOpen) {
			document.addEventListener('keydown', handleKeyDown);
		}

		return () => {
			document.removeEventListener('keydown', handleKeyDown);
		};
	}, [isOpen]);

	const handleResultClick = (result: SearchResult) => {
		console.log('🎯 Vector Search: Clicked result:', result);
		console.log('🔍 Vector Search: result.entity_id:', result.entity_id);
		console.log('🔍 Vector Search: result.id:', result.id);
		
		// Close search immediately
		setIsOpen(false);
		setQuery('');
		
		// Navigate to entity page
		if (result.entity_id) {
			// The entity_id might need to be converted if it comes from Neo4j vs Supabase
			const entityId = result.entity_id;
			console.log('🆔 Vector Search: Extracted entityId:', entityId);
			
			// Check if it's one of our demo entities first
			const demoEntityRoutes = {
				'arsenal_fc_001': '/entity/arsenal_fc_001',
				'chelsea_fc_002': '/entity/chelsea_fc_002', 
				'martin_odegaard_003': '/entity/martin_odegaard_003',
				'tender_premier_league_001': '/entity/tender_premier_league_001',
				'contact_sports_agent_001': '/entity/contact_sports_agent_001'
			};
			
			console.log('🗺️ Vector Search: Demo routes:', Object.keys(demoEntityRoutes));
			console.log('❓ Vector Search: Is demo entity?', demoEntityRoutes.hasOwnProperty(entityId));
			
			let targetUrl;
			if (demoEntityRoutes[entityId]) {
				targetUrl = demoEntityRoutes[entityId];
				console.log('🎭 Vector Search: Using demo route:', targetUrl);
			} else {
				// For Neo4j entities, use the entity/[entityId] route
				targetUrl = `/entity/${entityId}`;
				console.log('🏟️ Vector Search: Using Neo4j route:', targetUrl);
			}
			
			console.log('🚀 Vector Search: Final target URL:', targetUrl);
			
			// Use window.location for immediate navigation
			window.location.href = targetUrl;
			
			// Fallback to router.push if window.location doesn't work
			setTimeout(() => {
				console.log('🔄 Vector Search: Using router.push fallback');
				router.push(targetUrl);
			}, 100);
		} else {
			console.warn('⚠️ Vector Search: No entity_id found in result:', result);
		}
	};

	const handleInputChange = (value: string) => {
		setQuery(value);
		if (value.trim()) {
			setLoading(true); // Show loading indicator immediately
		}
	};

	const getTypeColor = (type: string) => {
		switch (type) {
			case 'club': return 'bg-blue-500';
			case 'sportsperson': return 'bg-green-500';
			case 'tender': return 'bg-yellow-500';
			case 'poi': return 'bg-purple-500';
			case 'contact': return 'bg-orange-500';
			default: return 'bg-gray-500';
		}
	};

	const getTypeIcon = (type: string) => {
		switch (type) {
			case 'club': return '🏟️';
			case 'sportsperson': return '⚽';
			case 'tender': return '📋';
			case 'poi': return '👤';
			case 'contact': return '📞';
			default: return '🔍';
		}
	};

	const handleOpenChange = (open: boolean) => {
		setIsOpen(open);
		if (open) {
			// Focus input when popover opens
			setTimeout(() => inputRef.current?.focus(), 100);
		} else {
			// Clear state when closed
			setQuery('');
			setResults([]);
			setError(null);
			setLoading(false);
		}
	};

	// Determine trigger button styling based on variant
	const getTriggerButton = () => {
		if (variant === 'navitem') {
			return (
				<div
					className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors text-slate-300 hover:bg-custom-border hover:text-white font-body-medium cursor-pointer ${className}`}
					onClick={() => setIsOpen(true)}
				>
					<Search className="w-5 h-5 flex-shrink-0" />
					<span className="flex-1">Search</span>
					<div className="flex items-center gap-2"></div>
				</div>
			);
		}

		return (
			<Button
				variant="outline"
				size="sm"
				className={`bg-custom-box border-custom-border text-white hover:bg-custom-border hover:text-yellow-400 ${className}`}
				onClick={() => setIsOpen(true)}
			>
				<Search className="w-4 h-4 mr-2" />
				Vector Search
			</Button>
		);
	};

	return (
		<>
			{/* Trigger Button */}
			{getTriggerButton()}

			{/* Modal Overlay */}
			{isOpen && (
				<div className="fixed inset-0 z-50 flex items-start justify-center pt-20" onClick={() => handleOpenChange(false)}>
					{/* Modal Content */}
					<div className="relative w-full max-w-2xl mx-4 bg-custom-box border border-custom-border rounded-lg shadow-2xl" onClick={(e) => e.stopPropagation()}>
						{/* Header */}
						<div className="flex items-center gap-3 p-6 border-b border-custom-border">
							<Search className="w-6 h-6 text-fm-medium-grey" />
							<Input
								ref={inputRef}
								placeholder="Search clubs, players, tenders, contacts... (try 'football' then wait 200ms)"
								value={query}
								onChange={(e) => handleInputChange(e.target.value)}
								className="flex-1 bg-custom-bg border-custom-border text-white placeholder:text-fm-medium-grey text-lg px-4 py-3"
								autoFocus
							/>
							{query && (
								<Button 
									variant="ghost" 
									size="sm" 
									onClick={() => {
										setQuery('');
										setResults([]);
										setLoading(false);
									}} 
									className="text-fm-medium-grey hover:text-white p-2"
								>
									<X className="w-5 h-5" />
								</Button>
							)}
						</div>
						
						{/* Search Status */}
						{query && (
							<div className="flex items-center justify-between px-6 py-3 text-sm text-fm-medium-grey border-b border-custom-border">
								<span>
									{loading ? (
										<span className="flex items-center gap-2 text-yellow-400">
											<Loader2 className="w-4 h-4 animate-spin" />
											Searching...
										</span>
									) : (
										<span>Found {results.length} results</span>
									)}
								</span>
							</div>
						)}

						{/* Results */}
						<div className="max-h-96 overflow-y-auto">
							{loading && query && (
								<div className="p-2">
									{/* Enhanced skeleton loading cards with detailed line structure */}
									{[1, 2, 3, 4].map((i) => (
										<div key={i} className="flex items-center gap-4 p-4 rounded-md hover:bg-custom-bg cursor-pointer transition-colors select-none group animate-pulse">
											<div className="flex-shrink-0">
												<span className="text-2xl group-hover:scale-110 transition-transform text-custom-bg">🔍</span>
											</div>
											<div className="flex-1 min-w-0">
												<div className="flex items-center gap-3 mb-2">
													<div className="h-6 bg-custom-bg rounded w-56 font-semibold"></div>
													<div className="inline-flex items-center rounded-full border font-semibold transition-colors text-sm px-2 py-1 h-5 bg-custom-bg rounded w-16"></div>
												</div>
												<div className="text-sm text-fm-medium-grey space-x-3">
													<span className="inline-block h-3 bg-custom-bg rounded w-12"></span>
													<span className="inline-block h-3 bg-custom-bg rounded w-20"></span>
													<span className="inline-block h-3 bg-custom-bg rounded w-16"></span>
												</div>
											</div>
											<div className="flex-shrink-0">
												<div className="inline-flex items-center rounded-full border font-semibold text-sm px-2 py-1 h-6 bg-custom-bg rounded w-12"></div>
											</div>
										</div>
									))}
								</div>
							)}

							{error && (
								<div className="p-6 text-fm-orange text-sm text-center">
									⚠️ {error instanceof Error ? error.message : String(error)}
								</div>
							)}

							{!loading && !error && results.length > 0 && (
								<div className="p-2">
									{results.map((result) => (
										<div 
											key={result.id} 
											onClick={(e) => {
												e.preventDefault();
												e.stopPropagation();
												handleResultClick(result);
											}} 
											onMouseDown={(e) => e.preventDefault()}
											className="flex items-center gap-4 p-4 rounded-md hover:bg-custom-bg cursor-pointer transition-colors select-none group"
											title={`Click to view ${result.name}`}
										>
											<div className="flex-shrink-0">
												<span className="text-2xl group-hover:scale-110 transition-transform">{getTypeIcon(result.type)}</span>
											</div>
											<div className="flex-1 min-w-0">
												<div className="flex items-center gap-3 mb-2">
													<span className="font-semibold text-white text-lg truncate">{result.name}</span>
													<Badge variant="secondary" className={`${getTypeColor(result.type)} text-white text-sm px-2 py-1`}>
														{result.type}
													</Badge>
												</div>
												{result.metadata && (
													<div className="text-sm text-fm-medium-grey space-x-3">
														{Object.entries(result.metadata).slice(0, 3).map(([key, value]) => (
															<span key={key} className="inline-block">
																<strong>{key}:</strong> {String(value)}
															</span>
														))}
													</div>
												)}
											</div>
											<div className="flex-shrink-0">
												<Badge variant="outline" className="text-sm px-2 py-1 group-hover:border-yellow-400 transition-colors">
													{Math.round((result.score || 0) * 100)}% match
												</Badge>
											</div>
										</div>
									))}
								</div>
							)}

							{!loading && !error && query && results.length === 0 && (
								<div className="p-8 text-center text-fm-medium-grey">
									<Search className="w-12 h-12 mx-auto mb-4 opacity-50" />
									<p className="text-lg mb-2">No results found</p>
									<p className="text-sm">Try different keywords or check spelling</p>
								</div>
							)}

							{!loading && !error && !query && (
								<div className="p-8 text-center text-fm-medium-grey">
									<Search className="w-12 h-12 mx-auto mb-4 opacity-50" />
									<p className="text-lg mb-2">Start typing to search</p>
									<p className="text-sm mb-6">Search across clubs, players, tenders, and contacts</p>
									<div className="space-y-2 text-xs text-fm-light-grey bg-custom-bg/50 rounded-lg p-4 mx-auto max-w-md">
										<p>💡 <strong>Debounced Search:</strong> Results appear 200ms after you stop typing</p>
										<p>🧪 <strong>Test it:</strong> Type "football" then wait 200ms before typing "club"</p>
										<p>⚡ <strong>Smart Matching:</strong> Finds entities by name, type, and metadata</p>
									</div>
								</div>
							)}
						</div>
						
						{/* Footer */}
						<div className="px-6 py-3 border-t border-custom-border text-xs text-fm-light-grey text-center">
							Press <kbd className="px-2 py-1 bg-custom-bg rounded">Esc</kbd> to close • Click outside to dismiss
						</div>
					</div>
				</div>
			)}
		</>
	);
}