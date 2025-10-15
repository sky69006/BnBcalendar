import xmlrpc from "xmlrpc";

interface OdooConfig {
  url: string;
  db: string;
  username: string;
  apiKey: string;
}

interface OdooAppointment {
  id: number;
  name: string;
  start: string;
  stop: string;
  partner_id: [number, string] | false;
  partner_ids: number[];
  user_id: [number, string] | false;
  appointment_resource_id: [number, string] | false;
  resource_ids: number[];
  appointment_type_id: [number, string] | false;
  duration: number;
  description?: string;
  location?: string;
}

interface OdooResource {
  id: number;
  name: string;
  employee_id: [number, string] | false;
  resource_calendar_id: [number, string] | false;
}

interface OdooUser {
  id: number;
  name: string;
  email: string;
}

export class OdooService {
  private config: OdooConfig;
  private uid: number | null = null;
  private commonClient: any;
  private objectClient: any;

  constructor() {
    this.config = {
      url: process.env.ODOO_URL || "https://demo.odoo.com",
      db: process.env.ODOO_DB || "demo",
      username: process.env.ODOO_USERNAME || "admin",
      apiKey: process.env.ODOO_API_KEY || process.env.ODOO_PASSWORD || "admin",
    };

    const url = new URL(this.config.url);
    const isSecure = url.protocol === 'https:';
    const port = url.port ? parseInt(url.port) : (isSecure ? 443 : 80);

    const clientOptions = {
      host: url.hostname,
      port,
      path: "/xmlrpc/2/common",
    };

    this.commonClient = isSecure 
      ? xmlrpc.createSecureClient(clientOptions)
      : xmlrpc.createClient(clientOptions);

    this.objectClient = isSecure
      ? xmlrpc.createSecureClient({ ...clientOptions, path: "/xmlrpc/2/object" })
      : xmlrpc.createClient({ ...clientOptions, path: "/xmlrpc/2/object" });
  }

  async authenticate(): Promise<number> {
    if (this.uid) return this.uid;

    return new Promise((resolve, reject) => {
      this.commonClient.methodCall(
        "authenticate",
        [this.config.db, this.config.username, this.config.apiKey, {}],
        (error: any, uid: number) => {
          if (error) {
            reject(new Error(`Odoo authentication failed: ${error.message}`));
            return;
          }
          if (!uid) {
            reject(new Error("Invalid Odoo credentials"));
            return;
          }
          this.uid = uid;
          resolve(uid);
        }
      );
    });
  }

