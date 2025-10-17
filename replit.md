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
  - Searchable partner dropdown with real-time search from Odoo res.partner model
  - Auto-fills customer name, email, and phone when existing partner is selected
- Clickable appointment cards to display detailed information in a sidebar.
- Reschedule dialog with date/time picker and staff selection.
- Cancel appointment confirmation dialog (AlertDialog) with destructive action styling and Odoo sync.
- Multi-service booking: selecting multiple services creates ONE combined appointment (not separate appointments).
- Click-to-create appointments: works in all view modes (Day, Week, Month) by clicking empty slots/cells.
- Sales order creation: When appointments are booked, sales orders are automatically created in Odoo with order lines for each selected service.
- Category-based color coding: Appointments display in their Odoo appointment category color across all calendar views (day, week, month).
- **Staff/Resource Filtering**: 
  - Resources legend panel on left side with multi-select checkboxes for each staff member
  - "All" button to show all resources (empty selection = show all)
  - Individual checkboxes to filter specific staff members
  - Week view displays staff columns per day (Day | Staff1 | Staff2 | ... for each day)
  - Day view shows staff columns horizontally
  - Filtering persists across view mode changes
- **Collapsible Appointment Details Panel**:
  - Panel can be collapsed to narrow strip (48px) with expand/collapse buttons
  - Smooth 300ms transition animation
  - Calendar automatically expands to use available space when panel is collapsed

## Technical Implementations
- Client-side filtering of services based on Odoo resource constraints to prevent booking errors.
- Sync lock mechanism to prevent concurrent Odoo synchronization issues.
- Proper date formatting for Odoo XML-RPC calls to avoid data type errors (YYYY-MM-DD HH:MM:SS format).
- DELETE endpoint with bidirectional Odoo sync using "unlink" method for appointment cancellation.
- Graceful fallback: continues with local operations if Odoo sync fails (with logged warnings).
- **Sales Order Creation**: Automated sales order generation in Odoo when appointments are booked:
  - Partner resolution: Finds existing partner by ID, email, or phone, or creates new partner if needed
  - Product linking: Each appointment type maps to an Odoo product (product_id) for order line creation
  - Order line generation: Creates order lines for all selected services with proper product references
  - Error handling: Sales order failures don't block appointment creation (graceful degradation)
- **Partner Search**: Custom queryFn implementation to pass search query parameter to backend API correctly.
- **Category Color System**: Visual appointment categorization using Odoo appointment categories:
  - Fetches appointment_category_id from calendar.event and color from appointment.category model during sync
  - Converts Odoo color indices (0-11) to hex colors using predefined palette
  - Applies category color as background tint (~12.5% opacity) and solid left border on appointment cards
  - Falls back to service-based colors when no category color exists
  - Consistent color display across all calendar views (day, week, month)
  - **Color Randomization**: One-click randomization of category colors in Settings panel:
    - Assigns random colors from Odoo's 12-color palette to all categories
    - Automatically triggers sync to fetch appointments with updated colors
    - Category legend displays in Settings panel with real-time color swatches
    - Immediate visual feedback via toast notifications

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