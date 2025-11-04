'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function CardTest() {
  const [status, setStatus] = useState('idle');
  
  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <h1 className="text-3xl font-bold">🎯 Card Component Test</h1>
        
        <Card className="bg-gray-800 border-gray-700">
          <CardHeader>
            <CardTitle className="text-white">Test Card Title</CardTitle>
            <CardDescription className="text-gray-300">Test Card Description</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-center space-y-4">
              <div className="text-green-400">
                Status: <strong>{status}</strong>
              </div>
              <Button 
                onClick={() => setStatus('testing')}
                className="bg-green-600 hover:bg-green-700"
              >
                Test Button in Card
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}