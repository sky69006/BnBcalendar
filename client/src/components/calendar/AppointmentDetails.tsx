import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { 
  Calendar, 
  Clock, 
  Hourglass, 
  User, 
  Phone, 
  Mail,
  CalendarPlus,
  XCircle,
  CheckCircle
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import type { Appointment, Staff } from "@shared/schema";

interface AppointmentDetailsProps {
  appointment: Appointment | null;
  staff?: Staff[];
  onReschedule?: (appointment: Appointment) => void;
  onCancel?: (appointment: Appointment) => void;
}

interface AppointmentCategory {
  id: number;
  name: string;
  color: string;
}

export function AppointmentDetails({ 
  appointment, 
  staff = [], 
  onReschedule, 
  onCancel 
}: AppointmentDetailsProps) {
  // Fetch appointment categories
  const { data: categories = [] } = useQuery<AppointmentCategory[]>({
    queryKey: ["/api/appointment-categories"],
  });
  if (!appointment) {
    return (
      <div className="p-6">
        <h2 className="text-lg font-bold text-foreground mb-4">Appointment Details</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Click on an appointment to view details
        </p>
      </div>
    );
  }

  const appointmentStaff = staff.find(s => s.id === appointment.staffId);
  
  // Find the category for this appointment
  const appointmentCategory = categories.find(cat => cat.color === appointment.categoryColor);
  
  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'confirmed':
        return 'bg-primary/10 text-primary';
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'cancelled':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };
  
  // Get category color for display
  const getCategoryColor = (colorIndex: string | null): string | null => {
    if (!colorIndex) return null;
    
    const odooColors = [
      '#F06050', '#F4A460', '#F7CD1F', '#6CC1ED', 
      '#814968', '#EB7E7F', '#2C8397', '#475577', 
      '#D6145F', '#30C381', '#9365B8', '#808080'
    ];
    
    const index = parseInt(colorIndex);
    return !isNaN(index) && index >= 0 && index < odooColors.length 
      ? odooColors[index] 
      : colorIndex;
  };
  
  const categoryColor = appointment.categoryColor ? getCategoryColor(appointment.categoryColor) : null;

  return (
    <div className="p-6">
      <h2 className="text-lg font-bold text-foreground mb-4">Appointment Details</h2>
      
      <div className="bg-muted/50 rounded-lg p-4 border border-border">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="font-bold text-foreground mb-1">
              {appointment.customerName}
            </h3>
            <p className="text-sm text-muted-foreground">
              {appointment.service}
            </p>
          </div>
          <Badge className={getStatusColor(appointment.status)}>
            {appointment.status}
          </Badge>
        </div>

        <div className="space-y-3">
          <div className="flex items-center gap-3 text-sm">
            <Calendar className="w-4 h-4 text-muted-foreground flex-shrink-0" />
            <span className="text-foreground">
              {formatDate(new Date(appointment.startTime))}
            </span>
          </div>
          
          <div className="flex items-center gap-3 text-sm">
            <Clock className="w-4 h-4 text-muted-foreground flex-shrink-0" />
            <span className="text-foreground">
              {formatTime(new Date(appointment.startTime))} - {formatTime(new Date(appointment.endTime))}
            </span>
          </div>
          
          <div className="flex items-center gap-3 text-sm">
            <Hourglass className="w-4 h-4 text-muted-foreground flex-shrink-0" />
            <span className="text-foreground">
              {appointment.duration} minutes
            </span>
          </div>
          
          {appointmentStaff && (
            <div className="flex items-center gap-3 text-sm">
              <User className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              <span className="text-foreground">
                {appointmentStaff.name}
              </span>
            </div>
          )}
          
          {appointmentCategory && (
            <div className="flex items-center gap-3 text-sm">
              <div 
                className="w-4 h-4 rounded border-l-4 flex-shrink-0" 
                style={{ 
                  borderColor: categoryColor || '#808080', 
                  backgroundColor: `${categoryColor || '#808080'}20` 
                }}
              />
              <span className="text-foreground">
                {appointmentCategory.name}
              </span>
            </div>
          )}
          
          {appointment.customerPhone && (
            <div className="flex items-center gap-3 text-sm">
              <Phone className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              <span className="text-foreground">
                {appointment.customerPhone}
              </span>
            </div>
          )}
          
          {appointment.customerEmail && (
            <div className="flex items-center gap-3 text-sm">
              <Mail className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              <span className="text-foreground">
                {appointment.customerEmail}
              </span>
            </div>
          )}
        </div>

        {appointment.price && (
          <>
            <Separator className="my-4" />
            <div className="flex items-center justify-between text-sm mb-2">
              <span className="text-muted-foreground">Service Price</span>
              <span className="font-semibold text-foreground">{appointment.price}</span>
            </div>
          </>
        )}

        {appointment.notes && (
          <>
            <Separator className="my-4" />
            <div>
              <p className="text-xs text-muted-foreground mb-1">Notes</p>
              <div 
                className="text-sm text-foreground prose prose-sm max-w-none"
                dangerouslySetInnerHTML={{ __html: appointment.notes }}
              />
            </div>
          </>
        )}

        <div className="mt-4 space-y-2">
          <Button
            variant="secondary"
            size="sm"
            className="w-full"
            onClick={() => onReschedule?.(appointment)}
            data-testid="button-reschedule-appointment"
          >
            <CalendarPlus className="mr-2 h-4 w-4" />
            Reschedule
          </Button>
          
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={() => onCancel?.(appointment)}
            data-testid="button-cancel-appointment"
          >
            <XCircle className="mr-2 h-4 w-4" />
            Cancel Appointment
          </Button>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="mt-6 grid grid-cols-2 gap-3">
        <div className="bg-primary/5 rounded-lg p-4 border border-primary/20">
          <div className="text-2xl font-bold text-primary mb-1" data-testid="stat-todays-bookings">
            --
          </div>
          <div className="text-xs text-muted-foreground">Today's Bookings</div>
        </div>
        <div className="bg-secondary/5 rounded-lg p-4 border border-secondary/20">
          <div className="text-2xl font-bold text-secondary mb-1" data-testid="stat-available-slots">
            --
          </div>
          <div className="text-xs text-muted-foreground">Available Slots</div>
        </div>
      </div>

      {/* Category Colors Legend */}
      {categories.length > 0 && (
        <div className="mt-6 pt-6 border-t border-border">
          <h3 className="text-sm font-semibold text-foreground mb-3">Category Colors</h3>
          <div className="grid grid-cols-2 gap-2">
            {categories.map((category) => {
              // Convert Odoo color index to hex
              const odooColors = [
                '#F06050', '#F4A460', '#F7CD1F', '#6CC1ED', 
                '#814968', '#EB7E7F', '#2C8397', '#475577', 
                '#D6145F', '#30C381', '#9365B8', '#808080'
              ];
              
              const colorIndex = parseInt(category.color);
              const hexColor = !isNaN(colorIndex) && colorIndex >= 0 && colorIndex < odooColors.length 
                ? odooColors[colorIndex] 
                : category.color;

              return (
                <div key={category.id} className="flex items-center gap-2">
                  <div 
                    className="w-4 h-4 rounded border-l-4 flex-shrink-0" 
                    style={{ 
                      borderColor: hexColor, 
                      backgroundColor: `${hexColor}20` 
                    }}
                  ></div>
                  <span className="text-xs text-foreground truncate" title={category.name}>
                    {category.name}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
