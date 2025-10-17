import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar, Clock, User, Mail, Phone, Loader2, Check, ChevronsUpDown } from "lucide-react";
import { format } from "date-fns";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface AppointmentType {
  id: number;
  name: string;
  appointment_duration: number;
  is_published: boolean;
  category: string;
  resource_ids?: number[];
}

interface Partner {
  id: number;
  name: string;
  email: string | false;
  phone: string | false;
  mobile: string | false;
}

interface BookAppointmentDialogProps {
  open: boolean;
  onClose: () => void;
  selectedDate?: Date;
  selectedTime?: string;
  selectedStaffId?: string;
  selectedStaffName?: string;
}

export function BookAppointmentDialog({
  open,
  onClose,
  selectedDate,
  selectedTime,
  selectedStaffId,
  selectedStaffName
}: BookAppointmentDialogProps) {
  const { toast } = useToast();
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [selectedTypes, setSelectedTypes] = useState<number[]>([]);
  const [selectedPartnerId, setSelectedPartnerId] = useState<number | null>(null);
  const [partnerSearchOpen, setPartnerSearchOpen] = useState(false);
  const [partnerSearchQuery, setPartnerSearchQuery] = useState("");

  const { data: appointmentTypes = [], isLoading } = useQuery<AppointmentType[]>({
    queryKey: ["/api/appointment-types"],
    enabled: open,
  });

  const { data: staffMembers = [] } = useQuery<any[]>({
    queryKey: ["/api/staff"],
    enabled: open,
  });

  const { data: partners = [], isLoading: isLoadingPartners } = useQuery<Partner[]>({
    queryKey: ["/api/partners", partnerSearchQuery],
    queryFn: async () => {
      const url = partnerSearchQuery 
        ? `/api/partners?search=${encodeURIComponent(partnerSearchQuery)}`
        : '/api/partners';
      const response = await fetch(url);
      if (!response.ok) throw new Error('Failed to fetch partners');
      return response.json();
    },
    enabled: open && partnerSearchOpen,
  });

  // Get the Odoo resource ID for the selected staff member
  const selectedStaff = staffMembers.find(s => s.id === selectedStaffId);
  const selectedResourceId = selectedStaff?.odooUserId;

  // Filter appointment types to only show those compatible with the selected staff
  const compatibleAppointmentTypes = appointmentTypes.filter(type => {
    // If no resource_ids specified, the type is available for all resources
    if (!type.resource_ids || type.resource_ids.length === 0) {
      return true;
    }
    // Otherwise, check if the selected resource is in the allowed list
    return selectedResourceId && type.resource_ids.includes(selectedResourceId);
  });

  const createAppointmentMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest("POST", "/api/appointments/book", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/appointments"], exact: false });
      toast({
        title: "Succesvol",
        description: "Afspraak succesvol geboekt!",
      });
      handleClose();
    },
    onError: (error: any) => {
      toast({
        title: "Fout",
        description: error.message || "Kon afspraak niet boeken",
        variant: "destructive",
      });
    },
  });

  useEffect(() => {
    if (!open) {
      setCustomerName("");
      setCustomerEmail("");
      setCustomerPhone("");
      setSelectedTypes([]);
      setSelectedPartnerId(null);
      setPartnerSearchQuery("");
    }
  }, [open]);

  const handlePartnerSelect = (partnerId: number) => {
    const partner = partners.find(p => p.id === partnerId);
    if (partner) {
      setSelectedPartnerId(partnerId);
      setCustomerName(partner.name);
      setCustomerEmail(partner.email ? partner.email : "");
      setCustomerPhone(partner.phone ? partner.phone : partner.mobile ? partner.mobile : "");
      setPartnerSearchOpen(false);
    }
  };

  const handleClose = () => {
    onClose();
  };

  const handleTypeToggle = (typeId: number) => {
    setSelectedTypes(prev =>
      prev.includes(typeId)
        ? prev.filter(id => id !== typeId)
        : [...prev, typeId]
    );
  };

  const calculateTotalDuration = () => {
    return selectedTypes.reduce((total, typeId) => {
      const type = appointmentTypes.find(t => t.id === typeId);
      return total + (type?.appointment_duration || 0);
    }, 0);
  };

  const handleSubmit = () => {
    if (!customerName.trim()) {
      toast({
        title: "Validatiefout",
        description: "Klantnaam is verplicht",
        variant: "destructive",
      });
      return;
    }

    if (selectedTypes.length === 0) {
      toast({
        title: "Validatiefout",
        description: "Selecteer minimaal één type afspraak",
        variant: "destructive",
      });
      return;
    }

    if (!selectedDate || !selectedTime || !selectedStaffId) {
      toast({
        title: "Fout",
        description: "Selecteer een tijdslot in de kalender",
        variant: "destructive",
      });
      return;
    }

    const totalDuration = calculateTotalDuration();
    const [hours, minutes] = selectedTime.split(':').map(Number);
    const startTime = new Date(selectedDate);
    startTime.setHours(hours, minutes, 0, 0);
    
    const endTime = new Date(startTime);
    endTime.setMinutes(endTime.getMinutes() + totalDuration * 60);

    createAppointmentMutation.mutate({
      customerName,
      customerEmail,
      customerPhone,
      appointmentTypeIds: selectedTypes,
      startTime: startTime.toISOString(),
      endTime: endTime.toISOString(),
      staffId: selectedStaffId,
      partnerId: selectedPartnerId || undefined,
    });
  };

  const totalDuration = calculateTotalDuration();
  const totalHours = Math.floor(totalDuration);
  const totalMinutes = Math.round((totalDuration - totalHours) * 60);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>Nieuwe Afspraak Boeken</DialogTitle>
          <DialogDescription>
            Vul klantgegevens in en selecteer diensten om een afspraak te boeken
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh] pr-4">
          <div className="space-y-6">
            {/* Selected Time Info */}
            {selectedDate && selectedTime && (
              <div className="bg-muted p-4 rounded-lg space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <Calendar className="h-4 w-4" />
                  <span>{format(selectedDate, 'EEEE, MMMM d, yyyy')}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Clock className="h-4 w-4" />
                  <span>{selectedTime}</span>
                </div>
                {selectedStaffName && (
                  <div className="flex items-center gap-2 text-sm">
                    <User className="h-4 w-4" />
                    <span>{selectedStaffName}</span>
                  </div>
                )}
              </div>
            )}

            {/* Customer Information */}
            <div className="space-y-4">
              <h3 className="font-semibold">Klantgegevens</h3>
              
              {/* Partner Selector */}
              <div className="space-y-2">
                <Label>Selecteer Bestaand Contact</Label>
                <Popover open={partnerSearchOpen} onOpenChange={setPartnerSearchOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={partnerSearchOpen}
                      className="w-full justify-between"
                      data-testid="button-select-partner"
                    >
                      {selectedPartnerId
                        ? partners.find((p) => p.id === selectedPartnerId)?.name
                        : "Zoek een contact..."}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-full p-0" align="start">
                    <Command shouldFilter={false}>
                      <CommandInput 
                        placeholder="Zoek contacten..." 
                        value={partnerSearchQuery}
                        onValueChange={setPartnerSearchQuery}
                        data-testid="input-search-partner"
                      />
                      <CommandList>
                        <CommandEmpty>
                          {isLoadingPartners ? "Laden..." : "Geen contacten gevonden."}
                        </CommandEmpty>
                        <CommandGroup>
                          {partners.map((partner) => (
                            <CommandItem
                              key={partner.id}
                              value={partner.id.toString()}
                              onSelect={() => handlePartnerSelect(partner.id)}
                              data-testid={`partner-option-${partner.id}`}
                            >
                              <Check
                                className={cn(
                                  "mr-2 h-4 w-4",
                                  selectedPartnerId === partner.id ? "opacity-100" : "opacity-0"
                                )}
                              />
                              <div className="flex flex-col">
                                <span>{partner.name}</span>
                                {(partner.email || partner.phone || partner.mobile) && (
                                  <span className="text-xs text-muted-foreground">
                                    {partner.email || partner.phone || partner.mobile}
                                  </span>
                                )}
                              </div>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
                <p className="text-xs text-muted-foreground">
                  Of voer klantgegevens handmatig in
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="customerName">Naam *</Label>
                <Input
                  id="customerName"
                  value={customerName}
                  onChange={(e) => {
                    setCustomerName(e.target.value);
                    setSelectedPartnerId(null);
                  }}
                  placeholder="Voer klantnaam in"
                  data-testid="input-customer-name"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="customerEmail">E-mail</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="customerEmail"
                    type="email"
                    value={customerEmail}
                    onChange={(e) => setCustomerEmail(e.target.value)}
                    placeholder="customer@example.com"
                    className="pl-10"
                    data-testid="input-customer-email"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="customerPhone">Telefoon</Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="customerPhone"
                    type="tel"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    placeholder="+32 123 456 789"
                    className="pl-10"
                    data-testid="input-customer-phone"
                  />
                </div>
              </div>
            </div>

            {/* Appointment Types Selection */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">Selecteer Diensten</h3>
                {totalDuration > 0 && (
                  <span className="text-sm text-muted-foreground">
                    Totaal: {totalHours > 0 && `${totalHours}u `}{totalMinutes > 0 && `${totalMinutes}min`}
                  </span>
                )}
              </div>

              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : compatibleAppointmentTypes.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <p>Geen diensten beschikbaar voor {selectedStaffName || 'deze medewerker'}.</p>
                  <p className="text-sm mt-2">Selecteer een ander tijdslot.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {compatibleAppointmentTypes.map((type) => (
                    <div
                      key={type.id}
                      className="flex items-center space-x-3 p-3 rounded-lg border hover:bg-accent/50 transition-colors"
                      data-testid={`appointment-type-${type.id}`}
                    >
                      <Checkbox
                        id={`type-${type.id}`}
                        checked={selectedTypes.includes(type.id)}
                        onCheckedChange={() => handleTypeToggle(type.id)}
                        data-testid={`checkbox-type-${type.id}`}
                      />
                      <label
                        htmlFor={`type-${type.id}`}
                        className="flex-1 cursor-pointer"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-medium">{type.name}</span>
                          <span className="text-sm text-muted-foreground">
                            {type.appointment_duration >= 1 
                              ? `${Math.floor(type.appointment_duration)}h ${Math.round((type.appointment_duration % 1) * 60)}min`
                              : `${Math.round(type.appointment_duration * 60)}min`}
                          </span>
                        </div>
                      </label>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </ScrollArea>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} data-testid="button-cancel-booking">
            Annuleren
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={createAppointmentMutation.isPending}
            data-testid="button-confirm-booking"
          >
            {createAppointmentMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Boeken...
              </>
            ) : (
              `Boek ${selectedTypes.length > 0 ? `${selectedTypes.length} Dienst${selectedTypes.length > 1 ? 'en' : ''}` : 'Afspraak'}`
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
