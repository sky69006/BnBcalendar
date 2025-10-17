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
import type { Appointment, Staff } from "@shared/schema";

interface AppointmentDetailsProps {
  appointment: Appointment | null;
  staff?: Staff[];
  onReschedule?: (appointment: Appointment) => void;
  onCancel?: (appointment: Appointment) => void;
}

export function AppointmentDetails({ 
  appointment, 
  staff = [], 
  onReschedule, 
  onCancel 
}: AppointmentDetailsProps) {
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

      {/* Color Legend */}
      <div className="mt-6 pt-6 border-t border-border">
        <h3 className="text-sm font-semibold text-foreground mb-3">Service Types</h3>
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <div className="w-4 h-4 rounded border-l-4 border-primary bg-primary/10"></div>
            <span className="text-sm text-foreground">Haircut & Styling</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-4 h-4 rounded border-l-4 border-destructive bg-destructive/10"></div>
            <span className="text-sm text-foreground">Hair Coloring</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-4 h-4 rounded border-l-4 border-secondary bg-secondary/10"></div>
            <span className="text-sm text-foreground">Treatments</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-4 h-4 rounded border-l-4 border-accent bg-accent/10"></div>
            <span className="text-sm text-foreground">Consultation</span>
          </div>
        </div>
      </div>

      {/* Category Colors Legend */}
      <div className="mt-6 pt-6 border-t border-border">
        <h3 className="text-sm font-semibold text-foreground mb-3">Category Colors</h3>
        <div className="grid grid-cols-2 gap-2">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded border-l-4" style={{ borderColor: '#F06050', backgroundColor: '#F0605020' }}></div>
            <span className="text-xs text-foreground">Red</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded border-l-4" style={{ borderColor: '#F4A460', backgroundColor: '#F4A46020' }}></div>
            <span className="text-xs text-foreground">Orange</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded border-l-4" style={{ borderColor: '#F7CD1F', backgroundColor: '#F7CD1F20' }}></div>
            <span className="text-xs text-foreground">Yellow</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded border-l-4" style={{ borderColor: '#6CC1ED', backgroundColor: '#6CC1ED20' }}></div>
            <span className="text-xs text-foreground">Light Blue</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded border-l-4" style={{ borderColor: '#814968', backgroundColor: '#81496820' }}></div>
            <span className="text-xs text-foreground">Dark Purple</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded border-l-4" style={{ borderColor: '#EB7E7F', backgroundColor: '#EB7E7F20' }}></div>
            <span className="text-xs text-foreground">Light Red</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded border-l-4" style={{ borderColor: '#2C8397', backgroundColor: '#2C839720' }}></div>
            <span className="text-xs text-foreground">Teal</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded border-l-4" style={{ borderColor: '#475577', backgroundColor: '#47557720' }}></div>
            <span className="text-xs text-foreground">Dark Blue</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded border-l-4" style={{ borderColor: '#D6145F', backgroundColor: '#D6145F20' }}></div>
            <span className="text-xs text-foreground">Pink</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded border-l-4" style={{ borderColor: '#30C381', backgroundColor: '#30C38120' }}></div>
            <span className="text-xs text-foreground">Green</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded border-l-4" style={{ borderColor: '#9365B8', backgroundColor: '#9365B820' }}></div>
            <span className="text-xs text-foreground">Purple</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded border-l-4" style={{ borderColor: '#808080', backgroundColor: '#80808020' }}></div>
            <span className="text-xs text-foreground">Gray</span>
          </div>
        </div>
      </div>
    </div>
  );
}
