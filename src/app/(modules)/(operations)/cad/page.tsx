import { redirect } from 'next/navigation';

export default function CADDashboardPage() {
  // CAD role and prototype stage have been removed from the system
  redirect('/operations');
}
