import { useMemo, useState, useRef } from "react";
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
  const [isDraggingLocal, setIsDraggingLocal] = useState(false);
  const dragStartPos = useRef<{ x: number; y: number } | null>(null);
  
  const serviceColorClass = useMemo(() => {
    const service = appointment.service;
    for (const [key, className] of Object.entries(SERVICE_COLORS)) {
      if (service.toLowerCase().includes(key.toLowerCase())) {
        return className;
      }
    }
    return "apt-haircut"; // default
  }, [appointment.service]);

  const handleMouseDown = (e: React.MouseEvent) => {
    dragStartPos.current = { x: e.clientX, y: e.clientY };
  };

  const handleDragStart = (e: React.DragEvent) => {
    setIsDraggingLocal(true);
    if (onDragStart) {
      onDragStart(e, appointment);
    }
  };

  const handleDragEnd = (e: React.DragEvent) => {
    setIsDraggingLocal(false);
    dragStartPos.current = null;
    if (onDragEnd) {
      onDragEnd(e);
    }
  };

  const handleClick = (e: React.MouseEvent) => {
    // Only trigger click if we're not in a drag operation
    // Check if mouse moved significantly from drag start position
    if (dragStartPos.current) {
      const deltaX = Math.abs(e.clientX - dragStartPos.current.x);
      const deltaY = Math.abs(e.clientY - dragStartPos.current.y);
      
      // If moved more than 5px, it was a drag, not a click
      if (deltaX > 5 || deltaY > 5) {
        dragStartPos.current = null;
        return;
      }
    }
    
    dragStartPos.current = null;
    
    if (onClick && !isDraggingLocal) {
      e.stopPropagation();
      onClick(appointment);
    }
  };

  return (
    <div
      className={cn(
        "appointment-card rounded-md p-2 h-full w-full cursor-pointer transition-all overflow-hidden",
        serviceColorClass,
        isDragging && "dragging opacity-50 transform rotate-1"
      )}
      draggable="true"
      onMouseDown={handleMouseDown}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
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
