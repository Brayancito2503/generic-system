import { getSession } from '@/lib/session';
import { redirect } from '@/i18n/navigation';
import TenantsAdminView from '@/features/admin/components/tenants-admin-view';

export default async function AdminTenantsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const session = await getSession();
  if (!session) return redirect({ href: '/login', locale });
  if (session.role !== 'SUPER_ADMIN') {
    return redirect({ href: '/dashboard', locale });
  }

  return (
    <div className="flex h-full min-h-0 w-full bg-zinc-950 text-zinc-100">
      <TenantsAdminView />
    </div>
  );
}