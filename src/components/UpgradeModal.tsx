import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";
import { useServerFn } from "@tanstack/react-start";
import { upgradeToPro } from "@/lib/video.functions";
import { getEnabledPaymentProviders } from "@/lib/admin.functions";
import { toast } from "sonner";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { Sparkles, CreditCard, Wallet, Smartphone, Zap } from "lucide-react";

const PROVIDER_ICON: Record<string, React.ReactNode> = {
  stripe: <CreditCard className="h-4 w-4" />,
  paypal: <Wallet className="h-4 w-4" />,
  fawry: <Zap className="h-4 w-4" />,
  vodafone_cash: <Smartphone className="h-4 w-4" />,
  instapay: <Zap className="h-4 w-4" />,
};

export function UpgradeModal({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { t } = useI18n();
  const upgrade = useServerFn(upgradeToPro);
  const getProviders = useServerFn(getEnabledPaymentProviders);
  const qc = useQueryClient();
  const { data: payment } = useQuery({
    queryKey: ["public-payments"],
    queryFn: () => getProviders(),
    enabled: open,
  });
  const providers = payment?.providers ?? [];
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
        {providers.length > 0 ? (
          <div className="pt-2 border-t border-white/10">
            <div className="text-xs text-slate-400 mb-2 text-center">Pay with</div>
            <div className="grid grid-cols-2 gap-2">
              {providers.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() =>
                    p.connected
                      ? toast(`Redirecting to ${p.label}…`)
                      : toast(`${p.label} not connected yet`, {
                          description: "Admin will finish wiring this method up shortly.",
                        })
                  }
                  className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 px-3 py-2 text-sm"
                >
                  {PROVIDER_ICON[p.id] ?? <CreditCard className="h-4 w-4" />}
                  <span>{p.label}</span>
                  {!p.connected ? <span className="ml-auto text-[9px] text-amber-300 font-semibold">SOON</span> : null}
                </button>
              ))}
            </div>
          </div>
        ) : null}
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
