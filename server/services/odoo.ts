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
  appointment_category_id?: [number, string] | false;
  categoryColor?: string | null;
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

  // Format date for Odoo (expects 'YYYY-MM-DD HH:MM:SS')
  private formatDateForOdoo(date: Date | string): string {
    const d = typeof date === 'string' ? new Date(date) : date;
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const seconds = String(d.getSeconds()).padStart(2, '0');
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
  }

  constructor() {
    this.config = {
      url: process.env.ODOO_URL || "https://demo.odoo.com",
      db: process.env.ODOO_DB || "demo",
      username: process.env.ODOO_USERNAME || "admin",
      apiKey: process.env.ODOO_API_KEY || process.env.ODOO_PASSWORD || "admin",
    };

    console.log(`[Odoo] Connecting to: ${this.config.url}`);
    console.log(`[Odoo] Database: ${this.config.db}`);
    console.log(`[Odoo] Username: ${this.config.username}`);

    const url = new URL(this.config.url);
    const isSecure = url.protocol === 'https:';
    const port = url.port ? parseInt(url.port) : (isSecure ? 443 : 80);

    const clientOptions = {
      host: url.hostname,
      port,
      path: "/xmlrpc/2/common",
    };

    console.log(`[Odoo] XML-RPC endpoint: ${isSecure ? 'https' : 'http'}://${url.hostname}:${port}/xmlrpc/2/common`);

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
      console.log('[Odoo] Attempting authentication...');
      this.commonClient.methodCall(
        "authenticate",
        [this.config.db, this.config.username, this.config.apiKey, {}],
        (error: any, uid: number) => {
          if (error) {
            console.error('[Odoo] Authentication error:', error.message);
            console.error('[Odoo] This might be due to:');
            console.error('[Odoo]   - Incorrect API key or password');
            console.error('[Odoo]   - Incorrect database name');
            console.error('[Odoo]   - Odoo instance blocking XML-RPC requests');
            reject(new Error(`Odoo authentication failed: ${error.message}`));
            return;
          }
          if (!uid) {
            console.error('[Odoo] Authentication returned no UID - invalid credentials');
            reject(new Error("Invalid Odoo credentials"));
            return;
          }
          console.log(`[Odoo] Successfully authenticated with UID: ${uid}`);
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
            "duration", "description", "location", "appointment_category_id"
          ],
          order: "start ASC"
        }
      );
      
      // Fetch category colors for appointments that have a category
      const categoryIds = appointments
        .filter((apt: any) => apt.appointment_category_id && apt.appointment_category_id[0])
        .map((apt: any) => apt.appointment_category_id[0]);
      
      const uniqueCategoryIds = Array.from(new Set(categoryIds));
      
      let categoryColors: { [key: number]: string } = {};
      
      if (uniqueCategoryIds.length > 0) {
        const categories = await this.executeKw(
          "appointment.category",
          "read",
          [uniqueCategoryIds],
          {
            fields: ["id", "color"]
          }
        );
        
        categoryColors = categories.reduce((acc: any, cat: any) => {
          acc[cat.id] = cat.color;
          return acc;
        }, {});
      }
      
      // Add category color to each appointment
      const appointmentsWithColors = appointments.map((apt: any) => ({
        ...apt,
        categoryColor: apt.appointment_category_id && apt.appointment_category_id[0] 
          ? categoryColors[apt.appointment_category_id[0]] || null
          : null
      }));
      
      return appointmentsWithColors;
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
      // Format dates for Odoo if present
      const formattedData = { ...data };
      if (formattedData.start) {
        formattedData.start = this.formatDateForOdoo(formattedData.start);
      }
      if (formattedData.stop) {
        formattedData.stop = this.formatDateForOdoo(formattedData.stop);
      }

      const result = await this.executeKw(
        "calendar.event",
        "write",
        [[appointmentId], formattedData]
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
          fields: ["id", "name", "appointment_duration", "is_published", "category", "resource_ids", "product_id"],
          order: "name ASC"
        }
      );
      
      return types;
    } catch (error) {
      console.error("Failed to fetch appointment types from Odoo:", error);
      throw error;
    }
  }

  async fetchAppointmentCategories(): Promise<any[]> {
    try {
      const categories = await this.executeKw(
        "appointment.category",
        "search_read",
        [[]],
        {
          fields: ["id", "name", "color"],
          order: "name ASC"
        }
      );
      
      return categories;
    } catch (error) {
      console.error("Failed to fetch appointment categories from Odoo:", error);
      throw error;
    }
  }

  async fetchPartners(searchTerm?: string): Promise<any[]> {
    try {
      const domain: any[] = [["active", "=", true], ["is_company", "=", false]];
      
      // Add search filter if provided
      if (searchTerm && searchTerm.trim()) {
        domain.push("|", "|", 
          ["name", "ilike", searchTerm],
          ["email", "ilike", searchTerm],
          ["phone", "ilike", searchTerm]
        );
      }
      
      const partners = await this.executeKw(
        "res.partner",
        "search_read",
        [domain],
        {
          fields: ["id", "name", "email", "phone", "mobile"],
          order: "name ASC",
          limit: 100
        }
      );
      
      return partners;
    } catch (error) {
      console.error("Failed to fetch partners from Odoo:", error);
      throw error;
    }
  }

  async findOrCreatePartner(data: {
    name: string;
    email?: string;
    phone?: string;
    partnerId?: number;
  }): Promise<number> {
    try {
      // If partner ID is provided, verify it exists
      if (data.partnerId) {
        const existingPartner = await this.executeKw(
          "res.partner",
          "search_read",
          [[["id", "=", data.partnerId]]],
          { fields: ["id"], limit: 1 }
        );
        if (existingPartner && existingPartner.length > 0) {
          console.log(`[Odoo] Using existing partner ID: ${data.partnerId}`);
          return data.partnerId;
        }
      }

      // Try to find existing partner by email or phone
      const searchDomain: any[] = [];
      if (data.email) {
        searchDomain.push(["email", "=", data.email]);
      }
      if (data.phone && searchDomain.length > 0) {
        searchDomain.unshift("|");
        searchDomain.push(["phone", "=", data.phone]);
      } else if (data.phone) {
        searchDomain.push(["phone", "=", data.phone]);
      }

      if (searchDomain.length > 0) {
        const existingPartners = await this.executeKw(
          "res.partner",
          "search_read",
          [searchDomain],
          { fields: ["id"], limit: 1 }
        );

        if (existingPartners && existingPartners.length > 0) {
          console.log(`[Odoo] Found existing partner: ${existingPartners[0].id}`);
          return existingPartners[0].id;
        }
      }

      // Create new partner if not found
      const partnerData: any = {
        name: data.name,
        is_company: false,
      };
      if (data.email) partnerData.email = data.email;
      if (data.phone) partnerData.phone = data.phone;

      const partnerId = await this.executeKw(
        "res.partner",
        "create",
        [partnerData]
      );

      console.log(`[Odoo] Created new partner with ID: ${partnerId}`);
      return partnerId;
    } catch (error) {
      console.error("Failed to find or create partner in Odoo:", error);
      throw error;
    }
  }

  async createSalesOrder(data: {
    partnerId: number;
    appointmentTypeIds: number[];
    calendarEventId?: number;
  }): Promise<number> {
    try {
      console.log(`[Odoo] Creating sales order for partner ${data.partnerId}`);
      
      // Fetch appointment types with product information
      const appointmentTypes = await this.executeKw(
        "appointment.type",
        "search_read",
        [[["id", "in", data.appointmentTypeIds]]],
        { fields: ["id", "name", "product_id"] }
      );

      // Create sales order
      const orderData: any = {
        partner_id: data.partnerId,
        date_order: this.formatDateForOdoo(new Date()),
      };

      // Note: calendar_event_id is not a standard field on sale.order
      // The link between calendar events and sales orders is typically managed
      // through other means in Odoo (e.g., origin field or custom modules)

      const orderId = await this.executeKw(
        "sale.order",
        "create",
        [orderData]
      );

      console.log(`[Odoo] Created sales order with ID: ${orderId}`);

      // Create order lines for each appointment type/product
      for (const type of appointmentTypes) {
        if (type.product_id && Array.isArray(type.product_id) && type.product_id[0]) {
          const productId = type.product_id[0];
          
          // Fetch product details to get price
          const product = await this.executeKw(
            "product.product",
            "read",
            [[productId]],
            { fields: ["list_price", "name"] }
          );

          if (product && product.length > 0) {
            const orderLineData = {
              order_id: orderId,
              product_id: productId,
              product_uom_qty: 1.0,
              price_unit: product[0].list_price || 0,
            };

            await this.executeKw(
              "sale.order.line",
              "create",
              [orderLineData]
            );

            console.log(`[Odoo] Created order line for product: ${product[0].name}`);
          }
        } else {
          console.warn(`[Odoo] Appointment type ${type.name} has no associated product`);
        }
      }

      console.log(`[Odoo] Sales order ${orderId} created successfully with order lines`);
      return orderId;
    } catch (error) {
      console.error("Failed to create sales order in Odoo:", error);
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
