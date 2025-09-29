"use client";

import { useEffect } from "react";
import { authClient } from "@/lib/auth-client";

export default function DashboardPage() {
  useEffect(() => {
    // Check if user is authenticated
    const checkAuth = async () => {
      const { data } = await authClient.getSession();
      if (!data) {
        window.location.href = "/login";
      }
    };
    
    checkAuth();
  }, []);

  return (
    <div className="min-h-screen bg-custom-bg p-6">
      <div className="max-w-7xl mx-auto">
        <div className="bg-custom-box border border-custom-border rounded-lg p-8">
          <h1 className="font-header-large text-fm-white mb-6">
            Welcome to Your Dashboard
          </h1>
          <p className="font-body-primary text-fm-light-grey mb-8">
            You have successfully logged into the ClaudeBox Multi-Slot System. 
            Use the navigation sidebar to explore all available features.
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="bg-custom-bg border border-custom-border rounded-lg p-6">
              <h3 className="font-subheader text-fm-white mb-3">🏆 ClaudeBox Features</h3>
              <ul className="font-body-secondary text-fm-light-grey space-y-2">
                <li>• Multi-Slot Processing</li>
                <li>• Advanced AI Integration</li>
                <li>• Knowledge Graph Chat</li>
                <li>• Real-time Data Analysis</li>
              </ul>
            </div>
            
            <div className="bg-custom-bg border border-custom-border rounded-lg p-6">
              <h3 className="font-subheader text-fm-white mb-3">📊 System Status</h3>
              <ul className="font-body-secondary text-fm-light-grey space-y-2">
                <li>• Backend API: Running</li>
                <li>• Authentication: Active</li>
                <li>• Database: Connected</li>
                <li>• MCP Services: Online</li>
              </ul>
            </div>
            
            <div className="bg-custom-bg border border-custom-border rounded-lg p-6">
              <h3 className="font-subheader text-fm-white mb-3">🔧 Quick Actions</h3>
              <ul className="font-body-secondary text-fm-light-grey space-y-2">
                <li>• View Sports Entities</li>
                <li>• Browse Tenders</li>
                <li>• Knowledge Graph Chat</li>
                <li>• Terminal Access</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}