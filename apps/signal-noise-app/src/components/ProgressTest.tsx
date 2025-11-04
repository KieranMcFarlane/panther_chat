'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';

export default function ProgressTest() {
  const [progress, setProgress] = useState(25);
  
  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <h1 className="text-3xl font-bold">🎯 Progress Component Test</h1>
        
        <Card className="bg-gray-800 border-gray-700">
          <CardHeader>
            <CardTitle className="text-white">Progress Test</CardTitle>
            <CardDescription className="text-gray-300">Testing Progress component</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm text-gray-300">
                <span>Progress</span>
                <span>{progress}%</span>
              </div>
              <Progress value={progress} className="h-3" />
            </div>
            <div className="flex gap-2">
              <Button 
                onClick={() => setProgress(0)}
                variant="outline"
                size="sm"
              >
                Reset
              </Button>
              <Button 
                onClick={() => setProgress(Math.min(100, progress + 25))}
                size="sm"
              >
                Increase
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}