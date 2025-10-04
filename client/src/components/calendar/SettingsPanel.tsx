import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Clock, Calendar, Users, Settings, FolderSync, X, CalendarDays, CalendarX } from "lucide-react";
import { useOdooSync } from "@/hooks/useOdooSync";
import { apiRequest } from "@/lib/queryClient";
import { cn } from "@/lib/utils";
import type { CalendarSettings, Staff } from "@shared/schema";

interface SettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

const DAYS_OF_WEEK = [
  { key: 1, label: "M", name: "Monday" },
  { key: 2, label: "T", name: "Tuesday" },
  { key: 3, label: "W", name: "Wednesday" },
  { key: 4, label: "T", name: "Thursday" },
  { key: 5, label: "F", name: "Friday" },
  { key: 6, label: "S", name: "Saturday" },
  { key: 0, label: "S", name: "Sunday" },
];

export function SettingsPanel({ isOpen, onClose }: SettingsPanelProps) {
  const queryClient = useQueryClient();
  const { syncWithOdoo, isSyncing, syncResult, syncError } = useOdooSync();

  const { data: settings } = useQuery<CalendarSettings>({
    queryKey: ["/api/settings"],
  });

  const { data: staff } = useQuery<Staff[]>({
    queryKey: ["/api/staff"],
  });

  const [localSettings, setLocalSettings] = useState<Partial<CalendarSettings>>({});

  const updateSettingsMutation = useMutation({
    mutationFn: async (updates: Partial<CalendarSettings>) => {
      const response = await apiRequest("PUT", "/api/settings", updates);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
    },
  });

  const handleTimeIntervalChange = (interval: number) => {
    const updates = { timeInterval: interval };
    setLocalSettings(updates);
    updateSettingsMutation.mutate(updates);
  };

  const handleInactiveDayToggle = (dayNum: number) => {
    if (!settings) return;
    
    const inactiveDays = settings.inactiveDays.split(',').filter(Boolean).map(Number);
    const isInactive = inactiveDays.includes(dayNum);
    
    let newInactiveDays: number[];
    if (isInactive) {
      newInactiveDays = inactiveDays.filter(d => d !== dayNum);
    } else {
      newInactiveDays = [...inactiveDays, dayNum];
    }
    
    const updates = { inactiveDays: newInactiveDays.join(',') };
    setLocalSettings(updates);
    updateSettingsMutation.mutate(updates);
  };

  const handleSyncNow = () => {
    const today = new Date();
    const nextWeek = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
    
    syncWithOdoo({
      start: today.toISOString(),
      end: nextWeek.toISOString(),
    });
  };

  if (!isOpen) return null;

  const currentTimeInterval = localSettings.timeInterval ?? settings?.timeInterval ?? 15;
  const currentInactiveDays = (localSettings.inactiveDays ?? settings?.inactiveDays ?? "0")
    .split(',').filter(Boolean).map(Number);

  const formatLastSync = (lastSync: string | null) => {
    if (!lastSync) return "Never";
    const date = new Date(lastSync);
    const now = new Date();
    const diffMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
    
    if (diffMinutes < 1) return "Just now";
    if (diffMinutes < 60) return `${diffMinutes} min ago`;
    if (diffMinutes < 1440) return `${Math.floor(diffMinutes / 60)} hours ago`;
    return date.toLocaleDateString();
  };

  return (
    <aside className="w-96 bg-card border-l border-border overflow-y-auto custom-scrollbar">
      {/* Settings Panel */}
      <div className="p-6 border-b border-border">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
            <Settings className="text-primary" size={20} />
            Calendar Settings
          </h2>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={onClose}
            data-testid="button-close-settings"
          >
            <X size={16} />
          </Button>
        </div>

        {/* Time Interval Setting */}
        <div className="mb-6">
          <Label className="block text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
            <Clock className="text-primary" size={16} />
            Time Slot Interval
          </Label>
          <div className="flex gap-2">
            {[10, 15, 30].map((interval) => (
              <Button
                key={interval}
                variant={currentTimeInterval === interval ? "default" : "outline"}
                size="sm"
                className="flex-1"
                onClick={() => handleTimeIntervalChange(interval)}
                data-testid={`button-interval-${interval}`}
              >
                {interval} min
              </Button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Synced with Odoo agenda settings
          </p>
        </div>

        {/* Inactive Days */}
        <div className="mb-6">
          <Label className="block text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
            <CalendarX className="text-primary" size={16} />
            Inactive Days
          </Label>
          <div className="grid grid-cols-7 gap-1">
            {DAYS_OF_WEEK.map((day) => (
              <Button
                key={day.key}
                variant={currentInactiveDays.includes(day.key) ? "default" : "outline"}
                size="sm"
                className="aspect-square p-0"
                onClick={() => handleInactiveDayToggle(day.key)}
                data-testid={`button-day-${day.name.toLowerCase()}`}
              >
                {day.label}
              </Button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            {currentInactiveDays.length > 0 
              ? `${currentInactiveDays.length} days marked as inactive`
              : "All days active"
            }
          </p>
        </div>

        {/* Date Range */}
        <div className="mb-6">
          <Label className="block text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
            <CalendarDays className="text-primary" size={16} />
            Booking Date Range
          </Label>
          <div>
            <Label className="text-xs text-muted-foreground mb-1 block">
              Months in advance
            </Label>
            <Input
              type="number"
              value={localSettings.bookingMonthsAhead ?? settings?.bookingMonthsAhead ?? 5}
              onChange={(e) => {
                const updates = { bookingMonthsAhead: parseInt(e.target.value) || 5 };
                setLocalSettings(updates);
                updateSettingsMutation.mutate(updates);
              }}
              className="w-full"
              min="1"
              max="12"
              data-testid="input-booking-months"
            />
          </div>
        </div>

        {/* Staff Filter */}
        <div className="mb-6">
          <Label className="block text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
            <Users className="text-primary" size={16} />
            Show Staff Members
          </Label>
          <div className="space-y-2">
            {staff?.map((member) => (
              <div
                key={member.id}
                className="flex items-center gap-3 p-2 rounded-md hover:bg-muted cursor-pointer"
              >
                <Checkbox
                  id={`staff-${member.id}`}
                  defaultChecked={member.isActive}
                  data-testid={`checkbox-staff-${member.name.toLowerCase().replace(' ', '-')}`}
                />
                <Label
                  htmlFor={`staff-${member.id}`}
                  className="text-sm cursor-pointer flex-1"
                >
                  {member.name}
                </Label>
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: member.color }}
                />
              </div>
            ))}
          </div>
        </div>

        {/* Odoo FolderSync */}
        <div className="pt-4 border-t border-border">
          <Button
            className="w-full flex items-center justify-center gap-2"
            onClick={handleSyncNow}
            disabled={isSyncing}
            data-testid="button-sync-odoo"
          >
            <FolderSync className={cn("transition-transform", isSyncing && "animate-spin")} size={16} />
            {isSyncing ? "Syncing..." : "Sync with Odoo Now"}
          </Button>
          
          <div className="mt-2 text-center">
            <p className="text-xs text-muted-foreground">
              Last sync: {formatLastSync(settings?.lastOdooSync?.toISOString() || null)}
            </p>
            
            {syncResult && (
              <p className="text-xs text-green-600 mt-1">
                Synced {syncResult.synced?.created || 0} new, {syncResult.synced?.updated || 0} updated
              </p>
            )}
            
            {syncError && (
              <p className="text-xs text-red-600 mt-1">
                FolderSync failed: {syncError.message}
              </p>
            )}
          </div>
        </div>
      </div>
    </aside>
  );
}
