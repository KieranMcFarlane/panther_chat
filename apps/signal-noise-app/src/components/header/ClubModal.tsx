'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';

const clubs = [
  { id: 1, name: 'Manchester United', country: 'England' },
  { id: 2, name: 'Real Madrid', country: 'Spain' },
  { id: 3, name: 'Bayern Munich', country: 'Germany' },
  { id: 4, name: 'Paris Saint-Germain', country: 'France' },
  { id: 5, name: 'Juventus', country: 'Italy' },
  { id: 6, name: 'Ajax', country: 'Netherlands' },
  { id: 7, name: 'Celtic', country: 'Scotland' },
  { id: 8, name: 'Anderlecht', country: 'Belgium' },
];

export default function ClubModal() {
  const [selectedClubs, setSelectedClubs] = useState<number[]>([]);
  const [isOpen, setIsOpen] = useState(false);

  const handleClubToggle = (clubId: number) => {
    setSelectedClubs(prev =>
      prev.includes(clubId)
        ? prev.filter(id => id !== clubId)
        : [...prev, clubId]
    );
  };

  const handleApplyFilters = () => {
    console.log('Applied club filters:', selectedClubs);
    setIsOpen(false);
  };

  const handleClearFilters = () => {
    setSelectedClubs([]);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <div className="relative rounded-lg overflow-hidden cursor-pointer" title="1. FC Köln" style={{ width: '6.25rem', height: '6.25rem' }}>
          <img 
            src="https://sportsintelligence.s3.eu-north-1.amazonaws.com/badges/1-fc-koln-badge.png" 
            alt="1. FC Köln badge" 
            className="w-full h-full object-cover"
          />
        </div>
      </DialogTrigger>
      <DialogContent 
        className="sm:max-w-[500px]" 
        style={{ backgroundColor: '#1c1e2d' }}
      >
        <DialogHeader>
          <DialogTitle>Filter by Clubs</DialogTitle>
          <DialogDescription>
            Select clubs to filter your view. You can choose multiple clubs.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="max-h-[400px] overflow-y-auto space-y-3">
            {clubs.map((club) => (
              <div key={club.id} className="flex items-center space-x-2">
                <Checkbox
                  id={`club-${club.id}`}
                  checked={selectedClubs.includes(club.id)}
                  onCheckedChange={() => handleClubToggle(club.id)}
                />
                <label
                  htmlFor={`club-${club.id}`}
                  className="flex items-center justify-between w-full cursor-pointer"
                >
                  <span className="text-sm font-medium">{club.name}</span>
                  <Badge variant="secondary" className="text-xs">
                    {club.country}
                  </Badge>
                </label>
              </div>
            ))}
          </div>
          
          <div className="flex items-center justify-between pt-4 border-t">
            <Button
              variant="outline"
              size="sm"
              onClick={handleClearFilters}
              disabled={selectedClubs.length === 0}
            >
              Clear All
            </Button>
            <div className="text-sm text-muted-foreground">
              {selectedClubs.length} club{selectedClubs.length !== 1 ? 's' : ''} selected
            </div>
            <Button size="sm" onClick={handleApplyFilters}>
              Apply Filters
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}