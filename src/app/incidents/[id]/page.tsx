import { IncidentDetailClient } from "@/components/incidents/incident-detail-client";

export default async function IncidentDetailPage(props: PageProps<"/incidents/[id]">) {
  const { id } = await props.params;
  return <IncidentDetailClient incidentId={id} />;
}
