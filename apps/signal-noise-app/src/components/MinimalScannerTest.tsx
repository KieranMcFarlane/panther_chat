'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';

export default function MinimalScannerTest() {
  const [status, setStatus] = useState('idle');
  
  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <h1 className="text-3xl font-bold">🎯 Minimal Scanner Test</h1>
        
        <div className="bg-gray-800 border-gray-700 rounded-lg p-6">
          <div className="text-center space-y-4">
            <div className="text-green-400">
              Status: <strong>{status}</strong>
            </div>
            <Button 
              onClick={() => setStatus('testing')}
              className="bg-green-600 hover:bg-green-700"
            >
              Test Button
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}