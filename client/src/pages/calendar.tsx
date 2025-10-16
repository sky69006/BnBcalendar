import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { CalendarGrid } from "@/components/calendar/CalendarGrid";
import { SettingsPanel } from "@/components/calendar/SettingsPanel";
import { AppointmentDetails } from "@/components/calendar/AppointmentDetails";
import { RescheduleDialog } from "@/components/calendar/RescheduleDialog";
import { useOdooSync } from "@/hooks/useOdooSync";
import { 
  Calendar as CalendarIcon, 
  ChevronLeft, 
  ChevronRight, 
  Settings,
  FolderSync 
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format, addDays, subDays, startOfWeek, addWeeks, subWeeks, addMonths, subMonths, isSameDay } from "date-fns";
import type { Appointment, Staff, CalendarSettings } from "@shared/schema";

type ViewMode = 'day' | 'week' | 'month';

export default function CalendarPage() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>('week');
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [rescheduleDialogOpen, setRescheduleDialogOpen] = useState(false);

  const { syncWithOdoo, isSyncing, syncResult, syncError } = useOdooSync();

  const { data: staff = [] } = useQuery<Staff[]>({
    queryKey: ["/api/staff"],
  });

  const { data: settings } = useQuery<CalendarSettings>({
    queryKey: ["/api/settings"],
  });

  // Auto-sync on component mount
  useEffect(() => {
    const lastSync = settings?.lastOdooSync;
    if (!lastSync) {
      // No previous sync, trigger initial sync
      syncWithOdoo({});
    } else {
      // Check if last sync was more than 5 minutes ago
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
      if (new Date(lastSync) < fiveMinutesAgo) {
        syncWithOdoo({});
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings?.lastOdooSync]);

  const navigateDate = (direction: 'prev' | 'next') => {
    switch (viewMode) {
      case 'day':
        setCurrentDate(current => 
          direction === 'next' ? addDays(current, 1) : subDays(current, 1)
        );
        break;
      case 'week':
        setCurrentDate(current => 
          direction === 'next' ? addWeeks(current, 1) : subWeeks(current, 1)
        );
        break;
      case 'month':
        setCurrentDate(current => 
          direction === 'next' ? addMonths(current, 1) : subMonths(current, 1)
        );
        break;
    }
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  const formatDisplayDate = () => {
    switch (viewMode) {
      case 'day':
        return format(currentDate, 'EEEE, MMMM d, yyyy');
      case 'week':
        const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
        const weekEnd = addDays(weekStart, 6);
        return `${format(weekStart, 'MMM d')} - ${format(weekEnd, 'MMM d, yyyy')}`;
      case 'month':
        return format(currentDate, 'MMMM yyyy');
      default:
        return format(currentDate, 'MMMM d, yyyy');
    }
  };

  const formatLastSync = (lastSync: string | null) => {
    if (!lastSync) return "Never";
    const date = new Date(lastSync);
    const now = new Date();
    const diffMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
    
    if (diffMinutes < 1) return "Just now";
    if (diffMinutes < 60) return `${diffMinutes} min ago`;
    return `${Math.floor(diffMinutes / 60)} hours ago`;
  };

  return (
    <div className="flex h-screen flex-col">
      {/* Top Navigation Bar */}
      <header className="bg-card border-b border-border px-6 py-4 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
              <CalendarIcon className="text-primary-foreground" size={20} />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">Appointments Calendar</h1>
              <p className="text-xs text-muted-foreground">Odoo Integration</p>
            </div>
          </div>
          
          {/* Date Navigation */}
          <div className="flex items-center gap-2 ml-8">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigateDate('prev')}
              data-testid="button-prev-date"
            >
              <ChevronLeft size={16} />
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              onClick={goToToday}
              data-testid="button-today"
            >
              Today
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigateDate('next')}
              data-testid="button-next-date"
            >
              <ChevronRight size={16} />
            </Button>
            
            <div className="ml-4 text-lg font-semibold text-foreground">
              <span data-testid="text-current-date">{formatDisplayDate()}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* FolderSync Status Indicator */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-muted text-muted-foreground text-sm">
            <FolderSync 
              className={cn("text-xs transition-transform", isSyncing && "animate-spin")} 
              size={12} 
            />
            <span data-testid="text-sync-status">
              {isSyncing ? "Syncing..." : `Synced ${formatLastSync(settings?.lastOdooSync ? String(settings.lastOdooSync) : null)}`}
            </span>
          </div>

          {/* View Mode Switcher */}
          <div className="flex items-center bg-muted rounded-lg p-1">
            {(['day', 'week', 'month'] as ViewMode[]).map((mode) => (
              <Button
                key={mode}
                variant={viewMode === mode ? "default" : "ghost"}
                size="sm"
                onClick={() => setViewMode(mode)}
                className="capitalize"
                data-testid={`button-view-${mode}`}
              >
                {mode}
              </Button>
            ))}
          </div>

          {/* Settings Button */}
          <Button
            variant="outline"
            onClick={() => setShowSettings(!showSettings)}
            data-testid="button-toggle-settings"
          >
            <Settings size={16} className="mr-2" />
            Settings
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Calendar View */}
        <main className="flex-1 flex flex-col bg-background overflow-hidden">
          {/* Calendar Header - Day and Week Views Only */}
          {viewMode !== 'month' && (
            <div className="bg-card border-b border-border sticky top-0 z-20">
              <div className="flex">
                {/* Time column header */}
                <div className="w-20 border-r border-border flex items-center justify-center py-3 bg-muted">
                  <CalendarIcon className="text-muted-foreground" size={16} />
                </div>
                
                {/* Day View: Staff Member Columns */}
                {viewMode === 'day' && staff.map((staffMember, index) => (
                  <div 
                    key={staffMember.id}
                    className={cn(
                      "flex-1 px-4 py-3",
                      index < staff.length - 1 && "border-r border-border",
                      `border-l-3 border-l-[${staffMember.color}]`
                    )}
                    style={{ borderLeftColor: staffMember.color }}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div 
                          className="w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold text-sm"
                          style={{ 
                            background: `linear-gradient(135deg, ${staffMember.color}CC, ${staffMember.color})` 
                          }}
                        >
                          {staffMember.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                        </div>
                        <div>
                          <h3 className="font-semibold text-foreground">{staffMember.name}</h3>
                          <p className="text-xs text-muted-foreground">{staffMember.role}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-1 bg-accent/10 text-accent text-xs font-medium rounded">
                          -- booked
                        </span>
                        <div className="w-2 h-2 rounded-full bg-green-500" title="Available"></div>
                      </div>
                    </div>
                  </div>
                ))}

                {/* Week View: Day Columns */}
                {viewMode === 'week' && (() => {
                  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
                  return Array.from({ length: 7 }).map((_, i) => {
                    const day = addDays(weekStart, i);
                    const isToday = isSameDay(day, new Date());
                    return (
                      <div
                        key={day.toISOString()}
                        className={cn(
                          "flex-1 px-4 py-3 text-center",
                          i < 6 && "border-r border-border",
                          isToday && "bg-primary/5"
                        )}
                      >
                        <div className="font-semibold text-foreground">
                          {format(day, 'EEE')}
                        </div>
                        <div className={cn(
                          "text-sm",
                          isToday ? "text-primary font-bold" : "text-muted-foreground"
                        )}>
                          {format(day, 'MMM d')}
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
            </div>
          )}

          {/* Calendar Grid */}
          <CalendarGrid
            currentDate={currentDate}
            viewMode={viewMode}
            onAppointmentSelect={setSelectedAppointment}
            selectedAppointment={selectedAppointment}
          />
        </main>

        {/* Right Sidebar */}
        {showSettings ? (
          <SettingsPanel 
            isOpen={showSettings} 
            onClose={() => setShowSettings(false)} 
          />
        ) : (
          <aside className="w-96 bg-card border-l border-border overflow-y-auto custom-scrollbar">
            <AppointmentDetails
              appointment={selectedAppointment}
              staff={staff}
              onReschedule={(appointment) => {
                setSelectedAppointment(appointment);
                setRescheduleDialogOpen(true);
              }}
              onCancel={(appointment) => {
                console.log("Cancel appointment:", appointment);
                // TODO: Implement cancel confirmation
              }}
            />
          </aside>
        )}
      </div>

      <RescheduleDialog
        appointment={selectedAppointment}
        open={rescheduleDialogOpen}
        onOpenChange={setRescheduleDialogOpen}
      />
    </div>
  );
}
