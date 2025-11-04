/**
 * Arsenal Dossier Demo Page
 * Showcases the enhanced accordion-style interface with detailed intelligence
 */

import React from 'react';
import EnhancedArsenalDossier from '@/components/entity-dossier/EnhancedArsenalDossier';

export default function ArsenalDossierPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Enhanced Entity Dossier</h1>
              <p className="text-sm text-gray-600 mt-1">
                Arsenal FC - Advanced Intelligence Analysis with Accordion Interface
              </p>
            </div>
            <div className="flex items-center space-x-2">
              <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-medium">
                Live Demo
              </span>
              <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium">
                Enhanced UI
              </span>
            </div>
          </div>
        </div>
      </div>

      <EnhancedArsenalDossier />
    </div>
  );
}