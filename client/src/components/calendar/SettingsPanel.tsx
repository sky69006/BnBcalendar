import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Clock, Calendar, Users, Settings, FolderSync, X, CalendarDays, CalendarX, Palette } from "lucide-react";
import { useOdooSync } from "@/hooks/useOdooSync";
import { apiRequest } from "@/lib/queryClient";
import { cn } from "@/lib/utils";
import type { CalendarSettings, Staff } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";

interface SettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

const DAYS_OF_WEEK = [
  { key: 1, label: "M", name: "Monday" },
  { key: 2, label: "D", name: "Tuesday" },
  { key: 3, label: "W", name: "Wednesday" },
  { key: 4, label: "D", name: "Thursday" },
  { key: 5, label: "V", name: "Friday" },
  { key: 6, label: "Z", name: "Saturday" },
  { key: 0, label: "Z", name: "Sunday" },
];

export function SettingsPanel({ isOpen, onClose }: SettingsPanelProps) {
  const queryClient = useQueryClient();
  const { syncWithOdoo, isSyncing, syncResult, syncError } = useOdooSync();
  const { toast } = useToast();

  const { data: settings } = useQuery<CalendarSettings>({
    queryKey: ["/api/settings"],
  });

  const { data: staff } = useQuery<Staff[]>({
    queryKey: ["/api/staff"],
  });

  const { data: categories } = useQuery<any[]>({
    queryKey: ["/api/appointment-categories"],
  });

  const [localSettings, setLocalSettings] = useState<Partial<CalendarSettings>>({});

  const randomizeColorsMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/appointment-categories/randomize-colors", {});
      return response.json();
    },
    onSuccess: async (data) => {
      toast({
        title: "Kleuren Bijgewerkt!",
        description: `Succesvol ${data.updated} categorie kleuren bijgewerkt. Afspraken synchroniseren...`,
      });
      
      // Invalidate categories to refresh legend
      queryClient.invalidateQueries({ queryKey: ["/api/appointment-categories"] });
      
      // Trigger sync to update appointments with new colors
      const today = new Date();
      const pastDate = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
      const futureDate = new Date(today.getTime() + 90 * 24 * 60 * 60 * 1000);
      
      syncWithOdoo({
        start: pastDate.toISOString(),
        end: futureDate.toISOString(),
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Bijwerken Mislukt",
        description: error.message || "Kan categorie kleuren niet bijwerken",
        variant: "destructive",
      });
    },
  });

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
    if (!lastSync) return "Nooit";
    const date = new Date(lastSync);
    const now = new Date();
    const diffMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
    
    if (diffMinutes < 1) return "Zojuist";
    if (diffMinutes < 60) return `${diffMinutes} min geleden`;
    if (diffMinutes < 1440) return `${Math.floor(diffMinutes / 60)} uur geleden`;
    return date.toLocaleDateString('nl-NL');
  };

  return (
    <aside className="w-96 bg-card border-l border-border overflow-y-auto custom-scrollbar">
      {/* Settings Panel */}
      <div className="p-6 border-b border-border">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
            <Settings className="text-primary" size={20} />
            Kalender Instellingen
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
            Tijdslot Interval
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
            Gesynchroniseerd met Odoo agenda instellingen
          </p>
        </div>

        {/* Inactive Days */}
        <div className="mb-6">
          <Label className="block text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
            <CalendarX className="text-primary" size={16} />
            Inactieve Dagen
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
              ? `${currentInactiveDays.length} dagen gemarkeerd als inactief`
              : "Alle dagen actief"
            }
          </p>
        </div>

        {/* Date Range */}
        <div className="mb-6">
          <Label className="block text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
            <CalendarDays className="text-primary" size={16} />
            Boekingsdatum Bereik
          </Label>
          <div>
            <Label className="text-xs text-muted-foreground mb-1 block">
              Maanden vooruit
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
            Toon Medewerkers
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
            {isSyncing ? "Synchroniseren..." : "Nu Synchroniseren met Odoo"}
          </Button>
          
          <Button
            className="w-full flex items-center justify-center gap-2 mt-3"
            variant="outline"
            onClick={() => randomizeColorsMutation.mutate()}
            disabled={randomizeColorsMutation.isPending}
            data-testid="button-randomize-colors"
          >
            <Palette size={16} />
            {randomizeColorsMutation.isPending ? "Bijwerken..." : "Randomiseer Categorie Kleuren"}
          </Button>

          {/* Category Colors Legend */}
          {categories && categories.length > 0 && (
            <div className="mt-4 p-3 rounded-lg bg-muted/50">
              <h4 className="text-xs font-semibold text-foreground mb-2">Categorie Kleuren</h4>
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
                    <div key={category.id} className="flex items-center gap-2" data-testid={`category-legend-${category.id}`}>
                      <div 
                        className="w-3 h-3 rounded border-l-2 flex-shrink-0" 
                        style={{ 
                          borderColor: hexColor, 
                          backgroundColor: `${hexColor}20` 
                        }}
                        data-testid={`category-swatch-${category.id}`}
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
          
          <div className="mt-2 text-center">
            <p className="text-xs text-muted-foreground">
              Laatste sync: {formatLastSync(settings?.lastOdooSync ? (typeof settings.lastOdooSync === 'string' ? settings.lastOdooSync : new Date(settings.lastOdooSync).toISOString()) : null)}
            </p>
            
            {syncResult && (
              <p className="text-xs text-green-600 mt-1">
                Gesynchroniseerd {syncResult.synced?.created || 0} nieuw, {syncResult.synced?.updated || 0} bijgewerkt
              </p>
            )}
            
            {syncError && (
              <p className="text-xs text-red-600 mt-1">
                Synchronisatie mislukt: {syncError.message}
              </p>
            )}
          </div>
        </div>
      </div>
    </aside>
  );
}
