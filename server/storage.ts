import { type Staff, type InsertStaff, type Appointment, type InsertAppointment, type CalendarSettings, type InsertCalendarSettings, type User, type InsertUser } from "@shared/schema";
import { randomUUID } from "crypto";

export interface IStorage {
  // User methods
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

  // Staff methods
  getAllStaff(): Promise<Staff[]>;
  getStaff(id: string): Promise<Staff | undefined>;
  getStaffByOdooUserId(odooUserId: number): Promise<Staff | undefined>;
  createStaff(staff: InsertStaff): Promise<Staff>;
  updateStaff(id: string, staff: Partial<Staff>): Promise<Staff | undefined>;
  deleteStaff(id: string): Promise<boolean>;

  // Appointment methods
  getAllAppointments(): Promise<Appointment[]>;
  getAppointmentsByDateRange(startDate: Date, endDate: Date): Promise<Appointment[]>;
  getAppointment(id: string): Promise<Appointment | undefined>;
  getAppointmentByOdooEventId(odooEventId: number): Promise<Appointment | undefined>;
  createAppointment(appointment: InsertAppointment): Promise<Appointment>;
  updateAppointment(id: string, appointment: Partial<Appointment>): Promise<Appointment | undefined>;
  deleteAppointment(id: string): Promise<boolean>;

  // Calendar settings methods
  getCalendarSettings(): Promise<CalendarSettings | undefined>;
  updateCalendarSettings(settings: Partial<CalendarSettings>): Promise<CalendarSettings>;
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private staff: Map<string, Staff>;
  private appointments: Map<string, Appointment>;
  private calendarSettings: CalendarSettings | undefined;

  constructor() {
    this.users = new Map();
    this.staff = new Map();
    this.appointments = new Map();
    
    // Initialize default settings
    this.calendarSettings = {
      id: randomUUID(),
      timeInterval: 15,
      inactiveDays: "0", // Sunday
      bookingMonthsAhead: 5,
      workingHoursStart: "09:00",
      workingHoursEnd: "17:00",
      lastOdooSync: null,
      updatedAt: new Date(),
    };

    // Initialize some sample staff members
    this.initializeSampleData();
  }

