'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Search, X, Loader2 } from 'lucide-react';
import { useDebouncedCallback } from 'use-debounce';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { getEntityBrowserDossierHref } from '@/lib/entity-routing';
import { searchVectorEntities } from '@/lib/vector-search-client';

type SearchResult = Awaited<ReturnType<typeof searchVectorEntities>>['results'][number]

interface VectorSearchProps {
	className?: string;
	variant?: 'default' | 'navitem';
	compact?: boolean;
	defaultOpen?: boolean;
}

export default function VectorSearch({ className, variant = 'default', compact = false, defaultOpen = false }: VectorSearchProps) {
	const router = useRouter();
	const [isOpen, setIsOpen] = useState(defaultOpen);
	const [query, setQuery] = useState('');
	const [results, setResults] = useState<SearchResult[]>([]);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [navigatingId, setNavigatingId] = useState<string | null>(null);
	const [, startTransition] = useTransition();
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

			try {
				const data = await searchVectorEntities({
					query: searchQuery,
					limit: 10,
					score_threshold: 0.1,
					entity_types: null,
				});
				setResults(data.results || []);
			} catch (err) {
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
		const href = getEntityBrowserDossierHref({
			id: result.uuid || result.entity_id || result.id,
			properties: {
				name: result.name,
				type: result.type,
				sport: result.sport,
				country: result.country,
				league: result.metadata?.league,
				entity_id: result.entity_id,
				uuid: result.uuid,
			},
		}, '1')
		if (href) {
			setNavigatingId(result.uuid || result.entity_id || result.id);
			setIsOpen(false);
			setQuery('');
			startTransition(() => {
				router.push(href);
			});
		} else {
			setError('Unable to open this result right now.');
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
			case 'Club': return 'bg-blue-500';
			case 'Team': return 'bg-sky-500';
			case 'Competition': return 'bg-violet-500';
			case 'League': return 'bg-indigo-500';
			case 'Federation': return 'bg-emerald-500';
			case 'Organization': return 'bg-teal-500';
			case 'Person': return 'bg-green-500';
			case 'Brand': return 'bg-amber-500';
			default: return 'bg-gray-500';
		}
	};

	const getTypeIcon = (type: string) => {
		switch (type) {
			case 'Club': return '🏟️';
			case 'Team': return '👥';
			case 'Competition': return '🏆';
			case 'League': return '🥇';
			case 'Federation': return '🛡️';
			case 'Organization': return '🏢';
			case 'Person': return '👤';
			case 'Brand': return '🏷️';
			default: return '🔍';
		}
	};

	const getResultContext = (result: SearchResult) => {
		const parts = [
			result.sport,
			result.metadata?.league || result.metadata?.competition,
			result.country,
		].filter(Boolean)
		return parts.join(' • ')
	}

	const handleOpenChange = (open: boolean) => {
		setIsOpen(open);
		if (open) {
			// Focus input when popover opens
			setTimeout(() => inputRef.current?.focus(), 100);
		} else {
			// Clear state when closed
			debouncedSearch.cancel?.();
			setQuery('');
			setResults([]);
			setError(null);
			setLoading(false);
			setNavigatingId(null);
		}
	};

	// Determine trigger button styling based on variant
	const getTriggerButton = () => {
		if (variant === 'navitem') {
			return (
				<button
					type="button"
					className={`flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors text-slate-300 hover:bg-custom-border hover:text-white font-body-medium cursor-pointer ${compact ? 'justify-center px-3' : ''} ${className}`}
					onClick={() => setIsOpen(true)}
					aria-label="Open search"
				>
					<Search className="w-5 h-5 flex-shrink-0" />
					{!compact && <span className="flex-1">Search</span>}
				</button>
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

			<Dialog open={isOpen} onOpenChange={handleOpenChange}>
				<DialogContent className="max-h-[calc(100vh-2rem)] w-[calc(100vw-2rem)] max-w-[640px] overflow-hidden rounded-2xl border-0 bg-custom-box p-0 shadow-2xl">
					<div className="flex h-full w-full flex-col">
						{/* Header */}
						<div className="flex items-center gap-3 border-b border-custom-border p-6">
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
									onClick={() => handleOpenChange(false)} 
									className="text-fm-medium-grey hover:text-white p-2"
								>
									<X className="w-5 h-5" />
								</Button>
							)}
						</div>
						
						{/* Search Status */}
						{query && (
							<div className="flex items-center justify-between border-b border-custom-border px-6 py-3 text-sm text-fm-medium-grey">
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
						<div className="flex-1 overflow-y-auto">
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
									{results.map((result) => {
										const resultEntityId = result.uuid || result.entity_id || result.id
										const isNavigatingResult = navigatingId === resultEntityId

										return (
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
											aria-busy={isNavigatingResult}
										>
											<div className="flex-shrink-0">
												<span className="text-2xl group-hover:scale-110 transition-transform">
													{isNavigatingResult ? <Loader2 className="h-6 w-6 animate-spin text-yellow-400" /> : getTypeIcon(result.type)}
												</span>
											</div>
											<div className="flex-1 min-w-0">
											<div className="flex items-center gap-3 mb-2">
												<span className="font-semibold text-white text-lg truncate">{result.name}</span>
												{isNavigatingResult && (
													<span className="text-xs text-yellow-300">Opening…</span>
												)}
												<Badge variant="secondary" className={`${getTypeColor(result.type)} text-white text-sm px-2 py-1`}>
													{result.type}
												</Badge>
											</div>
												<div className="text-sm text-fm-medium-grey space-x-3">
													{getResultContext(result) && (
														<span className="inline-block">{getResultContext(result)}</span>
													)}
													{typeof result.lexical_score === 'number' && (
														<span className="inline-block">Lexical {Math.round(result.lexical_score)}%</span>
													)}
													{typeof result.semantic_score === 'number' && (
														<span className="inline-block">Semantic {Math.round(result.semantic_score)}%</span>
													)}
												</div>
											</div>
											<div className="flex-shrink-0">
												<Badge variant="outline" className="text-sm px-2 py-1 group-hover:border-yellow-400 transition-colors">
													{Math.round((result.score || 0) * 100)}% match
												</Badge>
											</div>
										</div>
										)
									})}
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
										<p>🧪 <strong>Test it:</strong> Type &quot;football&quot; then wait 200ms before typing &quot;club&quot;</p>
										<p>⚡ <strong>Smart Matching:</strong> Finds entities by name, type, and metadata</p>
									</div>
								</div>
							)}
						</div>
						
						{/* Footer */}
						<div className="border-t border-custom-border px-6 py-3 text-center text-xs text-fm-light-grey">
							Press <kbd className="px-2 py-1 bg-custom-bg rounded">Esc</kbd> to close • Click outside to dismiss
						</div>
					</div>
				</DialogContent>
			</Dialog>
		</>
	);
}
