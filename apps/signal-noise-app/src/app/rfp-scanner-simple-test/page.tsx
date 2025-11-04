import ProgressTest from '@/components/ProgressTest';

export default function TestPage() {
  return (
    <div className="min-h-screen bg-gray-900">
      <div className="container mx-auto py-8">
        <h1 className="text-3xl font-bold text-white mb-8">Test Progress Component Dependencies</h1>
        <div className="bg-gray-800 border-gray-700 rounded-lg p-6">
          <p className="text-gray-300 mb-4">Testing Progress component imports...</p>
          <div className="text-green-400">
            Component Status: <strong>Testing Progress Import</strong>
          </div>
        </div>
        <div className="mt-8">
          <ProgressTest />
        </div>
      </div>
    </div>
  );
}