  async getVersion(): Promise<any> {
    return new Promise((resolve, reject) => {
      this.commonClient.methodCall("version", [], (error: any, result: any) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(result);
      });
    });
  }

  async executeKw(
    model: string,
    method: string,
    args: any[] = [],
    kwargs: any = {}
  ): Promise<any> {
    await this.authenticate();

    return new Promise((resolve, reject) => {
      this.objectClient.methodCall(
        "execute_kw",
        [this.config.db, this.uid, this.config.apiKey, model, method, args, kwargs],
        (error: any, result: any) => {
          if (error) {
            reject(new Error(`Odoo API call failed: ${error.message}`));
            return;
          }
          resolve(result);
        }
      );
    });
  }

  async fetchAppointments(startDate: string, endDate: string): Promise<OdooAppointment[]> {
    try {
      const appointments = await this.executeKw(
        "calendar.event",
        "search_read",
        [[
          ["start", ">=", startDate],
          ["stop", "<=", endDate]
        ]],
        {
          fields: [
            "id", "name", "start", "stop", 
            "partner_id", "partner_ids", "user_id", 
            "appointment_resource_id", "resource_ids", "appointment_type_id",
            "duration", "description", "location"
          ],
          order: "start ASC"
        }
      );
      
      return appointments;
    } catch (error) {
      console.error("Failed to fetch appointments from Odoo:", error);
      throw error;
    }
  }

  async fetchResources(): Promise<OdooResource[]> {
    try {
      const resources = await this.executeKw(
        "appointment.resource",
        "search_read",
        [[]],
        {
          fields: ["id", "name", "employee_id", "resource_calendar_id"],
          order: "name ASC"
        }
      );
      
      return resources;
    } catch (error) {
      console.error("Failed to fetch resources from Odoo:", error);
      throw error;
    }
  }

  async fetchResourceCalendar(calendarId: number): Promise<any> {
    try {
      const calendar = await this.executeKw(
        "resource.calendar",
        "read",
        [[calendarId]],
        {
          fields: ["id", "name", "attendance_ids", "global_leave_ids"]
        }
      );
      
      if (calendar && calendar.length > 0) {
        // Fetch attendance records (working hours)
        const attendanceIds = calendar[0].attendance_ids || [];
        if (attendanceIds.length > 0) {
          const attendances = await this.executeKw(
            "resource.calendar.attendance",
            "read",
            [attendanceIds],
            {
              fields: ["dayofweek", "hour_from", "hour_to", "day_period", "name"]
            }
          );
          calendar[0].attendances = attendances;
        }
        
        return calendar[0];
      }
      
      return null;
    } catch (error) {
      console.error("Failed to fetch resource calendar from Odoo:", error);
      throw error;
    }
  }

  async updateAppointment(appointmentId: number, data: Partial<OdooAppointment>): Promise<boolean> {
    try {
      const result = await this.executeKw(
        "calendar.event",
        "write",
        [[appointmentId], data]
      );
      
      return result;
    } catch (error) {
      console.error("Failed to update appointment in Odoo:", error);
      throw error;
    }
  }

  async deleteAppointment(appointmentId: number): Promise<boolean> {
    try {
      const result = await this.executeKw(
        "calendar.event",
        "unlink",
        [[appointmentId]]
      );
      
      return result;
    } catch (error) {
      console.error("Failed to delete appointment in Odoo:", error);
      throw error;
    }
  }

  async fetchUsers(): Promise<OdooUser[]> {
    try {
      const users = await this.executeKw(
        "res.users",
        "search_read",
        [[["active", "=", true]]],
        {
          fields: ["id", "name", "email"],
          order: "name ASC"
        }
      );
      
      return users;
    } catch (error) {
      console.error("Failed to fetch users from Odoo:", error);
      throw error;
    }
  }

  async fetchAppointmentTypes(): Promise<any[]> {
    try {
      const types = await this.executeKw(
        "appointment.type",
        "search_read",
        [[["is_published", "=", true]]],
        {
          fields: ["id", "name", "appointment_duration", "is_published", "category", "resource_ids"],
          order: "name ASC"
        }
      );
      
      return types;
    } catch (error) {
      console.error("Failed to fetch appointment types from Odoo:", error);
      throw error;
    }
  }

  async createAppointment(data: {
    customerName: string;
    customerEmail?: string;
    customerPhone?: string;
    appointmentTypeId: number;
    startTime: string;
    endTime: string;
    staffId: string;
  }): Promise<any> {
    try {
      // Format dates for Odoo (YYYY-MM-DD HH:MM:SS) using UTC
      const formatOdooDate = (isoString: string) => {
        const date = new Date(isoString);
        const year = date.getUTCFullYear();
        const month = String(date.getUTCMonth() + 1).padStart(2, '0');
        const day = String(date.getUTCDate()).padStart(2, '0');
        const hours = String(date.getUTCHours()).padStart(2, '0');
        const minutes = String(date.getUTCMinutes()).padStart(2, '0');
        const seconds = String(date.getUTCSeconds()).padStart(2, '0');
        return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
      };

      // Build event name with customer details
      let eventName = data.customerName;
      if (data.customerEmail || data.customerPhone) {
        const details = [];
        if (data.customerEmail) details.push(data.customerEmail);
        if (data.customerPhone) details.push(data.customerPhone);
        eventName = `${data.customerName} (${details.join(', ')})`;
      }

      const eventData: any = {
        name: eventName,
        start: formatOdooDate(data.startTime),
        stop: formatOdooDate(data.endTime),
        appointment_type_id: data.appointmentTypeId,
        appointment_resource_id: parseInt(data.staffId),
      };

      const eventId = await this.executeKw(
        "calendar.event",
        "create",
        [eventData]
      );

      // Return a minimal object with the created event details
      return {
        id: eventId,
        name: eventName,
        start: eventData.start,
        stop: eventData.stop,
        appointment_type_id: eventData.appointment_type_id,
        appointment_resource_id: eventData.appointment_resource_id,
      };
    } catch (error) {
      console.error("Failed to create appointment in Odoo:", error);
      throw error;
    }
  }
}

export const odooService = new OdooService();
