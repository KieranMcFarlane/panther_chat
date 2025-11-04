import { Metadata } from 'next';
import PersonProfileClient from './client-page';

interface PersonProfilePageProps {
  params: {
    personId: string;
  };
}

export async function generateMetadata(
  { params }: PersonProfilePageProps
): Promise<Metadata> {
  return {
    title: `Person Profile | Yellow Panther Sports Intelligence`,
    description: 'Advanced person profile with AI-powered email agents and conversation analytics.',
  };
}

export default function PersonProfilePage({ params }: PersonProfilePageProps) {
  return (
    <div className="min-h-screen bg-background">
      <PersonProfileClient entityId={params.personId} />
    </div>
  );
}