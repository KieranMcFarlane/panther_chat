'use client';

import { useState, useEffect } from 'react';
import { Users, Phone, Mail, MapPin, Building, Star } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { db, POIContact } from '@/lib/database';

interface Contact extends POIContact {
  id: string; // For UI compatibility
}

export default function ContactsPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const mockContacts: Contact[] = [
      {
        id: '1',
        name: 'John Smith',
        role: 'CEO',
        affiliation: 'Manchester United FC',
        poiScore: 9.2,
        relationshipStrength: 8.5,
        contactInfo: {
          email: 'john.smith@manutd.com',
          phone: '+44 161 123 4567',
          location: 'Manchester, UK'
        },
        tags: ['Football', 'CEO', 'High Priority']
      },
      {
        id: '2',
        name: 'Sarah Johnson',
        role: 'Marketing Director',
        affiliation: 'Liverpool FC',
        poiScore: 7.8,
        relationshipStrength: 6.2,
        contactInfo: {
          email: 'sarah.johnson@liverpoolfc.com',
          location: 'Liverpool, UK'
        },
        tags: ['Football', 'Marketing', 'Mid Priority']
      }
    ];

    setContacts(mockContacts);
    setLoading(false);
  }, []);

  const filteredContacts = contacts.filter(contact =>
    contact.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    contact.role.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-yellow-400"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Contacts & POIs</h1>
          <p className="text-fm-light-grey">Manage relationships and track engagement</p>
        </div>
        <Button className="bg-yellow-500 text-black hover:bg-yellow-400">
          <Users className="w-4 h-4 mr-2" />
          Add Contact
        </Button>
      </div>

      <Input
        placeholder="Search contacts..."
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        className="bg-custom-box border-custom-border text-white placeholder:text-fm-medium-grey"
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredContacts.map((contact) => (
          <div
            key={contact.id}
            className="bg-custom-box border border-custom-border rounded-lg p-4"
          >
            <div className="flex items-start justify-between mb-3">
              <div>
                <h3 className="font-semibold text-white text-lg">{contact.name}</h3>
                <p className="text-fm-medium-grey text-sm">{contact.role}</p>
              </div>
              <Badge variant="secondary" className="bg-red-500 text-white text-xs">
                High Priority
              </Badge>
            </div>

            <div className="flex items-center gap-2 mb-3">
              <Building className="w-4 h-4 text-fm-medium-grey" />
              <span className="text-fm-light-grey text-sm">{contact.affiliation}</span>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-3">
              <div className="text-center">
                <div className="text-lg font-semibold text-green-400">
                  {contact.poiScore}
                </div>
                <div className="text-xs text-fm-medium-grey">POI Score</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-semibold text-yellow-400">
                  {contact.relationshipStrength}
                </div>
                <div className="text-xs text-fm-medium-grey">Relationship</div>
              </div>
            </div>

            <div className="space-y-2 mb-3">
              {contact.contactInfo.email && (
                <div className="flex items-center gap-2 text-sm">
                  <Mail className="w-3 h-3 text-fm-medium-grey" />
                  <span className="text-fm-light-grey">{contact.contactInfo.email}</span>
                </div>
              )}
              {contact.contactInfo.phone && (
                <div className="flex items-center gap-2 text-sm">
                  <Phone className="w-3 h-3 text-fm-medium-grey" />
                  <span className="text-fm-light-grey">{contact.contactInfo.phone}</span>
                </div>
              )}
            </div>

            <div className="flex flex-wrap gap-1 mb-3">
              {contact.tags.map((tag, index) => (
                <Badge key={index} variant="outline" className="text-xs">
                  {tag}
                </Badge>
              ))}
            </div>

            <div className="flex gap-2">
              <Button size="sm" variant="outline" className="flex-1">
                <Mail className="w-3 h-3 mr-1" />
                Contact
              </Button>
              <Button size="sm" variant="outline" className="flex-1">
                <Star className="w-3 h-3 mr-1" />
                View Profile
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
