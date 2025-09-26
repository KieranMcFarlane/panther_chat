import { VectorSearch } from '@/components/VectorSearch'
import { Neo4jConnectionStatus } from '@/components/Neo4jConnectionStatus'

export default function KnowledgeGraphPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <Neo4jConnectionStatus />
        <VectorSearch />
      </div>
    </div>
  )
}