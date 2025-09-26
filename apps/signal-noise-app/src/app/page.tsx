import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Database, Search, Brain, Zap } from 'lucide-react'

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-4">Signal Noise App</h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            AI-powered knowledge graph search and analysis platform
          </p>
        </div>

        {/* Feature Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5" />
                Knowledge Graph
              </CardTitle>
              <CardDescription>
                Explore your Neo4j knowledge graph with powerful search capabilities
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/knowledge-graph">
                <Button className="w-full">
                  Explore Knowledge Graph
                </Button>
              </Link>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Search className="h-5 w-5" />
                Entity Search
              </CardTitle>
              <CardDescription>
                Search for contacts, organizations, and entities in your database
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/entities">
                <Button className="w-full" variant="outline">
                  Search Entities
                </Button>
              </Link>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Brain className="h-5 w-5" />
                AI Intelligence
              </CardTitle>
              <CardDescription>
                Leverage AI-powered analysis and insights from your data
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/opportunities">
                <Button className="w-full" variant="outline">
                  View Opportunities
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>

        {/* Quick Stats */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5" />
              System Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
              <div>
                <div className="text-2xl font-bold text-green-600">●</div>
                <div className="text-sm text-muted-foreground">Neo4j Database</div>
                <div className="text-sm font-medium">Connected</div>
              </div>
              <div>
                <div className="text-2xl font-bold">AI</div>
                <div className="text-sm text-muted-foreground">Embeddings</div>
                <div className="text-sm font-medium">Ready</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-blue-600">✓</div>
                <div className="text-sm text-muted-foreground">API Services</div>
                <div className="text-sm font-medium">Online</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}