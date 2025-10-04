import { useMemo } from "react";
import { Clock, GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Appointment, Staff } from "@shared/schema";

interface AppointmentCardProps {
  appointment: Appointment;
  staff?: Staff;
  onDragStart?: (e: React.DragEvent, appointment: Appointment) => void;
  onDragEnd?: (e: React.DragEvent) => void;
  onClick?: (appointment: Appointment) => void;
  isDragging?: boolean;
}

const SERVICE_COLORS = {
  "Haircut": "apt-haircut",
  "Hair Coloring": "apt-color", 
  "Color": "apt-color",
  "Treatment": "apt-treatment",
  "Consultation": "apt-consultation",
} as const;

export function AppointmentCard({ 
  appointment, 
  staff, 
  onDragStart, 
  onDragEnd, 
  onClick,
  isDragging = false 
}: AppointmentCardProps) {
  const serviceColorClass = useMemo(() => {
    const service = appointment.service;
    for (const [key, className] of Object.entries(SERVICE_COLORS)) {
      if (service.toLowerCase().includes(key.toLowerCase())) {
        return className;
      }
    }
    return "apt-haircut"; // default
  }, [appointment.service]);

  const handleDragStart = (e: React.DragEvent) => {
    if (onDragStart) {
      onDragStart(e, appointment);
    }
  };

  const handleClick = () => {
    if (onClick) {
      onClick(appointment);
    }
  };

  return (
    <div
      className={cn(
        "appointment-card rounded-md p-2 h-full cursor-move transition-all",
        serviceColorClass,
        isDragging && "dragging opacity-50 transform rotate-1"
      )}
      draggable="true"
      onDragStart={handleDragStart}
      onDragEnd={onDragEnd}
      onClick={handleClick}
      data-testid={`appointment-card-${appointment.id}`}
    >
      <div className="flex items-start justify-between mb-1">
        <h4 className="font-semibold text-sm text-foreground truncate">
          {appointment.customerName}
        </h4>
        <GripVertical className="text-muted-foreground text-xs flex-shrink-0 ml-1" size={12} />
      </div>
      
      <p className="text-xs text-muted-foreground mb-1 truncate">
        {appointment.service}
      </p>
      
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Clock size={10} />
        <span>{appointment.duration} min</span>
      </div>
    </div>
  );
}
