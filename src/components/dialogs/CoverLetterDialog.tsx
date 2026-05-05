"use client";

import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Alert,
} from "@mui/material";
import DownloadIcon from "@mui/icons-material/Download";
import { downloadAsDocx } from "@/lib/downloadDocx";

interface CoverLetterDialogProps {
  open: boolean;
  content: string;
  /** Filename stem without extension, e.g. "cover-letter-react-developer" */
  filenameStem?: string;
  /** If provided, shows a Delete button that calls this callback. */
  onDelete?: () => void;
  /** Error message to display if deletion failed. */
  onDeleteError?: string | null;
  onClose: () => void;
}

/** Dialog that displays a generated cover letter with a download option. */
export function CoverLetterDialog({
  open,
  content,
  filenameStem = "cover-letter",
  onDelete,
  onDeleteError,
  onClose,
}: CoverLetterDialogProps) {
  const handleDownload = () => downloadAsDocx(content, filenameStem);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>Cover Letter</DialogTitle>
      <DialogContent>
        {onDeleteError && (
          <Alert severity="error" sx={{ mb: 2 }}>
            Failed to delete: {onDeleteError}
          </Alert>
        )}
        <Typography variant="body2" sx={{ whiteSpace: "pre-wrap" }}>
          {content}
        </Typography>
      </DialogContent>
      <DialogActions>
        {onDelete && (
          <Button color="error" onClick={onDelete} sx={{ mr: "auto" }}>
            Delete
          </Button>
        )}
        <Button startIcon={<DownloadIcon />} onClick={handleDownload}>
          Download .docx
        </Button>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}
