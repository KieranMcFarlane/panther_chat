import A2ASystemDashboard from '@/components/A2ASystemDashboard';

export default function A2ASystemPage() {
  return (
    <div className="container mx-auto py-8">
      <A2ASystemDashboard />
    </div>
  );
}

export const metadata = {
  title: 'A2A RFP Intelligence System',
  description: 'Autonomous Agent-to-Agent RFP processing and opportunity discovery',
};