import { VectorSearch } from '@/components/VectorSearch'

export default function KnowledgeGraphPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <VectorSearch />
      </div>
    </div>
  )
}