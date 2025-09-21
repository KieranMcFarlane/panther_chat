'use client';

import { useState, useRef, useEffect } from 'react';
import { Search, X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

interface SearchResult {
	id: string;
	name: string;
	type: 'club' | 'sportsperson' | 'poi' | 'tender' | 'contact' | 'unknown';
	score: number;
	metadata?: Record<string, any>;
}

interface VectorSearchProps {
	className?: string;
}

export default function VectorSearch({ className }: VectorSearchProps) {
	const [isOpen, setIsOpen] = useState(false);
	const [query, setQuery] = useState('');
	const [results, setResults] = useState<SearchResult[]>([]);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const inputRef = useRef<HTMLInputElement>(null);

	const performVectorSearch = async (searchQuery: string) => {
		if (!searchQuery.trim()) {
			setResults([]);
			return;
		}

		setLoading(true);
		setError(null);

		try {
			const response = await fetch('/api/vector-search', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ query: searchQuery, limit: 10, score_threshold: 0.2 }),
			});
			if (!response.ok) throw new Error(`HTTP ${response.status}`);
			const data = await response.json();
			setResults(data.results || []);
		} catch (err) {
			setError('Search failed. Please try again.');
			setResults([]);
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		const timeoutId = setTimeout(() => {
			if (query) performVectorSearch(query);
		}, 300);
		return () => clearTimeout(timeoutId);
	}, [query]);

	const handleResultClick = (result: SearchResult) => {
		console.log('Navigating to:', result);
		setIsOpen(false);
		setQuery('');
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

	return (
		<Popover open={isOpen} onOpenChange={setIsOpen}>
			<PopoverTrigger asChild>
				<Button
					variant="outline"
					size="sm"
					className={`bg-custom-box border-custom-border text-white hover:bg-custom-border hover:text-yellow-400 ${className}`}
					onClick={() => {
						setIsOpen(true);
						setTimeout(() => inputRef.current?.focus(), 100);
					}}
				>
					<Search className="w-4 h-4 mr-2" />
					Vector Search
				</Button>
			</PopoverTrigger>

			<PopoverContent className="w-96 p-0 bg-custom-box border-custom-border" side="bottom" align="end">
				<div className="p-4 border-b border-custom-border">
					<div className="flex items-center gap-2">
						<Search className="w-4 h-4 text-fm-medium-grey" />
						<Input
							ref={inputRef}
							placeholder="Search clubs, players, tenders, contacts..."
							value={query}
							onChange={(e) => setQuery(e.target.value)}
							className="bg-custom-bg border-custom-border text-white placeholder:text-fm-medium-grey"
						/>
						{query && (
							<Button variant="ghost" size="sm" onClick={() => { setQuery(''); setResults([]); }} className="text-fm-medium-grey hover:text-white">
								<X className="w-4 h-4" />
							</Button>
						)}
					</div>
				</div>

				<div className="max-h-96 overflow-y-auto">
					{loading && (
						<div className="flex items-center justify-center p-6">
							<Loader2 className="w-5 h-5 animate-spin text-yellow-400" />
							<span className="ml-2 text-fm-light-grey">Searching...</span>
						</div>
					)}

					{error && (<div className="p-4 text-fm-orange text-sm">{error}</div>)}

					{!loading && !error && results.length > 0 && (
						<div className="p-2">
							{results.map((result) => (
								<div key={result.id} onClick={() => handleResultClick(result)} className="flex items-center gap-3 p-3 rounded-md hover:bg-custom-bg cursor-pointer transition-colors">
									<div className="flex-shrink-0">
										<span className="text-lg">{getTypeIcon(result.type)}</span>
									</div>
									<div className="flex-1 min-w-0">
										<div className="flex items-center gap-2 mb-1">
											<span className="font-medium text-white truncate">{result.name}</span>
											<Badge variant="secondary" className={`${getTypeColor(result.type)} text-white text-xs`}>
												{result.type}
											</Badge>
										</div>
										{result.metadata && (
											<div className="text-xs text-fm-medium-grey space-x-2">
												{Object.entries(result.metadata).slice(0, 4).map(([key, value]) => (
													<span key={key}>{key}: {String(value)}</span>
												))}
											</div>
										)}
									</div>
									<div className="flex-shrink-0">
										<Badge variant="outline" className="text-xs">
											{Math.round((result.score || 0) * 100)}%
										</Badge>
									</div>
								</div>
							))}
						</div>
					)}

					{!loading && !error && query && results.length === 0 && (
						<div className="p-6 text-center text-fm-medium-grey">
							<Search className="w-8 h-8 mx-auto mb-2 opacity-50" />
							<p>No results found</p>
							<p className="text-xs mt-1">Try different keywords or check spelling</p>
						</div>
					)}

					{!loading && !error && !query && (
						<div className="p-6 text-center text-fm-medium-grey">
							<Search className="w-8 h-8 mx-auto mb-2 opacity-50" />
							<p>Start typing to search</p>
							<p className="text-xs mt-1">Search across clubs, players, tenders, and contacts</p>
						</div>
					)}
				</div>
			</PopoverContent>
		</Popover>
	);
}
