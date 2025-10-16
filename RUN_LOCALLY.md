# Running the Calendar & Appointment Management System Locally

This guide will help you set up and run the calendar and appointment management application on your local machine.

## Prerequisites

Before you begin, make sure you have the following installed:

- **Node.js** (v18 or higher) - [Download here](https://nodejs.org/)
- **npm** (comes with Node.js) or **yarn**
- **Git** (optional, for cloning the repository)
- **Odoo Instance** - You need access to an Odoo instance with:
  - `calendar.event` module (for appointments)
  - `appointment.type` module (for appointment types/services)
  - `appointment.resource` module (for staff management)
  - `res.partner` module (for customer contacts)

## Installation Steps

### 1. Clone or Download the Project

```bash
# If using Git
git clone <repository-url>
cd <project-directory>

# Or download and extract the ZIP file
```

### 2. Install Dependencies

```bash
npm install
```

This will install all required packages including React, Express, Vite, and other dependencies.

### 3. Set Up Environment Variables

Create a `.env` file in the root directory of the project:

```bash
touch .env
```

Add the following environment variables to your `.env` file:

```env
# Odoo Configuration (Required)
ODOO_URL=https://your-odoo-instance.odoo.com
ODOO_DB=your-database-name
ODOO_USERNAME=your-odoo-username
ODOO_API_KEY=your-odoo-api-key

# Optional: PostgreSQL Database (if you want to use database instead of in-memory storage)
# DATABASE_URL=postgresql://user:password@localhost:5432/calendar_db

# Optional: Session Secret (for future authentication features)
# SESSION_SECRET=your-random-secret-key-here
```

#### How to Get Odoo Credentials:

1. **ODOO_URL**: Your Odoo instance URL (e.g., `https://mycompany.odoo.com`)
2. **ODOO_DB**: Your database name (usually your company name or subdomain)
3. **ODOO_USERNAME**: Your Odoo login email/username
4. **ODOO_API_KEY**: 
   - Log in to your Odoo instance
   - Go to **Settings** → **Users & Companies** → **Users**
   - Select your user
   - Go to **Account Security** tab
   - Generate an **API Key** (not your password)

> **Note**: The application uses in-memory storage by default, so PostgreSQL is optional. Data will reset when the server restarts.

## Running the Application

### Development Mode

Start the development server with hot module reloading:

```bash
npm run dev
```

The application will start on **http://localhost:5000**

- **Backend**: Express server running on port 5000
- **Frontend**: Vite dev server integrated with Express
- **Hot Reload**: Changes to frontend and backend code will automatically reload

### Production Build

To build and run the production version:

```bash
# Build the application
npm run build

# Start the production server
npm start
```

The production build will:
- Bundle the React frontend with Vite
- Bundle the Express backend with esbuild
- Serve optimized static files

## First-Time Setup

After starting the application for the first time:

1. **Open the application** in your browser: http://localhost:5000

2. **Sync with Odoo**:
   - Click the **Sync** button in the top-right corner
   - Wait for the sync to complete (usually 5-15 seconds)
   - This will fetch:
     - Staff members from Odoo resources
     - Appointments from calendar events
     - Appointment types (services)
     - Staff working hours/calendars

3. **Verify the Connection**:
   - You should see your staff members appear in the calendar
   - Existing appointments will be displayed
   - The calendar will reflect staff working hours

## Using the Application

### Main Features

**Calendar Views**:
- **Day View**: See one day with staff columns
- **Week View**: See 7 days with time slots
- **Month View**: Traditional monthly calendar

**Booking Appointments**:
1. Click on an available time slot (white background)
2. Search for an existing contact or enter customer details manually
3. Select one or more services
4. Click **Book** to create the appointment

**Managing Appointments**:
- **Click** an appointment to view details
- **Drag** an appointment to reschedule it
- Changes sync automatically with Odoo

**Settings**:
- Click the gear icon to configure working hours, time intervals, and inactive days

## Troubleshooting

### Port Already in Use

If port 5000 is already in use, you can change it by editing `server/index.ts`:

```typescript
const PORT = process.env.PORT || 5000; // Change 5000 to another port
```

### Odoo Connection Fails

#### Error: "Unknown XML-RPC tag 'TITLE'"

This error means the app is getting an HTML page instead of an XML-RPC response. This usually happens when:

**Solution 1: Check Your Odoo URL Format**

Your `ODOO_URL` should be the **base URL only**, without any paths:

```env
# ✅ CORRECT
ODOO_URL=https://yourcompany.odoo.com
ODOO_URL=http://localhost:8069

# ❌ WRONG - Don't include /web or other paths
ODOO_URL=https://yourcompany.odoo.com/web
ODOO_URL=https://yourcompany.odoo.com/web/database/selector
```

**Solution 2: Verify XML-RPC is Enabled**

Some Odoo instances disable XML-RPC for security. Test it with:

```bash
curl -X POST https://yourcompany.odoo.com/xmlrpc/2/common \
  -H "Content-Type: text/xml" \
  -d '<?xml version="1.0"?><methodCall><methodName>version</methodName></methodCall>'
```

If you get HTML back instead of XML, XML-RPC might be disabled. Contact your Odoo administrator.

**Solution 3: Check for HTTPS/HTTP**

Make sure your URL uses the correct protocol:
- If your Odoo uses SSL, use `https://`
- If it's local or doesn't use SSL, use `http://`

**Solution 4: Test the Connection**

1. Visit http://localhost:5003/api/test-odoo (adjust port if different)
2. You should see version information if connected successfully
3. If you see an error, check the exact error message

**Other Connection Issues:**

1. **Check your credentials** in the `.env` file
2. **Verify Odoo modules** are installed:
   - Appointments module
   - Calendar module  
   - Resources module
3. **Check API key**: Make sure you're using an API key, not your password
4. **Database name**: Ensure `ODOO_DB` matches your database name exactly

### No Appointments Showing

1. **Run a sync**: Click the Sync button in the top-right
2. **Check Odoo data**: Ensure you have:
   - Published appointment types
   - Active appointment resources (staff)
   - Calendar events in Odoo

### Dependencies Not Installing

```bash
# Clear npm cache
npm cache clean --force

# Delete node_modules and package-lock.json
rm -rf node_modules package-lock.json

# Reinstall
npm install
```

## Project Structure

```
├── client/               # React frontend
│   └── src/
│       ├── components/   # UI components
│       ├── pages/        # Page components
│       └── lib/          # Utilities and hooks
├── server/               # Express backend
│   ├── routes.ts         # API routes
│   ├── storage.ts        # Data storage layer
│   └── services/
│       └── odoo.ts       # Odoo integration
├── shared/
│   └── schema.ts         # Shared TypeScript schemas
└── package.json          # Dependencies and scripts
```

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm start` - Run production server
- `npm run check` - Run TypeScript type checking
- `npm run db:push` - Push database schema (if using PostgreSQL)

## Additional Notes

### Data Persistence

The application uses **in-memory storage** by default. This means:
- Data resets when the server restarts
- Perfect for development and testing
- No database setup required

To use **PostgreSQL** for persistence:
1. Set up a PostgreSQL database
2. Add `DATABASE_URL` to your `.env` file
3. Run `npm run db:push` to create tables
4. Update `server/storage.ts` to use `DbStorage` instead of `MemStorage`

### Syncing with Odoo

- The app syncs appointments **bidirectionally** with Odoo
- Local changes (create, update, reschedule) are pushed to Odoo
- Click **Sync** to pull the latest data from Odoo
- Automatic sync happens on application load

### Browser Compatibility

The application works best with modern browsers:
- Chrome/Edge (recommended)
- Firefox
- Safari

## Getting Help

If you encounter issues:

1. Check the **browser console** for frontend errors (F12)
2. Check the **terminal/server logs** for backend errors
3. Verify your **Odoo instance** is accessible and credentials are correct
4. Review the **API endpoints** documentation in `replit.md`

## License

MIT
