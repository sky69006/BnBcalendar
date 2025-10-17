import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { odooService } from "./services/odoo";
import { insertAppointmentSchema, insertStaffSchema, insertCalendarSettingsSchema, type Appointment } from "@shared/schema";
import { z } from "zod";

export async function registerRoutes(app: Express): Promise<Server> {
  // Test Odoo connection
  app.get("/api/test-odoo", async (req, res) => {
    try {
      const version = await odooService.getVersion();
      res.json({ success: true, version });
    } catch (error) {
      console.error("Odoo connection test failed:", error);
      res.status(500).json({ 
        success: false, 
        error: error instanceof Error ? error.message : "Unknown error" 
      });
    }
  });

  // Staff routes
  app.get("/api/staff", async (req, res) => {
    try {
      const staffMembers = await storage.getAllStaff();
      res.json(staffMembers);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch staff members" });
    }
  });

  app.post("/api/staff", async (req, res) => {
    try {
      const staffData = insertStaffSchema.parse(req.body);
      const staff = await storage.createStaff(staffData);
      res.json(staff);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: "Invalid staff data", details: error.errors });
      } else {
        res.status(500).json({ error: "Failed to create staff member" });
      }
    }
  });

  app.put("/api/staff/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const updates = req.body;
      const staff = await storage.updateStaff(id, updates);
      
      if (!staff) {
        return res.status(404).json({ error: "Staff member not found" });
      }
      
      res.json(staff);
    } catch (error) {
      res.status(500).json({ error: "Failed to update staff member" });
    }
  });

  // Appointments routes
  app.get("/api/appointments", async (req, res) => {
    try {
      const { start, end } = req.query;
      
      if (start && end) {
        const startDate = new Date(start as string);
        const endDate = new Date(end as string);
        const appointments = await storage.getAppointmentsByDateRange(startDate, endDate);
        res.json(appointments);
      } else {
        const appointments = await storage.getAllAppointments();
        res.json(appointments);
      }
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch appointments" });
    }
  });

  app.post("/api/appointments", async (req, res) => {
    try {
      const appointmentData = insertAppointmentSchema.parse(req.body);
      const appointment = await storage.createAppointment(appointmentData);
      res.json(appointment);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: "Invalid appointment data", details: error.errors });
      } else {
        res.status(500).json({ error: "Failed to create appointment" });
      }
    }
  });

  app.put("/api/appointments/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const updates = req.body;
      const appointment = await storage.updateAppointment(id, updates);
      
      if (!appointment) {
        return res.status(404).json({ error: "Appointment not found" });
      }
      
      res.json(appointment);
    } catch (error) {
      res.status(500).json({ error: "Failed to update appointment" });
    }
  });

  app.delete("/api/appointments/:id", async (req, res) => {
    try {
      const { id } = req.params;
      
      // Get appointment to check if it has an Odoo ID
      const appointment = await storage.getAppointment(id);
      if (!appointment) {
        return res.status(404).json({ error: "Appointment not found" });
      }

      // Try to delete from Odoo first, but don't fail if it's not available
      let odooSyncSuccess = false;
      if (appointment.odooEventId) {
        try {
          await odooService.deleteAppointment(appointment.odooEventId);
          odooSyncSuccess = true;
        } catch (odooError) {
          console.warn("Odoo sync failed for deletion, deleting locally only:", odooError instanceof Error ? odooError.message : odooError);
          // Continue with local deletion even if Odoo fails
        }
      }

      // Delete from local storage
      const deleted = await storage.deleteAppointment(id);
      
      if (!deleted) {
        return res.status(404).json({ error: "Appointment not found" });
      }
      
      res.json({ 
        success: true,
        odooSynced: odooSyncSuccess
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete appointment" });
    }
  });

  // Reschedule appointment (drag & drop)
  app.put("/api/appointments/:id/reschedule", async (req, res) => {
    try {
      const { id } = req.params;
      const { startTime, endTime, staffId } = req.body;
      
      if (!startTime || !endTime) {
        return res.status(400).json({ error: "Start time and end time are required" });
      }

      const appointment = await storage.getAppointment(id);
      if (!appointment) {
        return res.status(404).json({ error: "Appointment not found" });
      }

      // Determine which staff to check conflicts for (new staff if changing, otherwise current)
      const targetStaffId = staffId || appointment.staffId;

      // Check for local conflicts - ensure no other appointment for target staff overlaps
      if (targetStaffId) {
        const allAppointments = await storage.getAllAppointments();
        const newStart = new Date(startTime);
        const newEnd = new Date(endTime);
        
        const hasConflict = allAppointments.some(apt => {
          // Skip the appointment being moved
          if (apt.id === id) return false;
          // Only check target staff
          if (apt.staffId !== targetStaffId) return false;
          
          const aptStart = new Date(apt.startTime);
          const aptEnd = new Date(apt.endTime);
          
          // Check for any time overlap
          return (newStart < aptEnd && newEnd > aptStart);
        });

        if (hasConflict) {
          return res.status(409).json({ error: "This time slot is already occupied" });
        }
      }

      // Try to update in Odoo, but don't fail if it's not available
      let odooSyncSuccess = false;
      try {
        await odooService.updateAppointment(appointment.odooEventId, {
          start: new Date(startTime).toISOString(),
          stop: new Date(endTime).toISOString(),
        });
        odooSyncSuccess = true;
      } catch (odooError) {
        console.warn("Odoo sync failed for rescheduling, updating locally only:", odooError instanceof Error ? odooError.message : odooError);
        // Continue with local update even if Odoo fails
      }

      // Update in local storage
      const updateData: Partial<Appointment> = {
        startTime: new Date(startTime),
        endTime: new Date(endTime),
      };
      
      // Update staff if provided
      if (staffId) {
        updateData.staffId = staffId;
      }

      const updatedAppointment = await storage.updateAppointment(id, updateData);

      res.json({
        ...updatedAppointment,
        odooSynced: odooSyncSuccess
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to reschedule appointment" });
    }
  });

  // Odoo sync routes
  let isSyncing = false; // Prevent concurrent syncs
  
  app.post("/api/sync/odoo", async (req, res) => {
    // Check if sync is already in progress
    if (isSyncing) {
      return res.status(429).json({ 
        error: "Sync already in progress",
        message: "Please wait for the current sync to complete"
      });
    }
    
    isSyncing = true;
    
    try {
      const { start, end } = req.body;
      const startDate = start ? new Date(start).toISOString() : new Date().toISOString();
      const endDate = end ? new Date(end).toISOString() : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

      // Fetch resources (employees) from Odoo
      const odooResources = await odooService.fetchResources();
      
      // Sync staff members based on resources
      for (const resource of odooResources) {
        const existingStaff = await storage.getStaffByOdooUserId(resource.id);
        
        // Fetch working hours from resource calendar if available
        let workingHours = null;
        let resourceCalendarId = null;
        
        if (resource.resource_calendar_id && Array.isArray(resource.resource_calendar_id)) {
          resourceCalendarId = resource.resource_calendar_id[0];
          try {
            const calendar = await odooService.fetchResourceCalendar(resourceCalendarId);
            if (calendar && calendar.attendances) {
              // Convert Odoo attendances to a simplified format
              workingHours = calendar.attendances.map((att: any) => ({
                dayOfWeek: parseInt(att.dayofweek), // 0=Monday, 6=Sunday in Odoo
                hourFrom: att.hour_from,
                hourTo: att.hour_to,
                dayPeriod: att.day_period,
                name: att.name
              }));
            }
          } catch (calendarError) {
            console.warn(`Failed to fetch calendar for resource ${resource.id}:`, calendarError);
          }
        }
        
        const staffData = {
          odooUserId: resource.id,
          name: resource.name,
          email: resource.employee_id ? `${resource.name.toLowerCase().replace(/\s+/g, '.')}@salon.com` : "",
          role: "Stylist",
          color: `#${Math.floor(Math.random()*16777215).toString(16)}`,
          isActive: true,
          resourceCalendarId,
          workingHours: workingHours ? JSON.stringify(workingHours) : null,
        };
        
        if (!existingStaff) {
          await storage.createStaff(staffData);
        } else {
          // Update working hours if they've changed
          await storage.updateStaff(existingStaff.id, {
            resourceCalendarId,
            workingHours: workingHours ? JSON.stringify(workingHours) : existingStaff.workingHours,
          });
        }
      }

      // Fetch appointments from Odoo
      const odooAppointments = await odooService.fetchAppointments(startDate, endDate);

      // Sync appointments
      const syncedCount = { created: 0, updated: 0 };
      
      for (const odooApp of odooAppointments) {
        const existingAppointment = await storage.getAppointmentByOdooEventId(odooApp.id);
        
        // Get staff using appointment_resource_id
        let staff = null;
        if (odooApp.appointment_resource_id && Array.isArray(odooApp.appointment_resource_id)) {
          staff = await storage.getStaffByOdooUserId(odooApp.appointment_resource_id[0]);
        }

        // Get customer name from partner_ids or partner_id
        let customerName = "Unknown Customer";
        if (odooApp.partner_ids && odooApp.partner_ids.length > 0) {
          // We have partner IDs but need to fetch the name separately
          // For now, use a fallback or the appointment name
          customerName = odooApp.name.split(' - ')[0] || odooApp.name;
        } else if (Array.isArray(odooApp.partner_id)) {
          customerName = odooApp.partner_id[1];
        }

        const appointmentData = {
          odooEventId: odooApp.id,
          name: odooApp.name || "Untitled Appointment",
          customerName: customerName,
          customerEmail: "",
          customerPhone: "",
          service: odooApp.appointment_type_id && Array.isArray(odooApp.appointment_type_id) 
            ? odooApp.appointment_type_id[1] 
            : odooApp.name || "General Service",
          startTime: new Date(odooApp.start),
          endTime: new Date(odooApp.stop),
          duration: odooApp.duration ? odooApp.duration * 60 : 60, // Convert hours to minutes
          staffId: staff?.id,
          status: "confirmed",
          notes: odooApp.description || "",
          categoryColor: odooApp.categoryColor || null,
        };

        if (existingAppointment) {
          await storage.updateAppointment(existingAppointment.id, appointmentData);
          syncedCount.updated++;
        } else {
          await storage.createAppointment(appointmentData);
          syncedCount.created++;
        }
      }

      // Update last sync time
      await storage.updateCalendarSettings({
        lastOdooSync: new Date(),
      });

      res.json({
        success: true,
        synced: syncedCount,
        totalOdooAppointments: odooAppointments.length,
      });

    } catch (error) {
      console.error("Odoo sync failed:", error);
      res.status(500).json({ 
        error: "Failed to sync with Odoo",
        details: error instanceof Error ? error.message : "Unknown error"
      });
    } finally {
      isSyncing = false; // Release the sync lock
    }
  });

  // Appointment types route
  app.get("/api/appointment-types", async (req, res) => {
    try {
      const types = await odooService.fetchAppointmentTypes();
      res.json(types);
    } catch (error) {
      console.error("Failed to fetch appointment types:", error);
      res.status(500).json({ error: "Failed to fetch appointment types" });
    }
  });

  // Appointment categories route
  app.get("/api/appointment-categories", async (req, res) => {
    try {
      const categories = await odooService.fetchAppointmentCategories();
      res.json(categories);
    } catch (error) {
      console.error("Failed to fetch appointment categories:", error);
      res.status(500).json({ error: "Failed to fetch appointment categories" });
    }
  });

  // Partners route
  app.get("/api/partners", async (req, res) => {
    try {
      const { search } = req.query;
      const partners = await odooService.fetchPartners(search as string | undefined);
      res.json(partners);
    } catch (error) {
      console.error("Failed to fetch partners:", error);
      res.status(500).json({ error: "Failed to fetch partners" });
    }
  });

  // Book appointment route
  app.post("/api/appointments/book", async (req, res) => {
    try {
      const { 
        customerName, 
        customerEmail, 
        customerPhone, 
        appointmentTypeIds, 
        startTime,
        endTime,
        staffId,
        partnerId 
      } = req.body;

      if (!customerName || !appointmentTypeIds || !Array.isArray(appointmentTypeIds) || appointmentTypeIds.length === 0) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      if (!startTime || !endTime) {
        return res.status(400).json({ error: "Start time and end time are required" });
      }

      // Look up the staff member to get their Odoo resource ID
      const staffMember = await storage.getStaff(staffId);
      if (!staffMember) {
        return res.status(400).json({ error: "Staff member not found" });
      }

      // Fetch appointment types to get service names
      const appointmentTypes = await odooService.fetchAppointmentTypes();
      
      // Build combined service name from all selected types
      const selectedServices = appointmentTypeIds
        .map(typeId => {
          const type = appointmentTypes.find(t => t.id === typeId);
          return type ? type.name : null;
        })
        .filter(name => name !== null);

      const combinedServiceName = selectedServices.join(" + ");

      // Calculate total duration in minutes
      const start = new Date(startTime);
      const end = new Date(endTime);
      const durationMinutes = Math.round((end.getTime() - start.getTime()) / (1000 * 60));

      // Find or create partner in Odoo
      const odooPartnerId = await odooService.findOrCreatePartner({
        name: customerName,
        email: customerEmail,
        phone: customerPhone,
        partnerId: partnerId
      });

      // Create a SINGLE appointment in Odoo with the first appointment type
      // (Odoo requires an appointment_type_id, so we use the first one)
      const odooEvent = await odooService.createAppointment({
        customerName,
        customerEmail,
        customerPhone,
        appointmentTypeId: appointmentTypeIds[0], // Use first type for Odoo
        startTime: startTime,
        endTime: endTime,
        staffId: staffMember.odooUserId.toString(),
      });

      // Create sales order in Odoo for the customer
      try {
        const salesOrderId = await odooService.createSalesOrder({
          partnerId: odooPartnerId,
          appointmentTypeIds: appointmentTypeIds,
          calendarEventId: odooEvent.id
        });
        console.log(`[Booking] Created sales order ${salesOrderId} for appointment ${odooEvent.id}`);
      } catch (salesOrderError) {
        console.error("[Booking] Failed to create sales order:", salesOrderError);
        // Continue with appointment creation even if sales order fails
        console.warn("[Booking] Continuing with appointment creation despite sales order failure");
      }

      // Store a SINGLE appointment locally with combined service name
      const localAppointment = await storage.createAppointment({
        odooEventId: odooEvent.id,
        name: `${customerName} - ${combinedServiceName}`,
        customerName,
        customerEmail: customerEmail || null,
        customerPhone: customerPhone || null,
        service: combinedServiceName,
        startTime: start,
        endTime: end,
        duration: durationMinutes,
        staffId,
        status: "confirmed",
        price: null,
        notes: `Services: ${combinedServiceName}`,
      });

      res.json(localAppointment);
    } catch (error) {
      console.error("Failed to book appointment:", error);
      res.status(500).json({ error: "Failed to book appointment" });
    }
  });

  // Calendar settings routes
  app.get("/api/settings", async (req, res) => {
    try {
      const settings = await storage.getCalendarSettings();
      res.json(settings);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch calendar settings" });
    }
  });

  app.put("/api/settings", async (req, res) => {
    try {
      const updates = req.body;
      const settings = await storage.updateCalendarSettings(updates);
      res.json(settings);
    } catch (error) {
      res.status(500).json({ error: "Failed to update calendar settings" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
