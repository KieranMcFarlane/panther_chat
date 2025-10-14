'use client';

import { SidebarLayout } from '@/components/layout/EnhancedSidebar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Smartphone, Tablet, Monitor, Menu, X } from 'lucide-react';

export default function MobileTestPage() {
  return (
    <SidebarLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">Mobile Sidebar Test</h1>
            <p className="text-fm-light-grey">Test the mobile-responsive sidebar functionality</p>
          </div>
        </div>

        {/* Device Test Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="bg-custom-box border-custom-border">
            <CardHeader className="flex flex-row items-center gap-3">
              <Smartphone className="w-8 h-8 text-green-400" />
              <div>
                <CardTitle className="text-lg text-white">Mobile Test</CardTitle>
                <p className="text-sm text-fm-light-grey">Width &lt; 768px</p>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-green-400 border-green-400">
                  Hamburger Menu
                </Badge>
                <Badge variant="outline" className="text-blue-400 border-blue-400">
                  Floating Sidebar
                </Badge>
              </div>
              <ul className="text-sm text-fm-light-grey space-y-1">
                <li>• Fixed hamburger button in top-left</li>
                <li>• Smooth hamburger → X animation</li>
                <li>• Overlay when sidebar opens</li>
                <li>• Click outside to close</li>
                <li>• Custom mobile header with logo</li>
              </ul>
              <Button 
                variant="outline" 
                size="sm"
                className="w-full border-custom-border text-fm-light-grey hover:bg-custom-bg"
                onClick={() => {
                  // Simulate mobile viewport
                  const sidebar = document.querySelector('[data-sidebar]');
                  if (sidebar) {
                    sidebar.classList.add('translate-x-[-100%]');
                  }
                }}
              >
                Test Mobile View
              </Button>
            </CardContent>
          </Card>

          <Card className="bg-custom-box border-custom-border">
            <CardHeader className="flex flex-row items-center gap-3">
              <Tablet className="w-8 h-8 text-yellow-400" />
              <div>
                <CardTitle className="text-lg text-white">Tablet Test</CardTitle>
                <p className="text-sm text-fm-light-grey">Width 768px - 1024px</p>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-yellow-400 border-yellow-400">
                  Collapsible Sidebar
                </Badge>
                <Badge variant="outline" className="text-blue-400 border-blue-400">
                  Desktop Mode
                </Badge>
              </div>
              <ul className="text-sm text-fm-light-grey space-y-1">
                <li>• Standard sidebar behavior</li>
                <li>• Collapsible to icons</li>
                <li>• No hamburger menu</li>
                <li>• Full navigation access</li>
                <li>• Standard desktop header</li>
              </ul>
              <Button 
                variant="outline" 
                size="sm"
                className="w-full border-custom-border text-fm-light-grey hover:bg-custom-bg"
              >
                Test Tablet View
              </Button>
            </CardContent>
          </Card>

          <Card className="bg-custom-box border-custom-border">
            <CardHeader className="flex flex-row items-center gap-3">
              <Monitor className="w-8 h-8 text-blue-400" />
              <div>
                <CardTitle className="text-lg text-white">Desktop Test</CardTitle>
                <p className="text-sm text-fm-light-grey">Width &gt; 1024px</p>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-blue-400 border-blue-400">
                  Full Sidebar
                </Badge>
                <Badge variant="outline" className="text-green-400 border-green-400">
                  All Features
                </Badge>
              </div>
              <ul className="text-sm text-fm-light-grey space-y-1">
                <li>• Full sidebar navigation</li>
                <li>• Collapsible to icons</li>
                <li>• Hover tooltips</li>
                <li>• No mobile restrictions</li>
                <li>• Complete feature set</li>
              </ul>
              <Button 
                variant="outline" 
                size="sm"
                className="w-full border-custom-border text-fm-light-grey hover:bg-custom-bg"
              >
                Test Desktop View
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Animation Demo */}
        <Card className="bg-custom-box border-custom-border">
          <CardHeader>
            <CardTitle className="text-xl text-white">Hamburger Animation Demo</CardTitle>
            <p className="text-fm-light-grey">Smooth transition from hamburger menu to X close button</p>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-center py-8">
              <div className="relative">
                {/* Demo animation button */}
                <div className="relative w-12 h-12 bg-custom-box border-custom-border rounded-lg flex items-center justify-center">
                  <div className="relative w-6 h-6">
                    <span className="absolute inset-0 flex items-center justify-center transition-all duration-300">
                      <Menu className="w-6 h-6 text-white" />
                    </span>
                  </div>
                </div>
                <p className="text-center mt-4 text-sm text-fm-light-grey">
                  Hover over the button to see the transition
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Feature List */}
        <Card className="bg-custom-box border-custom-border">
          <CardHeader>
            <CardTitle className="text-xl text-white">Mobile Features Implemented</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <div className="w-2 h-2 bg-green-400 rounded-full mt-2"></div>
                  <div>
                    <h4 className="text-white font-medium">Responsive Detection</h4>
                    <p className="text-sm text-fm-light-grey">Automatic mobile/tablet/desktop detection</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-2 h-2 bg-green-400 rounded-full mt-2"></div>
                  <div>
                    <h4 className="text-white font-medium">Smooth Animations</h4>
                    <p className="text-sm text-fm-light-grey">300ms hamburger to X transition</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-2 h-2 bg-green-400 rounded-full mt-2"></div>
                  <div>
                    <h4 className="text-white font-medium">Overlay Background</h4>
                    <p className="text-sm text-fm-light-grey">Click outside to close sidebar</p>
                  </div>
                </div>
              </div>
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <div className="w-2 h-2 bg-green-400 rounded-full mt-2"></div>
                  <div>
                    <h4 className="text-white font-medium">Mobile Header</h4>
                    <p className="text-sm text-fm-light-grey">Compact header with logo on mobile</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-2 h-2 bg-green-400 rounded-full mt-2"></div>
                  <div>
                    <h4 className="text-white font-medium">Auto Close</h4>
                    <p className="text-sm text-fm-light-grey">Sidebar closes on desktop resize</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-2 h-2 bg-green-400 rounded-full mt-2"></div>
                  <div>
                    <h4 className="text-white font-medium">Accessibility</h4>
                    <p className="text-sm text-fm-light-grey">ARIA labels and keyboard support</p>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Test Instructions */}
        <Card className="bg-custom-box border-custom-border">
          <CardHeader>
            <CardTitle className="text-xl text-white">How to Test</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <h4 className="text-white font-medium mb-2">1. Browser DevTools</h4>
                <p className="text-sm text-fm-light-grey">
                  Open browser devTools (F12), toggle device view, and test different screen sizes
                </p>
              </div>
              <div>
                <h4 className="text-white font-medium mb-2">2. Mobile Device</h4>
                <p className="text-sm text-fm-light-grey">
                  Visit this page on an actual mobile device to test touch interactions
                </p>
              </div>
              <div>
                <h4 className="text-white font-medium mb-2">3. Resize Window</h4>
                <p className="text-sm text-fm-light-grey">
                  Manually resize the browser window to see the responsive behavior
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </SidebarLayout>
  );
}