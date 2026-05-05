import {
  getApplications,
  getApplicationSources,
  getApplicationStatusCounts,
} from "@/lib/data/applications";
import type { ApplicationFilters } from "@/lib/data/applications";
import { DashboardClient } from "./_components/DashboardClient";
import type { DashboardFilters } from "@/components/dashboard/DashboardFilterBar";
import { auth } from "@/auth";
import { redirect } from "next/navigation";

// Force dynamic so router.refresh() always gets fresh data from Prisma
export const dynamic = "force-dynamic";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const userId = session.user.id;
  const sp = await searchParams;
  const nonStatusFilters: Omit<ApplicationFilters, "status"> = {
    source: sp.source,
    position: sp.position,
    hasSalary: sp.hasSalary === "true",
  };
  const [applications, sources, statusCounts] = await Promise.all([
    getApplications(userId, { status: sp.status, ...nonStatusFilters }),
    getApplicationSources(userId),
    getApplicationStatusCounts(userId, nonStatusFilters),
  ]);
  const currentFilters: DashboardFilters = {
    status: sp.status ?? "ALL",
    source: sp.source ?? "ALL",
    position: sp.position ?? "",
    hasSalary: sp.hasSalary === "true",
  };
  return (
    <DashboardClient
      applications={applications}
      filters={currentFilters}
      sources={sources}
      statusCounts={statusCounts}
    />
  );
}
