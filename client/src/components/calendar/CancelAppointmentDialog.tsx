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
        title: "Appointment cancelled",
        description: "The appointment has been successfully cancelled and removed from Odoo.",
      });
      onOpenChange(false);
    },
    onError: (error) => {
      toast({
        title: "Failed to cancel",
        description: error instanceof Error ? error.message : "Unknown error",
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
          <AlertDialogTitle>Cancel Appointment?</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to cancel this appointment? This will permanently delete the appointment
            from both the calendar and Odoo.
          </AlertDialogDescription>
        </AlertDialogHeader>
        
        <div className="py-4 space-y-2">
          <p className="text-sm">
            <span className="font-semibold">Customer:</span> {appointment.customerName}
          </p>
          <p className="text-sm">
            <span className="font-semibold">Service:</span> {appointment.service}
          </p>
          <p className="text-sm">
            <span className="font-semibold">Date & Time:</span>{" "}
            {new Date(appointment.startTime).toLocaleString('en-US', {
              weekday: 'short',
              year: 'numeric',
              month: 'short',
              day: 'numeric',
              hour: 'numeric',
              minute: '2-digit',
              hour12: true
            })}
          </p>
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel data-testid="button-cancel-no">
            No, Keep Appointment
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleCancel}
            disabled={cancelMutation.isPending}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            data-testid="button-cancel-yes"
          >
            {cancelMutation.isPending ? "Cancelling..." : "Yes, Cancel Appointment"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
