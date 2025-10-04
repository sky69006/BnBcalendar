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
      const deleted = await storage.deleteAppointment(id);
      
      if (!deleted) {
        return res.status(404).json({ error: "Appointment not found" });
      }
      
      res.json({ success: true });
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
  app.post("/api/sync/odoo", async (req, res) => {
    try {
      const { start, end } = req.body;
      const startDate = start ? new Date(start).toISOString() : new Date().toISOString();
      const endDate = end ? new Date(end).toISOString() : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

      // Fetch appointments from Odoo
      const odooAppointments = await odooService.fetchAppointments(startDate, endDate);
      
      // Sync staff members
      const odooUsers = await odooService.fetchUsers();
      for (const user of odooUsers) {
        const existingStaff = await storage.getStaffByOdooUserId(user.id);
        if (!existingStaff) {
          await storage.createStaff({
            odooUserId: user.id,
            name: user.name,
            email: user.email,
            role: "Staff Member",
            color: `#${Math.floor(Math.random()*16777215).toString(16)}`,
            isActive: true,
          });
        }
      }

      // Sync appointments
      const syncedCount = { created: 0, updated: 0 };
      
      for (const odooApp of odooAppointments) {
        const existingAppointment = await storage.getAppointmentByOdooEventId(odooApp.id);
        
        const staff = await storage.getStaffByOdooUserId(
          Array.isArray(odooApp.user_id) ? odooApp.user_id[0] : 1
        );

        const appointmentData = {
          odooEventId: odooApp.id,
          name: odooApp.name || "Untitled Appointment",
          customerName: Array.isArray(odooApp.partner_id) ? odooApp.partner_id[1] : "Unknown Customer",
          customerEmail: "",
          customerPhone: "",
          service: odooApp.name || "General Service",
          startTime: new Date(odooApp.start),
          endTime: new Date(odooApp.stop),
          duration: odooApp.duration || 60,
          staffId: staff?.id,
          status: "confirmed",
          notes: odooApp.description || "",
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
