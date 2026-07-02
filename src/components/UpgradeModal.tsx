import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";
import { useServerFn } from "@tanstack/react-start";
import { upgradeToPro } from "@/lib/video.functions";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { Sparkles } from "lucide-react";

export function UpgradeModal({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { t } = useI18n();
  const upgrade = useServerFn(upgradeToPro);
  const qc = useQueryClient();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <div className="mx-auto mb-2 h-12 w-12 rounded-full bg-gradient-to-br from-fuchsia-500 to-amber-400 flex items-center justify-center">
            <Sparkles className="h-6 w-6 text-white" />
          </div>
          <DialogTitle className="text-center text-2xl">{t("limit_reached")}</DialogTitle>
          <DialogDescription className="text-center">{t("limit_reached_desc")}</DialogDescription>
        </DialogHeader>
        <ul className="text-sm space-y-2 py-2">
          <li>\u2728 30 videos / month</li>
          <li>\ud83c\udfa8 All premium caption styles + auto emojis</li>
          <li>\ud83d\ude80 No watermark</li>
          <li>\ud83d\udcc8 AI Social Kit (titles, description, hashtags)</li>
        </ul>
        <DialogFooter className="sm:justify-center gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t("close")}</Button>
          <Button
            className="bg-gradient-to-r from-fuchsia-600 to-amber-500 hover:opacity-90"
            onClick={async () => {
              await upgrade();
              toast.success("You are now on Pro. Enjoy!");
              qc.invalidateQueries();
              onOpenChange(false);
            }}
          >
            {t("upgrade")} \u2014 $10{t("per_month")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
