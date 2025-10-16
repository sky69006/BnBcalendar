import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Appointment, Staff } from "@shared/schema";

interface RescheduleDialogProps {
  appointment: Appointment | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function RescheduleDialog({
  appointment,
  open,
  onOpenChange,
}: RescheduleDialogProps) {
  const { toast } = useToast();
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(
    appointment?.startTime ? new Date(appointment.startTime) : undefined
  );
  const [selectedTime, setSelectedTime] = useState<string>(
    appointment?.startTime
      ? new Date(appointment.startTime).toTimeString().slice(0, 5)
      : "09:00"
  );
  const [selectedStaffId, setSelectedStaffId] = useState<string>(
    appointment?.staffId || ""
  );

  const { data: staff = [] } = useQuery<Staff[]>({
    queryKey: ["/api/staff"],
  });

  const rescheduleMutation = useMutation({
    mutationFn: async () => {
      if (!appointment || !selectedDate || !selectedTime || !selectedStaffId) {
        throw new Error("Missing required fields");
      }

      const [hours, minutes] = selectedTime.split(':').map(Number);
      const newStartTime = new Date(selectedDate);
      newStartTime.setHours(hours, minutes, 0, 0);

      const newEndTime = new Date(newStartTime);
      newEndTime.setMinutes(newEndTime.getMinutes() + appointment.duration);

      return apiRequest("PUT", `/api/appointments/${appointment.id}/reschedule`, {
        startTime: newStartTime.toISOString(),
        endTime: newEndTime.toISOString(),
        staffId: selectedStaffId,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/appointments"] });
      toast({
        title: "Appointment rescheduled",
        description: "The appointment has been successfully rescheduled.",
      });
      onOpenChange(false);
    },
    onError: (error) => {
      toast({
        title: "Failed to reschedule",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    },
  });

  // Update state when appointment changes
  useEffect(() => {
    if (appointment && open) {
      setSelectedDate(new Date(appointment.startTime));
      setSelectedTime(new Date(appointment.startTime).toTimeString().slice(0, 5));
      setSelectedStaffId(appointment.staffId || "");
    }
  }, [appointment, open]);

  const handleReschedule = () => {
    rescheduleMutation.mutate();
  };

  // Generate time options (every 15 minutes)
  const timeOptions = [];
  for (let hour = 7; hour < 20; hour++) {
    for (let minute = 0; minute < 60; minute += 15) {
      const timeStr = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
      timeOptions.push(timeStr);
    }
  }

  if (!appointment) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]" data-testid="dialog-reschedule">
        <DialogHeader>
          <DialogTitle>Reschedule Appointment</DialogTitle>
          <DialogDescription>
            Change the date, time, or staff member for this appointment.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Appointment</Label>
            <p className="text-sm text-muted-foreground">
              {appointment.customerName} - {appointment.service}
            </p>
          </div>

          <div className="space-y-2">
            <Label>Select New Date</Label>
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={setSelectedDate}
              className="rounded-md border"
              data-testid="calendar-date-picker"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="time">Select Time</Label>
            <Select value={selectedTime} onValueChange={setSelectedTime}>
              <SelectTrigger id="time" data-testid="select-time">
                <SelectValue placeholder="Select time" />
              </SelectTrigger>
              <SelectContent>
                {timeOptions.map((time) => (
                  <SelectItem key={time} value={time}>
                    {time}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="staff">Staff Member</Label>
            <Select value={selectedStaffId} onValueChange={setSelectedStaffId}>
              <SelectTrigger id="staff" data-testid="select-staff">
                <SelectValue placeholder="Select staff member" />
              </SelectTrigger>
              <SelectContent>
                {staff.map((member) => (
                  <SelectItem key={member.id} value={member.id}>
                    {member.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            data-testid="button-cancel-reschedule"
          >
            Cancel
          </Button>
          <Button
            onClick={handleReschedule}
            disabled={!selectedDate || !selectedTime || !selectedStaffId || rescheduleMutation.isPending}
            data-testid="button-confirm-reschedule"
          >
            {rescheduleMutation.isPending ? "Rescheduling..." : "Reschedule"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
