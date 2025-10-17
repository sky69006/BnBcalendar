import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Users } from "lucide-react";
import type { Staff } from "@shared/schema";

interface StaffLegendProps {
  staff: Staff[];
  selectedStaffIds: string[];
  onStaffToggle: (staffId: string) => void;
  onSelectAll: () => void;
}

export function StaffLegend({
  staff,
  selectedStaffIds,
  onStaffToggle,
  onSelectAll
}: StaffLegendProps) {
  const allSelected = selectedStaffIds.length === 0 || selectedStaffIds.length === staff.length;

  return (
    <div className="bg-card border border-border rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Users size={16} className="text-muted-foreground" />
          <h3 className="font-semibold text-foreground">Resources</h3>
        </div>
        <button
          onClick={onSelectAll}
          className="text-xs text-primary hover:underline"
          disabled={allSelected}
          data-testid="button-select-all-staff"
        >
          All
        </button>
      </div>

      <div className="space-y-2">
        {staff.map((staffMember) => {
          const isChecked = allSelected || selectedStaffIds.includes(staffMember.id);
          
          return (
            <div key={staffMember.id} className="flex items-center gap-3">
              <Checkbox
                id={`staff-${staffMember.id}`}
                checked={isChecked}
                onCheckedChange={() => onStaffToggle(staffMember.id)}
                data-testid={`checkbox-staff-${staffMember.name.replace(' ', '-').toLowerCase()}`}
              />
              <Label
                htmlFor={`staff-${staffMember.id}`}
                className="flex items-center gap-2 cursor-pointer flex-1"
              >
                <div 
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: staffMember.color }}
                />
                <span className="text-sm text-foreground">{staffMember.name}</span>
              </Label>
            </div>
          );
        })}
      </div>
    </div>
  );
}
