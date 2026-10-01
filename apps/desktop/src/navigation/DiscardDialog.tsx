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
import { useNavigation } from "./navigation";

/**
 * Asked when a move would throw away a chosen file or changed settings. Focus
 * starts on the safe answer, and Esc gives the same one.
 */
export function DiscardDialog() {
  const t = useT();
  const { pending, confirmPending, cancelPending } = useNavigation();

  return (
    <AlertDialog open={pending !== null} onOpenChange={(open) => !open && cancelPending()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="font-heading">{t("Discard this work?")}</AlertDialogTitle>
          <AlertDialogDescription>
            {t("The file you chose and the settings you changed will be cleared. Nothing on disk is touched either way.")}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t("Keep editing")}</AlertDialogCancel>
          <AlertDialogAction onClick={confirmPending}>{t("Discard")}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
