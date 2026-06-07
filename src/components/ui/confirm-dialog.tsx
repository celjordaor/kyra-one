import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { AlertTriangle } from "lucide-react";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: string | React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "default" | "destructive" | "warning";
  /** Se true, exibe apenas o botão de fechar (modo alerta) */
  alertOnly?: boolean;
  onConfirm?: () => void;
  onClose: () => void;
}

export function ConfirmDialog({
  open, title, description,
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
  variant = "destructive",
  alertOnly = false,
  onConfirm, onClose,
}: ConfirmDialogProps) {
  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent className="max-w-sm" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {variant === "warning" && (
              <AlertTriangle className="h-5 w-5 shrink-0 text-amber-500" />
            )}
            {title}
          </DialogTitle>
        </DialogHeader>
        <div className="text-sm text-muted-foreground leading-relaxed">{description}</div>
        <DialogFooter className="flex-row justify-end gap-2 pt-2">
          {!alertOnly && (
            <Button variant="outline" size="sm" onClick={onClose}>
              {cancelLabel}
            </Button>
          )}
          <Button
            size="sm"
            onClick={() => {
              if (!alertOnly && onConfirm) onConfirm();
              onClose();
            }}
            className={cn(
              variant === "destructive" && "bg-destructive text-destructive-foreground hover:bg-destructive/90",
              variant === "warning"     && "bg-amber-500 text-white hover:bg-amber-600",
            )}
          >
            {alertOnly ? "Entendi" : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
