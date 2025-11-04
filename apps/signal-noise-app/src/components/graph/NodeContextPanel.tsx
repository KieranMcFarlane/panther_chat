'use client';

import { useState, useCallback } from 'react';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { 
  Building, 
  Users, 
  Target, 
  FileText, 
  Trophy, 
  MapPin, 
  Mail, 
  Phone,
  Calendar,
  TrendingUp,
  Link,
  Star,
  Eye,
  X
} from 'lucide-react';

interface GraphNode {
  id: string;
  label: string;
  type: 'club' | 'sportsperson' | 'poi' | 'tender' | 'league' | 'venue';
  color: string;
  size: number;
  description?: string;
  data?: any;
}

interface NodeContextPanelProps {
  node: GraphNode | null;
  isOpen: boolean;
  onClose: () => void;
  isMobile?: boolean;
}

export default function NodeContextPanel({ 
  node, 
  isOpen, 
  onClose, 
  isMobile = false 
}: NodeContextPanelProps) {
  const [activeTab, setActiveTab] = useState('overview');

  if (!node) return null;

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'club': return <Building className="w-4 h-4" />;
      case 'sportsperson': return <Users className="w-4 h-4" />;
      case 'poi': return <Target className="w-4 h-4" />;
      case 'tender': return <FileText className="w-4 h-4" />;
      case 'league': return <Trophy className="w-4 h-4" />;
      case 'venue': return <MapPin className="w-4 h-4" />;
      default: return <Eye className="w-4 h-4" />;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'club': return 'bg-blue-500';
      case 'sportsperson': return 'bg-green-500';
      case 'poi': return 'bg-purple-500';
      case 'tender': return 'bg-yellow-500';
      case 'league': return 'bg-red-500';
      case 'venue': return 'bg-indigo-500';
      default: return 'bg-gray-500';
    }
  };

  const renderOverview = () => (
    <div className="space-y-6">
      {/* Entity Header */}
      <div className="flex items-center gap-4">
        <div className={`w-12 h-12 rounded-full ${getTypeColor(node.type)} flex items-center justify-center text-white`}>
          {getTypeIcon(node.type)}
        </div>
        <div className="flex-1">
          <h3 className="text-xl font-bold text-white">{node.label}</h3>
          <p className="text-fm-light-grey capitalize">{node.type}</p>
        </div>
        <Badge variant="outline" className="text-fm-light-grey border-fm-medium-grey">
          ID: {node.id}
        </Badge>
      </div>

      {/* Description */}
      {node.data?.description && (
        <Card className="bg-custom-box border-custom-border">
          <CardContent className="p-4">
            <p className="text-fm-light-grey">{node.data.description}</p>
          </CardContent>
        </Card>
      )}

      {/* Key Metrics */}
      {node.data && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Object.entries(node.data)
            .filter(([key]) => !['entity_id', 'name', 'description', 'vector_embedding'].includes(key))
            .slice(0, 6)
            .map(([key, value]) => (
              <Card key={key} className="bg-custom-box border-custom-border">
                <CardContent className="p-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-fm-medium-grey capitalize">
                      {key.replace(/_/g, ' ')}
                    </span>
                    {typeof value === 'number' && key.includes('score') ? (
                      <div className="flex items-center gap-2">
                        <Progress value={value * 10} className="w-16 h-2" />
                        <span className="text-sm text-white font-medium">
                          {value}/10
                        </span>
                      </div>
                    ) : (
                      <span className="text-sm text-white font-medium">
                        {Array.isArray(value) ? value.join(', ') : String(value)}
                      </span>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
        </div>
      )}
    </div>
  );

  const renderRelationships = () => {
    // Mock relationships data - in production, this would come from Neo4j
    const mockRelationships = [
      { type: 'CONNECTED_TO', target: 'Related Entity', strength: 0.85 },
      { type: 'WORKS_WITH', target: 'Partner Entity', strength: 0.92 },
      { type: 'PART_OF', target: 'Parent Entity', strength: 0.78 },
    ];

    return (
      <div className="space-y-4">
        <Card className="bg-custom-box border-custom-border">
          <CardHeader>
            <CardTitle className="text-lg text-white">Entity Relationships</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-fm-light-grey">Relationship</TableHead>
                  <TableHead className="text-fm-light-grey">Connected To</TableHead>
                  <TableHead className="text-fm-light-grey">Strength</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {mockRelationships.map((rel, index) => (
                  <TableRow key={index}>
                    <TableCell className="text-white">
                      <Badge variant="outline" className="border-purple-500 text-purple-400">
                        {rel.type}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-white">{rel.target}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Progress value={rel.strength * 100} className="w-16 h-2" />
                        <span className="text-sm text-fm-light-grey">
                          {Math.round(rel.strength * 100)}%
                        </span>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card className="bg-custom-box border-custom-border">
          <CardHeader>
            <CardTitle className="text-lg text-white">Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button variant="outline" className="w-full border-custom-border text-fm-light-grey hover:text-black hover:bg-white">
              <Link className="w-4 h-4 mr-2" />
              View Related Entities
            </Button>
            <Button variant="outline" className="w-full border-custom-border text-fm-light-grey hover:text-black hover:bg-white">
              <TrendingUp className="w-4 h-4 mr-2" />
              Analyze Relationships
            </Button>
            <Button variant="outline" className="w-full border-custom-border text-fm-light-grey hover:text-black hover:bg-white">
              <Star className="w-4 h-4 mr-2" />
              Add to Favorites
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  };

  const renderDetails = () => (
    <div className="space-y-4">
      {node.data && (
        <>
          {/* Contact Information */}
          {node.data.contact_info && (
            <Card className="bg-custom-box border-custom-border">
              <CardHeader>
                <CardTitle className="text-lg text-white flex items-center gap-2">
                  <Mail className="w-5 h-5" />
                  Contact Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {node.data.contact_info.email && (
                  <div className="flex items-center gap-3">
                    <Mail className="w-4 h-4 text-fm-medium-grey" />
                    <span className="text-fm-light-grey">{node.data.contact_info.email}</span>
                  </div>
                )}
                {node.data.contact_info.phone && (
                  <div className="flex items-center gap-3">
                    <Phone className="w-4 h-4 text-fm-medium-grey" />
                    <span className="text-fm-light-grey">{node.data.contact_info.phone}</span>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Location Information */}
          {node.data.location && (
            <Card className="bg-custom-box border-custom-border">
              <CardHeader>
                <CardTitle className="text-lg text-white flex items-center gap-2">
                  <MapPin className="w-5 h-5" />
                  Location
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-fm-light-grey">{node.data.location}</p>
              </CardContent>
            </Card>
          )}

          {/* Tags */}
          {node.data.tags && (
            <Card className="bg-custom-box border-custom-border">
              <CardHeader>
                <CardTitle className="text-lg text-white">Tags</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {node.data.tags.map((tag: string, index: number) => (
                    <Badge key={index} variant="secondary" className="bg-custom-bg text-fm-light-grey">
                      {tag}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Last Updated */}
          {node.data.last_updated && (
            <Card className="bg-custom-box border-custom-border">
              <CardHeader>
                <CardTitle className="text-lg text-white flex items-center gap-2">
                  <Calendar className="w-5 h-5" />
                  Data Information
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-fm-medium-grey">Last Updated:</span>
                    <span className="text-fm-light-grey">
                      {new Date(node.data.last_updated).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-fm-medium-grey">Trust Score:</span>
                    <span className="text-fm-light-grey">
                      {node.data.trust_score ? `${node.data.trust_score}/10` : 'N/A'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-fm-medium-grey">Source:</span>
                    <span className="text-fm-light-grey">
                      {node.data.source || 'Unknown'}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );

  const content = (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-6 border-b border-custom-border" style={{ background: '#242834' }}>
        <div className="flex items-center gap-3">
          <div className={`w-8 h-8 rounded-full ${getTypeColor(node.type)} flex items-center justify-center text-white`}>
            {getTypeIcon(node.type)}
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white">{node.label}</h2>
            <p className="text-sm text-fm-medium-grey capitalize">{node.type}</p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onClose}
          className="text-white hover:text-black hover:bg-white"
        >
          <X className="w-4 h-4" />
        </Button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6" style={{ backgroundColor: '#242834' }}>
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3 bg-custom-box border-custom-border">
            <TabsTrigger 
              value="overview" 
              className="data-[state=active]:bg-custom-bg data-[state=active]:text-white text-fm-light-grey"
            >
              Overview
            </TabsTrigger>
            <TabsTrigger 
              value="relationships" 
              className="data-[state=active]:bg-custom-bg data-[state=active]:text-white text-fm-light-grey"
            >
              Relationships
            </TabsTrigger>
            <TabsTrigger 
              value="details" 
              className="data-[state=active]:bg-custom-bg data-[state=active]:text-white text-fm-light-grey"
            >
              Details
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="overview" className="mt-6">
            {renderOverview()}
          </TabsContent>
          
          <TabsContent value="relationships" className="mt-6">
            {renderRelationships()}
          </TabsContent>
          
          <TabsContent value="details" className="mt-6">
            {renderDetails()}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );

  // Use Dialog for desktop, Sheet for mobile
  if (isMobile) {
    return (
      <Sheet open={isOpen} onOpenChange={onClose}>
        <SheetContent side="right" className="w-full sm:w-[540px] bg-custom-bg border-custom-border p-0">
          {content}
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl w-full bg-custom-bg border-custom-border p-0">
        {content}
      </DialogContent>
    </Dialog>
  );
}