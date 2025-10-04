import { useState, useMemo, useCallback, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AppointmentCard } from "./AppointmentCard";
import { cn } from "@/lib/utils";
import { apiRequest } from "@/lib/queryClient";
import { format, addMinutes, startOfDay, isSameDay } from "date-fns";
import type { Appointment, Staff, CalendarSettings } from "@shared/schema";

interface CalendarGridProps {
  currentDate: Date;
  onAppointmentSelect: (appointment: Appointment) => void;
  selectedAppointment?: Appointment | null;
}

export function CalendarGrid({ 
  currentDate, 
  onAppointmentSelect, 
  selectedAppointment 
}: CalendarGridProps) {
  const queryClient = useQueryClient();
  const [draggedAppointment, setDraggedAppointment] = useState<Appointment | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());

  // Update current time every minute
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  const { data: staff = [] } = useQuery<Staff[]>({
    queryKey: ["/api/staff"],
  });

  const { data: settings } = useQuery<CalendarSettings>({
    queryKey: ["/api/settings"],
  });

  const { data: appointments = [] } = useQuery<Appointment[]>({
    queryKey: ["/api/appointments", currentDate.toISOString()],
    queryFn: async () => {
      const startOfCurrentDay = startOfDay(currentDate);
      const endOfCurrentDay = new Date(startOfCurrentDay);
      endOfCurrentDay.setDate(endOfCurrentDay.getDate() + 1);
      
      const response = await fetch(
        `/api/appointments?start=${startOfCurrentDay.toISOString()}&end=${endOfCurrentDay.toISOString()}`
      );
      if (!response.ok) throw new Error("Failed to fetch appointments");
      return response.json();
    },
  });

  const rescheduleAppointmentMutation = useMutation({
    mutationFn: async ({ 
      appointmentId, 
      startTime, 
      endTime,
      staffId 
    }: { 
      appointmentId: string; 
      startTime: Date; 
      endTime: Date;
      staffId?: string;
    }) => {
      const payload: any = {
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
      };
      
      if (staffId) {
        payload.staffId = staffId;
      }
      
      const response = await apiRequest("PUT", `/api/appointments/${appointmentId}/reschedule`, payload);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/appointments"] });
    },
  });

  // Generate time slots based on settings
  const timeSlots = useMemo(() => {
    const interval = settings?.timeInterval || 15;
    const startHour = parseInt(settings?.workingHoursStart?.split(':')[0] || "9");
    const endHour = parseInt(settings?.workingHoursEnd?.split(':')[0] || "17");
    
    const slots = [];
    let currentSlot = new Date(currentDate);
    currentSlot.setHours(startHour, 0, 0, 0);
    
    const endTime = new Date(currentDate);
    endTime.setHours(endHour, 0, 0, 0);
    
    while (currentSlot < endTime) {
      slots.push(new Date(currentSlot));
      currentSlot = addMinutes(currentSlot, interval);
    }
    
    return slots;
  }, [currentDate, settings]);

  // Calculate current time marker position
  const currentTimeMarkerStyle = useMemo(() => {
    if (!isSameDay(currentTime, currentDate)) return { display: 'none' };
    
    const startHour = parseInt(settings?.workingHoursStart?.split(':')[0] || "9");
    const minutesSinceMidnight = currentTime.getHours() * 60 + currentTime.getMinutes();
    const minutesSinceStart = minutesSinceMidnight - (startHour * 60);
    
    const slotHeightPx = 60; // Height of each time slot in pixels
    const interval = settings?.timeInterval || 15;
    const pixelsPerMinute = slotHeightPx / interval;
    const topPosition = minutesSinceStart * pixelsPerMinute;
    
    return {
      top: `${topPosition}px`,
      display: topPosition >= 0 ? 'block' : 'none'
    };
  }, [currentTime, currentDate, settings]);

  // Get appointments for a specific time slot and staff member
  const getAppointmentForSlot = useCallback((slotTime: Date, staffMember: Staff) => {
    return appointments.find(apt => {
      const aptStart = new Date(apt.startTime);
      return apt.staffId === staffMember.id && 
             aptStart.getTime() === slotTime.getTime();
    });
  }, [appointments]);

  // Check if a time slot should show as busy (appointment continues from previous slot)
  const isSlotBusy = useCallback((slotTime: Date, staffMember: Staff) => {
    return appointments.some(apt => {
      if (apt.staffId !== staffMember.id) return false;
      
      const aptStart = new Date(apt.startTime);
      const aptEnd = new Date(apt.endTime);
      
      return slotTime > aptStart && slotTime < aptEnd;
    });
  }, [appointments]);

  const handleDragStart = useCallback((e: React.DragEvent, appointment: Appointment) => {
    setDraggedAppointment(appointment);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', appointment.id);
  }, []);

  const handleDragEnd = useCallback(() => {
    setDraggedAppointment(null);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }, []);

  const handleDrop = useCallback(async (
    e: React.DragEvent, 
    slotTime: Date, 
    staffMember: Staff
  ) => {
    e.preventDefault();
    
    if (!draggedAppointment) return;
    
    // Calculate new end time based on appointment duration
    const newStartTime = new Date(slotTime);
    const newEndTime = addMinutes(newStartTime, draggedAppointment.duration);
    
    // Check if slot is already occupied
    const existingAppointment = getAppointmentForSlot(slotTime, staffMember);
    if (existingAppointment && existingAppointment.id !== draggedAppointment.id) {
      alert("This time slot is already occupied");
      return;
    }
    
    // Update appointment
    try {
      await rescheduleAppointmentMutation.mutateAsync({
        appointmentId: draggedAppointment.id,
        startTime: newStartTime,
        endTime: newEndTime,
        staffId: staffMember.id, // Include staff ID for cross-column moves
      });
    } catch (error) {
      console.error("Failed to reschedule appointment:", error);
      alert("Failed to reschedule appointment");
    }
  }, [draggedAppointment, getAppointmentForSlot, rescheduleAppointmentMutation]);

  const formatTimeSlot = (time: Date, isMainSlot: boolean = false) => {
    if (isMainSlot) {
      return format(time, 'H:mm');
    }
    return ''; // Sub-slots don't show time
  };

  const isMainTimeSlot = (time: Date, interval: number) => {
    const minutes = time.getMinutes();
    return minutes === 0 || minutes === 30 || (interval === 15 && minutes % 15 === 0);
  };

  return (
    <div className="flex-1 overflow-y-auto custom-scrollbar">
      <div className="relative">
        {/* Current Time Marker */}
        {isSameDay(currentTime, currentDate) && (
          <div 
            className="current-time-marker absolute left-0 right-0 h-0.5 bg-red-500 z-10 pointer-events-none"
            style={currentTimeMarkerStyle}
          >
            <div className="absolute left-0 top-[-4px] w-2.5 h-2.5 bg-red-500 rounded-full"></div>
          </div>
        )}

        {/* Time slots grid */}
        {timeSlots.map((slotTime, index) => {
          const interval = settings?.timeInterval || 15;
          const isMain = isMainTimeSlot(slotTime, interval);
          
          return (
            <div key={slotTime.getTime()} className="flex border-b border-border">
              {/* Time column */}
              <div className={cn(
                "w-20 border-r border-border py-2 px-3 text-xs font-medium text-muted-foreground flex items-start justify-end",
                isMain ? "bg-muted/50" : "bg-muted/30"
              )}>
                {formatTimeSlot(slotTime, isMain)}
              </div>
              
              {/* Staff columns */}
              <div className="flex flex-1">
                {staff.map((staffMember, staffIndex) => {
                  const appointment = getAppointmentForSlot(slotTime, staffMember);
                  const isBusy = !appointment && isSlotBusy(slotTime, staffMember);
                  
                  return (
                    <div
                      key={staffMember.id}
                      className={cn(
                        "flex-1 time-slot relative px-2 py-1 min-h-[60px] transition-colors",
                        staffIndex < staff.length - 1 && "border-r border-border",
                        isBusy && "availability-busy bg-red-50/30",
                        !appointment && !isBusy && "availability-available hover:bg-primary/5"
                      )}
                      onDragOver={handleDragOver}
                      onDrop={(e) => handleDrop(e, slotTime, staffMember)}
                      data-testid={`time-slot-${staffMember.name.replace(' ', '-').toLowerCase()}-${format(slotTime, 'HH-mm')}`}
                    >
                      {appointment && (
                        <AppointmentCard
                          appointment={appointment}
                          staff={staffMember}
                          onDragStart={handleDragStart}
                          onDragEnd={handleDragEnd}
                          onClick={onAppointmentSelect}
                          isDragging={draggedAppointment?.id === appointment.id}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
