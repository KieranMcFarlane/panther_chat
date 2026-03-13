import { VectorSearch } from '@/components/VectorSearch'

export default function SearchPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 py-6">
          <h1 className="text-3xl font-bold">Entity Browser Search</h1>
          <p className="text-muted-foreground mt-1">
            Hybrid lexical + semantic search with canonical entity ranking
          </p>
        </div>
      </div>
      <VectorSearch />
    </div>
  )
}
