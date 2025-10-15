import { useState, useMemo, useCallback, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AppointmentCard } from "./AppointmentCard";
import { BookAppointmentDialog } from "./BookAppointmentDialog";
import { cn } from "@/lib/utils";
import { apiRequest } from "@/lib/queryClient";
import { format, addMinutes, startOfDay, endOfDay, isSameDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, addDays, eachDayOfInterval } from "date-fns";
import type { Appointment, Staff, CalendarSettings } from "@shared/schema";

type ViewMode = 'day' | 'week' | 'month';

interface CalendarGridProps {
  currentDate: Date;
  viewMode: ViewMode;
  onAppointmentSelect: (appointment: Appointment) => void;
  selectedAppointment?: Appointment | null;
}

export function CalendarGrid({ 
  currentDate,
  viewMode,
  onAppointmentSelect, 
  selectedAppointment 
}: CalendarGridProps) {
  const queryClient = useQueryClient();
  const [draggedAppointment, setDraggedAppointment] = useState<Appointment | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [bookingDialogOpen, setBookingDialogOpen] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<{
    date: Date;
    time: string;
    staffId: string;
    staffName: string;
  } | null>(null);

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
    queryKey: ["/api/appointments", currentDate.toISOString(), viewMode],
    queryFn: async () => {
      let startDate: Date;
      let endDate: Date;
      
      switch (viewMode) {
        case 'day':
          startDate = startOfDay(currentDate);
          endDate = endOfDay(currentDate);
          break;
        case 'week':
          startDate = startOfWeek(currentDate, { weekStartsOn: 1 }); // Monday
          endDate = endOfWeek(currentDate, { weekStartsOn: 1 });
          break;
        case 'month':
          startDate = startOfMonth(currentDate);
          endDate = endOfMonth(currentDate);
          break;
        default:
          startDate = startOfDay(currentDate);
          endDate = endOfDay(currentDate);
      }
      
      const response = await fetch(
        `/api/appointments?start=${startDate.toISOString()}&end=${endDate.toISOString()}`
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
    let startHour = parseInt(settings?.workingHoursStart?.split(':')[0] || "9");
    let endHour = parseInt(settings?.workingHoursEnd?.split(':')[0] || "17");
    
    // Expand time range to include appointments outside working hours
    if (appointments.length > 0 && viewMode === 'day') {
      appointments.forEach(apt => {
        const aptStart = new Date(apt.startTime);
        const aptEnd = new Date(apt.endTime);
        
        if (isSameDay(aptStart, currentDate)) {
          startHour = Math.min(startHour, aptStart.getHours());
          endHour = Math.max(endHour, aptEnd.getHours() + 1);
        }
      });
    }
    
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
  }, [currentDate, settings, appointments, viewMode]);

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
      // Match by date, hour, and minute (not exact millisecond)
      return apt.staffId === staffMember.id && 
             isSameDay(aptStart, slotTime) &&
             aptStart.getHours() === slotTime.getHours() &&
             aptStart.getMinutes() === slotTime.getMinutes();
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

  // Check if staff member is available at this time based on their working hours
  const isStaffAvailable = useCallback((slotTime: Date, staffMember: Staff) => {
    // If no working hours defined, assume available (fallback to global settings)
    if (!staffMember.workingHours) return true;
    
    try {
      const workingHours = JSON.parse(staffMember.workingHours);
      
      // Get day of week (0=Sunday, 1=Monday, etc. in JS)
      // Odoo uses 0=Monday, so we need to convert
      const jsDayOfWeek = slotTime.getDay();
      const odooDayOfWeek = jsDayOfWeek === 0 ? 6 : jsDayOfWeek - 1; // Convert to Odoo format
      
      // Get slot time in decimal hours
      const slotHours = slotTime.getHours() + slotTime.getMinutes() / 60;
      
      // Check if there's a matching working period for this day and time
      const isAvailable = workingHours.some((wh: any) => {
        return wh.dayOfWeek === odooDayOfWeek && 
               slotHours >= wh.hourFrom && 
               slotHours < wh.hourTo;
      });
      
      return isAvailable;
    } catch (error) {
      console.error("Failed to parse working hours:", error);
      return true; // Fallback to available if parsing fails
    }
  }, []);

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

  const handleSlotClick = useCallback((slotTime: Date, staffMember: Staff) => {
    setSelectedSlot({
      date: slotTime,
      time: format(slotTime, 'HH:mm'),
      staffId: staffMember.id,
      staffName: staffMember.name
    });
    setBookingDialogOpen(true);
  }, []);

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

  // Get days for week view
  const weekDays = useMemo(() => {
    if (viewMode !== 'week') return [];
    const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
    return eachDayOfInterval({ start: weekStart, end: addDays(weekStart, 6) });
  }, [currentDate, viewMode]);

  // Get days for month view
  const monthDays = useMemo(() => {
    if (viewMode !== 'month') return [];
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(currentDate);
    return eachDayOfInterval({ start: monthStart, end: monthEnd });
  }, [currentDate, viewMode]);

  // Render Day/Week view with time slots
  const renderTimeSlotView = () => {
    const displayStaff = viewMode === 'day' ? staff : [];
    const displayDays = viewMode === 'week' ? weekDays : [currentDate];
    
    return (
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        <div className="relative">
          {/* Current Time Marker */}
          {viewMode === 'day' && isSameDay(currentTime, currentDate) && (
            <div 
              className="current-time-marker absolute left-0 right-0 h-0.5 bg-red-500 z-10 pointer-events-none"
              style={currentTimeMarkerStyle}
            >
              <div className="absolute left-0 top-[-4px] w-2.5 h-2.5 bg-red-500 rounded-full"></div>
            </div>
          )}

          {/* Time slots grid */}
          {timeSlots.map((slotTime) => {
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
                
                {/* Day view: Staff columns */}
                {viewMode === 'day' && (
                  <div className="flex flex-1">
                    {staff.map((staffMember, staffIndex) => {
                      const appointment = getAppointmentForSlot(slotTime, staffMember);
                      const isBusy = !appointment && isSlotBusy(slotTime, staffMember);
                      const isAvailable = isStaffAvailable(slotTime, staffMember);
                      
                      return (
                        <div
                          key={staffMember.id}
                          className={cn(
                            "flex-1 time-slot relative px-2 py-1 min-h-[60px] transition-colors",
                            staffIndex < staff.length - 1 && "border-r border-border",
                            isBusy && "availability-busy bg-red-50/30",
                            !isAvailable && !appointment && "availability-unavailable bg-muted/40 cursor-not-allowed",
                            !appointment && !isBusy && isAvailable && "availability-available hover:bg-primary/5 cursor-pointer"
                          )}
                          onDragOver={handleDragOver}
                          onDrop={(e) => handleDrop(e, slotTime, staffMember)}
                          onClick={() => !appointment && !isBusy && isAvailable && handleSlotClick(slotTime, staffMember)}
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
                )}

                {/* Week view: Day columns */}
                {viewMode === 'week' && (
                  <div className="flex flex-1">
                    {displayDays.map((day, dayIndex) => {
                      // Create the exact datetime for this slot
                      const slotDateTime = new Date(day);
                      slotDateTime.setHours(slotTime.getHours(), slotTime.getMinutes(), 0, 0);
                      
                      // Find appointment that starts at this exact time slot
                      const appointment = appointments.find(apt => {
                        const aptStart = new Date(apt.startTime);
                        const aptStartLocal = new Date(aptStart);
                        return isSameDay(aptStartLocal, day) &&
                               aptStartLocal.getHours() === slotTime.getHours() && 
                               aptStartLocal.getMinutes() === slotTime.getMinutes();
                      });
                      
                      const aptStaff = appointment ? staff.find(s => s.id === appointment.staffId) : undefined;
                      
                      return (
                        <div
                          key={day.toISOString()}
                          className={cn(
                            "flex-1 time-slot relative px-2 py-1 min-h-[60px] transition-colors",
                            dayIndex < displayDays.length - 1 && "border-r border-border",
                            !appointment && "availability-available hover:bg-primary/5 cursor-pointer"
                          )}
                          data-testid={`time-slot-${format(day, 'yyyy-MM-dd')}-${format(slotTime, 'HH-mm')}`}
                        >
                          {appointment && aptStaff && (
                            <AppointmentCard
                              appointment={appointment}
                              staff={aptStaff}
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
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // Render Month view calendar
  const renderMonthView = () => {
    const firstDay = monthDays[0];
    const lastDay = monthDays[monthDays.length - 1];
    const startPadding = (firstDay.getDay() + 6) % 7; // Adjust for Monday start
    
    return (
      <div className="flex-1 overflow-y-auto custom-scrollbar p-4">
        <div className="grid grid-cols-7 gap-2">
          {/* Day headers */}
          {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => (
            <div key={day} className="text-center font-semibold text-sm py-2 text-muted-foreground">
              {day}
            </div>
          ))}
          
          {/* Empty cells for padding */}
          {Array.from({ length: startPadding }).map((_, i) => (
            <div key={`padding-${i}`} className="aspect-square" />
          ))}
          
          {/* Day cells */}
          {monthDays.map(day => {
            const dayAppointments = appointments.filter(apt => 
              isSameDay(new Date(apt.startTime), day)
            );
            const isToday = isSameDay(day, new Date());
            
            return (
              <div
                key={day.toISOString()}
                className={cn(
                  "aspect-square border border-border rounded-lg p-2 flex flex-col",
                  isToday && "border-primary border-2 bg-primary/5"
                )}
                data-testid={`day-cell-${format(day, 'yyyy-MM-dd')}`}
              >
                <div className={cn(
                  "text-sm font-medium mb-1",
                  isToday && "text-primary"
                )}>
                  {format(day, 'd')}
                </div>
                <div className="flex-1 overflow-y-auto space-y-1">
                  {dayAppointments.slice(0, 3).map(apt => (
                    <div
                      key={apt.id}
                      className="text-xs p-1 rounded bg-primary/10 cursor-pointer hover:bg-primary/20 truncate"
                      onClick={() => onAppointmentSelect(apt)}
                      data-testid={`month-appointment-${apt.id}`}
                    >
                      {format(new Date(apt.startTime), 'HH:mm')} {apt.customerName}
                    </div>
                  ))}
                  {dayAppointments.length > 3 && (
                    <div className="text-xs text-muted-foreground">
                      +{dayAppointments.length - 3} more
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <>
      {viewMode === 'month' ? renderMonthView() : renderTimeSlotView()}

      {/* Book Appointment Dialog */}
      <BookAppointmentDialog
        open={bookingDialogOpen}
        onClose={() => setBookingDialogOpen(false)}
        selectedDate={selectedSlot?.date}
        selectedTime={selectedSlot?.time}
        selectedStaffId={selectedSlot?.staffId}
        selectedStaffName={selectedSlot?.staffName}
      />
    </>
  );
}
