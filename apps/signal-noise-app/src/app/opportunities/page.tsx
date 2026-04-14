import { Suspense } from 'react';

import OpportunitiesClientPage from './opportunities-client';
import { requirePageSession } from '@/lib/server-auth';

export const dynamic = 'force-dynamic';

export default async function OpportunitiesPage() {
  await requirePageSession('/opportunities');

  return (
    <Suspense fallback={<div className="flex h-64 items-center justify-center text-fm-light-grey">Loading opportunities...</div>}>
      <OpportunitiesClientPage />
    </Suspense>
  );
}
