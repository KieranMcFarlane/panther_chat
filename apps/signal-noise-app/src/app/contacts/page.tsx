'use client';

import { useState, useEffect } from 'react';
import { Users, Phone, Mail, MapPin, Building, Star, MessageCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { db, POIContact } from '@/lib/database';
import EmailAssistant from '@/components/email/EmailAssistant';
import { useCopilotAction } from '@copilotkit/react-core';

interface Contact extends POIContact {
  id: string; // For UI compatibility
}

export default function ContactsPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [showEmailAssistant, setShowEmailAssistant] = useState(false);
  const [emailStatus, setEmailStatus] = useState<{ message: string; type: 'success' | 'error' | '' }>({ message: '', type: '' });

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

  // CopilotKit action to find contacts
  useCopilotAction({
    name: "findContact",
    description: "Find a contact by name, role, or organization",
    parameters: [
      {
        name: "query",
        type: "string",
        description: "Search query to find contact"
      }
    ],
    handler: async ({ query }) => {
      const found = contacts.find(contact => 
        contact.name.toLowerCase().includes(query.toLowerCase()) ||
        contact.role.toLowerCase().includes(query.toLowerCase()) ||
        contact.affiliation.toLowerCase().includes(query.toLowerCase())
      );

      if (found) {
        setSelectedContact(found);
        return `Found contact: ${found.name}, ${found.role} at ${found.affiliation}. Email: ${found.contactInfo.email}`;
      } else {
        return `No contact found for "${query}". Available contacts: ${contacts.map(c => c.name).join(', ')}`;
      }
    }
  });

  // CopilotKit action to compose email
  useCopilotAction({
    name: "composeEmailTo",
    description: "Open email composer for a specific contact",
    parameters: [
      {
        name: "contactName",
        type: "string",
        description: "Name of the contact to email"
      },
      {
        name: "intent",
        type: "string",
        description: "Purpose of the email"
      }
    ],
    handler: async ({ contactName, intent }) => {
      const contact = contacts.find(c => 
        c.name.toLowerCase().includes(contactName.toLowerCase())
      );

      if (contact) {
        setSelectedContact(contact);
        setShowEmailAssistant(true);
        return `Opening email composer for ${contact.name} with intent: ${intent}`;
      } else {
        return `Contact "${contactName}" not found. Available contacts: ${contacts.map(c => c.name).join(', ')}`;
      }
    }
  });

  const handleSendEmail = async (emailData: { to: string; subject: string; body: string }) => {
    try {
      const response = await fetch('/api/email/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(emailData)
      });

      if (!response.ok) {
        throw new Error('Failed to send email');
      }

      const result = await response.json();
      setEmailStatus({ 
        message: `✅ Email sent successfully to ${emailData.to}`, 
        type: 'success' 
      });
      
      // Clear status after 5 seconds
      setTimeout(() => setEmailStatus({ message: '', type: '' }), 5000);

    } catch (error) {
      setEmailStatus({ 
        message: `❌ Failed to send email: ${error instanceof Error ? error.message : 'Unknown error'}`, 
        type: 'error' 
      });
      
      setTimeout(() => setEmailStatus({ message: '', type: '' }), 5000);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-yellow-400"></div>
      </div>
    );
  }

  return (
    <div className="flex gap-6">
      {/* Main Content */}
      <div className="flex-1 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2 page-title">Contacts & POIs</h1>
            <p className="text-fm-light-grey">Manage relationships and track engagement</p>
          </div>
          <Button className="bg-yellow-500 text-black hover:bg-yellow-400">
            <Users className="w-4 h-4 mr-2" />
            Add Contact
          </Button>
        </div>

        {/* Email Status Message */}
        {emailStatus.message && (
          <div className={`p-4 rounded-lg border ${
            emailStatus.type === 'success' 
              ? 'bg-green-50 border-green-200 text-green-800' 
              : 'bg-red-50 border-red-200 text-red-800'
          }`}>
            {emailStatus.message}
          </div>
        )}

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
                <Button 
                  size="sm" 
                  variant="outline" 
                  className="flex-1"
                  onClick={() => {
                    setSelectedContact(contact);
                    setShowEmailAssistant(true);
                  }}
                >
                  <Mail className="w-3 h-3 mr-1" />
                  Email
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

      {/* Email Assistant Sidebar */}
      {showEmailAssistant && selectedContact && (
        <div className="w-96 bg-custom-box border border-custom-border rounded-lg p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-white flex items-center gap-2">
              <MessageCircle className="w-5 h-5" />
              Email Assistant
            </h3>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setShowEmailAssistant(false)}
              className="text-gray-400 hover:text-white"
            >
              ×
            </Button>
          </div>
          
          <EmailAssistant
            contact={selectedContact}
            onSendEmail={handleSendEmail}
          />
        </div>
      )}
    </div>
  );
}
