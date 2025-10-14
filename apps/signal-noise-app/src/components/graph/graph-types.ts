export interface GraphNode {
  id: string;
  label: string;
  type: 'club' | 'sportsperson' | 'poi' | 'tender' | 'league' | 'venue';
  x?: number;
  y?: number;
  color: string;
  size: number;
  description?: string;
  data?: any; // Original entity data
}

export interface GraphEdge {
  source: string;
  target: string;
  strength: number;
  label?: string;
  type?: string;
  color?: string;
}