"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Box, Typography, Alert } from "@mui/material";
import { DashboardFilterBar, type DashboardFilters } from "@/components/dashboard/DashboardFilterBar";
import { CoverLetterDialog } from "@/components/dialogs/CoverLetterDialog";
import { StreamingCoverLetterDialog } from "@/components/dialogs/StreamingCoverLetterDialog";
import { StatusChangeDialog } from "@/components/dialogs/StatusChangeDialog";
import { updateApplicationStatus } from "@/lib/actions/applicationActions";
import { ApplicationList } from "./ApplicationList";
import type { Application, AppStatus } from "@/types";

interface Props {
  applications: Application[];
  filters: DashboardFilters;
  sources: string[];
  statusCounts: Record<string, number>;
}

export function DashboardClient({ applications, filters, sources, statusCounts }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [clDialog, setClDialog] = useState<{ open: boolean; content: string; coverId: string | null }>({
    open: false,
    content: "",
    coverId: null,
  });
  const [streamDlg, setStreamDlg] = useState<{ open: boolean; jobId: string | null; jobTitle: string; completed: boolean }>({
    open: false,
    jobId: null,
    jobTitle: "",
    completed: false,
  });
  const [statusDialog, setStatusDialog] = useState<{
    open: boolean;
    id: string;
    status: AppStatus;
  } | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleFilterChange = (newFilters: DashboardFilters) => {
    const params = new URLSearchParams();
    if (newFilters.status !== "ALL") params.set("status", newFilters.status);
    if (newFilters.source !== "ALL") params.set("source", newFilters.source);
    if (newFilters.position) params.set("position", newFilters.position);
    if (newFilters.hasSalary) params.set("hasSalary", "true");
    router.replace(`/dashboard${params.size > 0 ? `?${params.toString()}` : ""}`);
  };

  const handleStatusChange = (id: string, status: AppStatus) => {
    startTransition(async () => {
      try {
        await updateApplicationStatus(id, status);
        router.refresh();
        setStatusDialog(null);
      } catch (err) {
        setErrorMsg(`Failed to update status: ${String(err)}`);
      }
    });
  };

  return (
    <Box>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" sx={{ mb: 0.5 }}>
          Applications
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Track and manage all your job applications in one place.
        </Typography>
      </Box>

      {errorMsg && (
        <Alert severity="error" onClose={() => setErrorMsg(null)} sx={{ mb: 2 }}>
          {errorMsg}
        </Alert>
      )}

      <DashboardFilterBar
        sources={sources}
        statusCounts={statusCounts}
        filters={filters}
        onChange={handleFilterChange}
      />

      <ApplicationList
        applications={applications}
        isPending={isPending}
        onStatusClick={(id, status) => setStatusDialog({ open: true, id, status })}
        onViewCoverLetter={(content, coverId) => setClDialog({ open: true, content, coverId })}
        onGenerateCoverLetter={(jobId, jobTitle) => setStreamDlg({ open: true, jobId, jobTitle, completed: false })}
      />

      <CoverLetterDialog
        open={clDialog.open}
        content={clDialog.content}
        onClose={() => setClDialog({ open: false, content: "", coverId: null })}
        onDelete={clDialog.coverId ? async () => {
          await fetch("/api/graphql", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              query: `mutation Del($id: ID!) { deleteCoverLetter(id: $id) }`,
              variables: { id: clDialog.coverId },
            }),
          });
          setClDialog({ open: false, content: "", coverId: null });
          router.refresh();
        } : undefined}
      />

      <StreamingCoverLetterDialog
        open={streamDlg.open}
        jobId={streamDlg.jobId}
        jobTitle={streamDlg.jobTitle}
        onClose={() => {
          if (streamDlg.completed) router.refresh();
          setStreamDlg({ open: false, jobId: null, jobTitle: "", completed: false });
        }}
        onComplete={() => {
          setStreamDlg((prev) => ({ ...prev, completed: true }));
        }}
      />

      {statusDialog && (
        <StatusChangeDialog
          open={statusDialog.open}
          status={statusDialog.status}
          isSaving={isPending}
          onStatusChange={(status) =>
            setStatusDialog({ ...statusDialog, status })
          }
          onClose={() => setStatusDialog(null)}
          onSave={() =>
            handleStatusChange(statusDialog.id, statusDialog.status)
          }
        />
      )}
    </Box>
  );
}
