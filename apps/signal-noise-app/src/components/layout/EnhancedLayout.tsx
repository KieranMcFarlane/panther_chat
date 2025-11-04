'use client';

import { ReactNode } from 'react';
import { SidebarLayout } from '@/components/layout/EnhancedSidebar';

interface EnhancedLayoutProps {
  children: ReactNode;
}

export default function EnhancedLayout({ children }: EnhancedLayoutProps) {
  return (
    <SidebarLayout>
      {children}
    </SidebarLayout>
  );
}