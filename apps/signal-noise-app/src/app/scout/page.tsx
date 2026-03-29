import ScoutLanePanel from '@/components/discovery/ScoutLanePanel';

export const metadata = {
  title: 'Scout Lane | Signal Noise App',
  description: 'Manus-driven discovery lane for broad sports opportunity scouting.',
};

export default function ScoutPage() {
  return (
    <div className="p-6">
      <ScoutLanePanel />
    </div>
  );
}
