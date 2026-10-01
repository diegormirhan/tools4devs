import { useT } from "../i18n/language";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

/** Clearing the history cannot be undone, so it is asked first wherever it is offered (UC-07). */
export function ClearHistoryDialog({
  open,
  onOpenChange,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}) {
  const t = useT();
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="font-heading">{t("Clear the history?")}</AlertDialogTitle>
          <AlertDialogDescription>
            {t("Every finished operation leaves this list. The files they wrote stay where they are.")}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t("Keep it")}</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>{t("Clear")}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
