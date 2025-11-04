'use client';

import React from 'react';

export default function MinimalTestPage() {
  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <h1 className="text-3xl font-bold mb-6">Minimal Test Page</h1>
      <div className="bg-gray-800 rounded-lg p-6">
        <p className="text-green-400">This page works correctly.</p>
        <p className="text-gray-300 mt-2">Testing basic rendering...</p>
      </div>
    </div>
  );
}