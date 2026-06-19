import EditorClient from './EditorClient';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ProjectEditPage({ params }: PageProps) {
  const { id } = await params;
  return <EditorClient id={id} />;
}
