# Overview

This project is a calendar and appointment management system that integrates bidirectionally with Odoo ERP. It provides a visual interface for scheduling, managing staff, and configuring calendar settings. The system aims to streamline appointment booking and staff management through a full-stack TypeScript application, featuring a React frontend and an Express backend, with real-time synchronization capabilities with Odoo via XML-RPC.

The application allows users to view and manage appointments in day, week, and month views, configure working hours and inactive days, manage staff, and automatically synchronize data. Key features include drag-and-drop rescheduling, real-time updates, and integration with Odoo's resource calendars and partner contacts for intelligent booking.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend Architecture

**Framework**: React with TypeScript, using Vite.
**UI Components**: `shadcn/ui` (Radix UI primitives) and Tailwind CSS for styling and theming.
**State Management**: TanStack Query (React Query) for server state management, caching, and optimistic updates. Local component state is managed with React hooks.
**Routing**: Wouter for lightweight client-side routing.
**Key Design Patterns**: Custom hooks for logic, query key-based cache invalidation, and component composition.

## Backend Architecture

**Framework**: Express.js with TypeScript on Node.js.
**Data Storage**:
- In-memory storage (`MemStorage`) for development/testing.
- PostgreSQL with Drizzle ORM (planned/configured for production) abstracted via an `IStorage` interface.
**API Design**: RESTful HTTP endpoints under `/api` for managing staff, appointments, settings, Odoo sync, partners, appointment types, and booking.
**Design Rationale**: Express for flexibility, in-memory storage for rapid development, and an interface for future database migration.

## Data Schema

**Database Schema**: (Drizzle ORM with PostgreSQL)
- **Users Table**: Authentication.
- **Staff Table**: Staff members, Odoo user ID mapping, calendar display colors, active status.
- **Appointments Table**: Customer appointments, Odoo event ID sync, staff assignment, status tracking.
- **Calendar Settings Table**: Global configuration for time intervals, inactive days, working hours, booking limits.
All tables use UUID primary keys and include timestamps. Odoo IDs are stored for bidirectional sync, and status fields use text enums.

## UI/UX Decisions
- Three distinct calendar view modes: Day, Week, and Month with navigation.
- Visual differentiation for staff availability based on Odoo resource calendars.
- Dynamic time slot generation to include all appointments.
- Partner selection integration for streamlined appointment booking with Odoo contacts.
- Clickable appointment cards to display detailed information in a sidebar.
- Reschedule dialog with date/time picker and staff selection.
- Cancel appointment confirmation dialog (AlertDialog) with destructive action styling and Odoo sync.
- Multi-service booking: selecting multiple services creates ONE combined appointment (not separate appointments).
- Click-to-create appointments: works in all view modes (Day, Week, Month) by clicking empty slots/cells.

## Technical Implementations
- Client-side filtering of services based on Odoo resource constraints to prevent booking errors.
- Sync lock mechanism to prevent concurrent Odoo synchronization issues.
- Proper date formatting for Odoo XML-RPC calls to avoid data type errors (YYYY-MM-DD HH:MM:SS format).
- DELETE endpoint with bidirectional Odoo sync using "unlink" method for appointment cancellation.
- Graceful fallback: continues with local operations if Odoo sync fails (with logged warnings).

# External Dependencies

### Third-Party Services

**Odoo ERP Integration**:
- **Protocol**: XML-RPC over HTTP/HTTPS.
- **Authentication**: Username + API key.
- **Purpose**: Bidirectional synchronization of appointments, staff, and calendar events.
- **Configuration**: Environment variables (ODOO_URL, ODOO_DB, ODOO_USERNAME, ODOO_API_KEY).
- **Integration Strategy**: Pull-based sync from Odoo, push-based updates to Odoo, conflict resolution using timestamps, and Odoo ID tracking for data relationships.

### Database

**PostgreSQL**:
- **Provider**: Neon (serverless PostgreSQL).
- **Driver**: `@neondatabase/serverless`.
- **ORM**: Drizzle ORM.
- **Connection**: `DATABASE_URL` environment variable.
- **Migration**: Drizzle Kit.

### UI Component Libraries

- **Radix UI**: Unstyled, accessible component primitives.
- **date-fns**: Date manipulation and formatting.
- **react-day-picker**: Calendar date picker.
- **cmdk**: Command palette component.
- **vaul**: Drawer/sheet component.
- **embla-carousel-react**: Carousel functionality.

### Development Tools (Replit-specific)

- `@replit/vite-plugin-runtime-error-modal`
- `@replit/vite-plugin-cartographer`
- `@replit/vite-plugin-dev-banner`

### Build Tools

- **Vite**: Frontend bundling.
- **esbuild**: Backend bundling.
- **TypeScript**: Type checking.
- **Tailwind CSS + PostCSS**: Styling pipeline.

### Session Management

- **connect-pg-simple**: PostgreSQL-backed session store for Express sessions (for future authentication).