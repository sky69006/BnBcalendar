import { useMutation } from "@tanstack/react-query";
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
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Appointment } from "@shared/schema";

interface CancelAppointmentDialogProps {
  appointment: Appointment | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CancelAppointmentDialog({
  appointment,
  open,
  onOpenChange,
}: CancelAppointmentDialogProps) {
  const { toast } = useToast();

  const cancelMutation = useMutation({
    mutationFn: async () => {
      if (!appointment) {
        throw new Error("No appointment to cancel");
      }

      return apiRequest("DELETE", `/api/appointments/${appointment.id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/appointments"] });
      toast({
        title: "Afspraak geannuleerd",
        description: "De afspraak is succesvol geannuleerd en verwijderd uit Odoo.",
      });
      onOpenChange(false);
    },
    onError: (error) => {
      toast({
        title: "Annuleren mislukt",
        description: error instanceof Error ? error.message : "Onbekende fout",
        variant: "destructive",
      });
    },
  });

  const handleCancel = () => {
    cancelMutation.mutate();
  };

  if (!appointment) return null;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent data-testid="dialog-cancel-appointment">
        <AlertDialogHeader>
          <AlertDialogTitle>Afspraak Annuleren?</AlertDialogTitle>
          <AlertDialogDescription>
            Weet u zeker dat u deze afspraak wilt annuleren? Dit zal de afspraak permanent verwijderen
            uit zowel de kalender als Odoo.
          </AlertDialogDescription>
        </AlertDialogHeader>
        
        <div className="py-4 space-y-2">
          <p className="text-sm">
            <span className="font-semibold">Klant:</span> {appointment.customerName}
          </p>
          <p className="text-sm">
            <span className="font-semibold">Service:</span> {appointment.service}
          </p>
          <p className="text-sm">
            <span className="font-semibold">Datum & Tijd:</span>{" "}
            {new Date(appointment.startTime).toLocaleString('nl-NL', {
              weekday: 'short',
              year: 'numeric',
              month: 'short',
              day: 'numeric',
              hour: 'numeric',
              minute: '2-digit',
              hour12: false
            })}
          </p>
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel data-testid="button-cancel-no">
            Nee, Behoud Afspraak
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleCancel}
            disabled={cancelMutation.isPending}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            data-testid="button-cancel-yes"
          >
            {cancelMutation.isPending ? "Annuleren..." : "Ja, Annuleer Afspraak"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
