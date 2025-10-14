import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Calendar, Clock, User, Mail, Phone, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface AppointmentType {
  id: number;
  name: string;
  appointment_duration: number;
  is_published: boolean;
  category: string;
}

interface BookAppointmentDialogProps {
  open: boolean;
  onClose: () => void;
  selectedDate?: Date;
  selectedTime?: string;
  selectedStaffId?: string;
  selectedStaffName?: string;
}

export function BookAppointmentDialog({
  open,
  onClose,
  selectedDate,
  selectedTime,
  selectedStaffId,
  selectedStaffName
}: BookAppointmentDialogProps) {
  const { toast } = useToast();
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [selectedTypes, setSelectedTypes] = useState<number[]>([]);

  const { data: appointmentTypes = [], isLoading } = useQuery<AppointmentType[]>({
    queryKey: ["/api/appointment-types"],
    enabled: open,
  });

  const createAppointmentMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest("POST", "/api/appointments/book", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/appointments"], exact: false });
      toast({
        title: "Success",
        description: "Appointment(s) booked successfully!",
      });
      handleClose();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to book appointment",
        variant: "destructive",
      });
    },
  });

  useEffect(() => {
    if (!open) {
      setCustomerName("");
      setCustomerEmail("");
      setCustomerPhone("");
      setSelectedTypes([]);
    }
  }, [open]);

  const handleClose = () => {
    onClose();
  };

  const handleTypeToggle = (typeId: number) => {
    setSelectedTypes(prev =>
      prev.includes(typeId)
        ? prev.filter(id => id !== typeId)
        : [...prev, typeId]
    );
  };

  const calculateTotalDuration = () => {
    return selectedTypes.reduce((total, typeId) => {
      const type = appointmentTypes.find(t => t.id === typeId);
      return total + (type?.appointment_duration || 0);
    }, 0);
  };

  const handleSubmit = () => {
    if (!customerName.trim()) {
      toast({
        title: "Validation Error",
        description: "Customer name is required",
        variant: "destructive",
      });
      return;
    }

    if (selectedTypes.length === 0) {
      toast({
        title: "Validation Error",
        description: "Please select at least one appointment type",
        variant: "destructive",
      });
      return;
    }

    if (!selectedDate || !selectedTime || !selectedStaffId) {
      toast({
        title: "Error",
        description: "Please select a time slot on the calendar",
        variant: "destructive",
      });
      return;
    }

    const totalDuration = calculateTotalDuration();
    const [hours, minutes] = selectedTime.split(':').map(Number);
    const startTime = new Date(selectedDate);
    startTime.setHours(hours, minutes, 0, 0);
    
    const endTime = new Date(startTime);
    endTime.setMinutes(endTime.getMinutes() + totalDuration * 60);

    createAppointmentMutation.mutate({
      customerName,
      customerEmail,
      customerPhone,
      appointmentTypeIds: selectedTypes,
      startTime: startTime.toISOString(),
      endTime: endTime.toISOString(),
      staffId: selectedStaffId,
    });
  };

  const totalDuration = calculateTotalDuration();
  const totalHours = Math.floor(totalDuration);
  const totalMinutes = Math.round((totalDuration - totalHours) * 60);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>Book New Appointment</DialogTitle>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh] pr-4">
          <div className="space-y-6">
            {/* Selected Time Info */}
            {selectedDate && selectedTime && (
              <div className="bg-muted p-4 rounded-lg space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <Calendar className="h-4 w-4" />
                  <span>{format(selectedDate, 'EEEE, MMMM d, yyyy')}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Clock className="h-4 w-4" />
                  <span>{selectedTime}</span>
                </div>
                {selectedStaffName && (
                  <div className="flex items-center gap-2 text-sm">
                    <User className="h-4 w-4" />
                    <span>{selectedStaffName}</span>
                  </div>
                )}
              </div>
            )}

            {/* Customer Information */}
            <div className="space-y-4">
              <h3 className="font-semibold">Customer Information</h3>
              
              <div className="space-y-2">
                <Label htmlFor="customerName">Name *</Label>
                <Input
                  id="customerName"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Enter customer name"
                  data-testid="input-customer-name"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="customerEmail">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="customerEmail"
                    type="email"
                    value={customerEmail}
                    onChange={(e) => setCustomerEmail(e.target.value)}
                    placeholder="customer@example.com"
                    className="pl-10"
                    data-testid="input-customer-email"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="customerPhone">Phone</Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="customerPhone"
                    type="tel"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    placeholder="+1 234 567 8900"
                    className="pl-10"
                    data-testid="input-customer-phone"
                  />
                </div>
              </div>
            </div>

            {/* Appointment Types Selection */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">Select Services</h3>
                {totalDuration > 0 && (
                  <span className="text-sm text-muted-foreground">
                    Total: {totalHours > 0 && `${totalHours}h `}{totalMinutes > 0 && `${totalMinutes}min`}
                  </span>
                )}
              </div>

              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <div className="space-y-2">
                  {appointmentTypes.map((type) => (
                    <div
                      key={type.id}
                      className="flex items-center space-x-3 p-3 rounded-lg border hover:bg-accent/50 transition-colors"
                      data-testid={`appointment-type-${type.id}`}
                    >
                      <Checkbox
                        id={`type-${type.id}`}
                        checked={selectedTypes.includes(type.id)}
                        onCheckedChange={() => handleTypeToggle(type.id)}
                        data-testid={`checkbox-type-${type.id}`}
                      />
                      <label
                        htmlFor={`type-${type.id}`}
                        className="flex-1 cursor-pointer"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-medium">{type.name}</span>
                          <span className="text-sm text-muted-foreground">
                            {type.appointment_duration >= 1 
                              ? `${Math.floor(type.appointment_duration)}h ${Math.round((type.appointment_duration % 1) * 60)}min`
                              : `${Math.round(type.appointment_duration * 60)}min`}
                          </span>
                        </div>
                      </label>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </ScrollArea>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} data-testid="button-cancel-booking">
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={createAppointmentMutation.isPending}
            data-testid="button-confirm-booking"
          >
            {createAppointmentMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Booking...
              </>
            ) : (
              `Book ${selectedTypes.length > 0 ? `${selectedTypes.length} Service${selectedTypes.length > 1 ? 's' : ''}` : 'Appointment'}`
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
