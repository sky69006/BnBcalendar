import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, integer, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const staff = pgTable("staff", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  odooUserId: integer("odoo_user_id").notNull().unique(),
  name: text("name").notNull(),
  email: text("email"),
  role: text("role"),
  color: text("color").notNull().default("#6366f1"),
  isActive: boolean("is_active").notNull().default(true),
  resourceCalendarId: integer("resource_calendar_id"),
  workingHours: text("working_hours"), // JSON string of working hours schedule
  createdAt: timestamp("created_at").defaultNow(),
});

export const appointments = pgTable("appointments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  odooEventId: integer("odoo_event_id").notNull().unique(),
  name: text("name").notNull(),
  customerName: text("customer_name").notNull(),
  customerEmail: text("customer_email"),
  customerPhone: text("customer_phone"),
  service: text("service").notNull(),
  startTime: timestamp("start_time").notNull(),
  endTime: timestamp("end_time").notNull(),
  duration: integer("duration").notNull(), // in minutes
  staffId: varchar("staff_id").references(() => staff.id),
  status: text("status").notNull().default("confirmed"), // confirmed, cancelled, completed
  price: text("price"),
  notes: text("notes"),
  lastSynced: timestamp("last_synced").defaultNow(),
});

export const calendarSettings = pgTable("calendar_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  timeInterval: integer("time_interval").notNull().default(15), // 10, 15, 30 minutes
  inactiveDays: text("inactive_days").notNull().default("0"), // comma-separated day numbers (0=Sunday)
  bookingMonthsAhead: integer("booking_months_ahead").notNull().default(5),
  workingHoursStart: text("working_hours_start").notNull().default("09:00"),
  workingHoursEnd: text("working_hours_end").notNull().default("17:00"),
  lastOdooSync: timestamp("last_odoo_sync"),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertStaffSchema = createInsertSchema(staff).omit({
  id: true,
  createdAt: true,
});

export const insertAppointmentSchema = createInsertSchema(appointments).omit({
  id: true,
  lastSynced: true,
});

export const insertCalendarSettingsSchema = createInsertSchema(calendarSettings).omit({
  id: true,
  lastOdooSync: true,
  updatedAt: true,
});

export type InsertStaff = z.infer<typeof insertStaffSchema>;
export type Staff = typeof staff.$inferSelect;

export type InsertAppointment = z.infer<typeof insertAppointmentSchema>;
export type Appointment = typeof appointments.$inferSelect;

export type InsertCalendarSettings = z.infer<typeof insertCalendarSettingsSchema>;
export type CalendarSettings = typeof calendarSettings.$inferSelect;

export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});
