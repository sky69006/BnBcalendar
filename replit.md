# Overview

This is a calendar and appointment management system that integrates with Odoo ERP. The application provides a visual calendar interface for managing appointments, staff schedules, and calendar settings. It's built as a full-stack TypeScript application with a React frontend and Express backend, designed to sync appointment data bidirectionally with an Odoo instance via XML-RPC.

The system allows users to view and manage appointments in a calendar grid, configure working hours and inactive days, manage staff members, and automatically synchronize data with Odoo. The application supports drag-and-drop appointment rescheduling and real-time updates.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend Architecture

**Framework**: React with TypeScript, using Vite as the build tool and development server.

**UI Components**: Built with shadcn/ui component library (Radix UI primitives) for accessible, customizable components. Styling uses Tailwind CSS with a custom design system featuring CSS variables for theming.

**State Management**: TanStack Query (React Query) for server state management with automatic caching, background refetching, and optimistic updates. No global state management library is used - component state is managed locally with React hooks.

**Routing**: Wouter for lightweight client-side routing (single page application pattern).

**Key Design Patterns**:
- Custom hooks for business logic separation (`useOdooSync`, `useIsMobile`, `useToast`)
- Query key-based cache invalidation for data synchronization
- Component composition with shadcn/ui's compound component patterns
- Shared TypeScript schemas between client and server via path aliases

## Backend Architecture

**Framework**: Express.js with TypeScript running on Node.js.

**Data Storage**: Two-tier approach:
- **Primary**: In-memory storage (`MemStorage` class) for development and testing
- **Production-ready**: PostgreSQL with Drizzle ORM (configured but not fully implemented in storage layer)

The storage interface (`IStorage`) abstracts the data layer, allowing easy swapping between in-memory and database implementations.

**API Design**: RESTful HTTP endpoints under `/api` namespace:
- Staff management: GET/POST/PUT/DELETE `/api/staff`
- Appointments: GET/POST/PUT/DELETE `/api/appointments` with date range filtering
- Settings: GET/PUT `/api/settings`
- Odoo sync: POST `/api/sync/odoo`, GET `/api/test-odoo`

**Development Features**:
- Vite middleware integration for HMR in development
- Request logging with response capture
- Static file serving in production

**Design Rationale**: Express was chosen for its simplicity and flexibility. The in-memory storage allows for rapid development and testing without database setup, while the interface pattern enables future database migration without changing business logic.

## Data Schema

**Database Schema** (Drizzle ORM with PostgreSQL):

1. **Users Table**: Authentication (username/password)
2. **Staff Table**: Staff members with Odoo user ID mapping, colors for calendar display, active status
3. **Appointments Table**: Customer appointments with Odoo event ID sync, staff assignment, status tracking
4. **Calendar Settings Table**: Global configuration (time intervals, inactive days, working hours, booking limits)

All tables use UUID primary keys with Postgres `gen_random_uuid()`. Timestamps track creation and sync times. The schema uses Drizzle-Zod for automatic validation schema generation.

**Design Decisions**: 
- Odoo IDs stored as unique integers to maintain bidirectional sync
- Status fields use text enums for flexibility
- Settings stored in singleton table pattern (single row)

## External Dependencies

### Third-Party Services

**Odoo ERP Integration** (Primary External Service):
- Protocol: XML-RPC over HTTP/HTTPS
- Authentication: Username + API key (or password)
- Purpose: Bidirectional sync of appointments, staff, and calendar events
- Configuration: Environment variables (ODOO_URL, ODOO_DB, ODOO_USERNAME, ODOO_API_KEY)

The `OdooService` class handles:
- Authentication via common endpoint
- CRUD operations on calendar events and users via object endpoint
- Version checking and connection testing
- Error handling and response parsing

**Integration Strategy**: 
- Pull-based sync: Fetch Odoo events and create/update local appointments
- Push-based updates: Send local changes back to Odoo
- Conflict resolution: Last sync timestamp tracking
- The system stores Odoo IDs to maintain data relationships

### Database

**PostgreSQL** (via Neon serverless):
- Driver: `@neondatabase/serverless` for edge-compatible connections
- ORM: Drizzle ORM for type-safe queries and migrations
- Connection: DATABASE_URL environment variable
- Migration strategy: Drizzle Kit with migrations in `/migrations` directory

**Why Neon**: Serverless PostgreSQL chosen for easy deployment, automatic scaling, and compatibility with edge runtimes.

### UI Component Libraries

**Radix UI**: Unstyled, accessible component primitives (dialogs, dropdowns, tooltips, etc.)
- Chosen for accessibility compliance and customization flexibility
- All components wrapped in shadcn/ui patterns

**Additional UI Dependencies**:
- `date-fns`: Date manipulation and formatting
- `react-day-picker`: Calendar date picker component
- `cmdk`: Command palette component
- `vaul`: Drawer/sheet component
- `embla-carousel-react`: Carousel functionality

### Development Tools

**Replit-specific**:
- `@replit/vite-plugin-runtime-error-modal`: Error overlay in development
- `@replit/vite-plugin-cartographer`: Code navigation
- `@replit/vite-plugin-dev-banner`: Development mode indicator

**Build Tools**:
- Vite: Frontend bundling with HMR
- esbuild: Backend bundling for production
- TypeScript: Type checking across full stack
- Tailwind CSS + PostCSS: Styling pipeline

### Session Management

**connect-pg-simple**: PostgreSQL-backed session store for Express sessions (configured but authentication not fully implemented).

**Design Note**: Session infrastructure is in place for future authentication features, but current implementation doesn't enforce authentication on routes.