  private initializeSampleData() {
    const sampleStaff = [
      {
        id: randomUUID(),
        odooUserId: 1,
        name: "Sarah Klein",
        email: "sarah@salon.com",
        role: "Senior Stylist",
        color: "#8b5cf6",
        isActive: true,
        createdAt: new Date(),
      },
      {
        id: randomUUID(),
        odooUserId: 2,
        name: "Mike Barnes",
        email: "mike@salon.com",
        role: "Hair Specialist",
        color: "#14b8a6",
        isActive: true,
        createdAt: new Date(),
      },
      {
        id: randomUUID(),
        odooUserId: 3,
        name: "Lisa Thompson",
        email: "lisa@salon.com",
        role: "Color Expert",
        color: "#f59e0b",
        isActive: true,
        createdAt: new Date(),
      },
      {
        id: randomUUID(),
        odooUserId: 4,
        name: "Jenny White",
        email: "jenny@salon.com",
        role: "Junior Stylist",
        color: "#ec4899",
        isActive: true,
        createdAt: new Date(),
      },
    ];

    sampleStaff.forEach(staff => {
      this.staff.set(staff.id, staff);
    });

    // Add sample appointments for today to demonstrate calendar features
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const staffArray = Array.from(this.staff.values());
    
    const sampleAppointments = [
      // Sarah's appointments
      {
        id: randomUUID(),
        odooEventId: 1001,
        name: "Haircut Appointment",
        customerName: "Emma Johnson",
        customerEmail: "emma@example.com",
        customerPhone: "+1 555-0101",
        service: "Haircut & Styling",
        startTime: new Date(today.getTime() + 10 * 60 * 60 * 1000), // 10:00 AM
        endTime: new Date(today.getTime() + 11 * 60 * 60 * 1000), // 11:00 AM
        duration: 60,
        staffId: staffArray[0]?.id,
        status: "confirmed",
        price: "$45",
        notes: "Regular customer, prefers short layers",
        lastSynced: new Date(),
      },
      {
        id: randomUUID(),
        odooEventId: 1002,
        name: "Color Treatment",
        customerName: "Olivia Brown",
        customerEmail: "olivia@example.com",
        customerPhone: "+1 555-0102",
        service: "Hair Coloring",
        startTime: new Date(today.getTime() + 14 * 60 * 60 * 1000), // 2:00 PM
        endTime: new Date(today.getTime() + 16 * 60 * 60 * 1000), // 4:00 PM
        duration: 120,
        staffId: staffArray[0]?.id,
        status: "confirmed",
        price: "$120",
        notes: "Full color treatment with highlights",
        lastSynced: new Date(),
      },
      // Mike's appointments
      {
        id: randomUUID(),
        odooEventId: 1003,
        name: "Trim & Style",
        customerName: "James Wilson",
        customerEmail: "james@example.com",
        customerPhone: "+1 555-0103",
        service: "Haircut",
        startTime: new Date(today.getTime() + 9 * 60 * 60 * 1000), // 9:00 AM
        endTime: new Date(today.getTime() + 9.5 * 60 * 60 * 1000), // 9:30 AM
        duration: 30,
        staffId: staffArray[1]?.id,
        status: "confirmed",
        price: "$35",
        notes: null,
        lastSynced: new Date(),
      },
      {
        id: randomUUID(),
        odooEventId: 1004,
        name: "Hair Treatment",
        customerName: "Sophia Martinez",
        customerEmail: "sophia@example.com",
        customerPhone: "+1 555-0104",
        service: "Treatment",
        startTime: new Date(today.getTime() + 11 * 60 * 60 * 1000), // 11:00 AM
        endTime: new Date(today.getTime() + 12 * 60 * 60 * 1000), // 12:00 PM
        duration: 60,
        staffId: staffArray[1]?.id,
        status: "confirmed",
        price: "$65",
        notes: "Deep conditioning treatment",
        lastSynced: new Date(),
      },
      // Lisa's appointments
      {
        id: randomUUID(),
        odooEventId: 1005,
        name: "Color Consultation",
        customerName: "Ava Davis",
        customerEmail: "ava@example.com",
        customerPhone: "+1 555-0105",
        service: "Consultation",
        startTime: new Date(today.getTime() + 10 * 60 * 60 * 1000), // 10:00 AM
        endTime: new Date(today.getTime() + 10.5 * 60 * 60 * 1000), // 10:30 AM
        duration: 30,
        staffId: staffArray[2]?.id,
        status: "confirmed",
        price: "$20",
        notes: "First-time customer consultation",
        lastSynced: new Date(),
      },
      {
        id: randomUUID(),
        odooEventId: 1006,
        name: "Full Color Service",
        customerName: "Isabella Garcia",
        customerEmail: "isabella@example.com",
        customerPhone: "+1 555-0106",
        service: "Hair Coloring",
        startTime: new Date(today.getTime() + 13 * 60 * 60 * 1000), // 1:00 PM
        endTime: new Date(today.getTime() + 15.5 * 60 * 60 * 1000), // 3:30 PM
        duration: 150,
        staffId: staffArray[2]?.id,
        status: "confirmed",
        price: "$150",
        notes: "Balayage with toner",
        lastSynced: new Date(),
      },
      // Jenny's appointments
      {
        id: randomUUID(),
        odooEventId: 1007,
        name: "Quick Trim",
        customerName: "Mia Rodriguez",
        customerEmail: "mia@example.com",
        customerPhone: "+1 555-0107",
        service: "Haircut",
        startTime: new Date(today.getTime() + 9.5 * 60 * 60 * 1000), // 9:30 AM
        endTime: new Date(today.getTime() + 10.25 * 60 * 60 * 1000), // 10:15 AM
        duration: 45,
        staffId: staffArray[3]?.id,
        status: "confirmed",
        price: "$30",
        notes: null,
        lastSynced: new Date(),
      },
      {
        id: randomUUID(),
        odooEventId: 1008,
        name: "Style & Blowdry",
        customerName: "Charlotte Lee",
        customerEmail: "charlotte@example.com",
        customerPhone: "+1 555-0108",
        service: "Haircut & Styling",
        startTime: new Date(today.getTime() + 15 * 60 * 60 * 1000), // 3:00 PM
        endTime: new Date(today.getTime() + 16 * 60 * 60 * 1000), // 4:00 PM
        duration: 60,
        staffId: staffArray[3]?.id,
        status: "confirmed",
        price: "$50",
        notes: "Special occasion styling",
        lastSynced: new Date(),
      },
    ];

    sampleAppointments.forEach(apt => {
      this.appointments.set(apt.id, apt);
    });
  }

  // User methods
  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }

  // Staff methods
  async getAllStaff(): Promise<Staff[]> {
    return Array.from(this.staff.values()).filter(s => s.isActive);
  }

  async getStaff(id: string): Promise<Staff | undefined> {
    return this.staff.get(id);
  }

  async getStaffByOdooUserId(odooUserId: number): Promise<Staff | undefined> {
    return Array.from(this.staff.values()).find(s => s.odooUserId === odooUserId);
  }

  async createStaff(insertStaff: InsertStaff): Promise<Staff> {
    const id = randomUUID();
    const staff: Staff = { 
      ...insertStaff,
      role: insertStaff.role ?? null,
      email: insertStaff.email ?? null,
      color: insertStaff.color ?? "#6366f1",
      isActive: insertStaff.isActive ?? true,
      id,
      createdAt: new Date()
    };
    this.staff.set(id, staff);
    return staff;
  }

  async updateStaff(id: string, updateData: Partial<Staff>): Promise<Staff | undefined> {
    const staff = this.staff.get(id);
    if (!staff) return undefined;

    const updatedStaff = { ...staff, ...updateData };
    this.staff.set(id, updatedStaff);
    return updatedStaff;
  }

  async deleteStaff(id: string): Promise<boolean> {
    return this.staff.delete(id);
  }

  // Appointment methods
  async getAllAppointments(): Promise<Appointment[]> {
    return Array.from(this.appointments.values());
  }

  async getAppointmentsByDateRange(startDate: Date, endDate: Date): Promise<Appointment[]> {
    return Array.from(this.appointments.values()).filter(
      appointment => 
        appointment.startTime >= startDate && 
        appointment.endTime <= endDate
    );
  }

  async getAppointment(id: string): Promise<Appointment | undefined> {
    return this.appointments.get(id);
  }

  async getAppointmentByOdooEventId(odooEventId: number): Promise<Appointment | undefined> {
    return Array.from(this.appointments.values()).find(a => a.odooEventId === odooEventId);
  }

  async createAppointment(insertAppointment: InsertAppointment): Promise<Appointment> {
    const id = randomUUID();
    const appointment: Appointment = { 
      ...insertAppointment,
      customerEmail: insertAppointment.customerEmail ?? null,
      customerPhone: insertAppointment.customerPhone ?? null,
      staffId: insertAppointment.staffId ?? null,
      price: insertAppointment.price ?? null,
      notes: insertAppointment.notes ?? null,
      status: insertAppointment.status ?? "confirmed",
      id,
      lastSynced: new Date()
    };
    this.appointments.set(id, appointment);
    return appointment;
  }

  async updateAppointment(id: string, updateData: Partial<Appointment>): Promise<Appointment | undefined> {
    const appointment = this.appointments.get(id);
    if (!appointment) return undefined;

    const updatedAppointment = { 
      ...appointment, 
      ...updateData,
      lastSynced: new Date()
    };
    this.appointments.set(id, updatedAppointment);
    return updatedAppointment;
  }

  async deleteAppointment(id: string): Promise<boolean> {
    return this.appointments.delete(id);
  }

  // Calendar settings methods
  async getCalendarSettings(): Promise<CalendarSettings | undefined> {
    return this.calendarSettings;
  }

  async updateCalendarSettings(updateData: Partial<CalendarSettings>): Promise<CalendarSettings> {
    this.calendarSettings = {
      ...this.calendarSettings!,
      ...updateData,
      updatedAt: new Date()
    };
    return this.calendarSettings;
  }
}

export const storage = new MemStorage();
