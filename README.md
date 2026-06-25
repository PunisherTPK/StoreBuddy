# StoreBuddy

StoreBuddy is a local-first inventory tracking and billing system for small retail businesses. It was built from the interim report MVP and includes:

- Role-based login for `admin`, `cashier`, and `stock_handler`
- Product and category management
- Real-time stock updates
- POS billing and itemized sales capture
- Supplier and purchase order management
- Low-stock alerts and simple reporting
- Manual backup and restore

## Tech Stack

- Frontend: React + Vite
- Backend: Node.js + Express
- Database: MySQL
- Schema: [`database/schema.sql`](/C:/Users/User/Desktop/Bit%20Project%20V2/Site/StoreBuddy/database/schema.sql)
- Seed source used for first-time bootstrap: [`backend/data/store.json`](/C:/Users/User/Desktop/Bit%20Project%20V2/Site/StoreBuddy/backend/data/store.json)

## Demo Accounts

- `admin` / `admin123`
- `cashier` / `cashier123`
- `stock` / `stock123`

## Run Locally

1. Install dependencies:

```powershell
npm.cmd install
```

2. Start the backend:

```powershell
npm.cmd run dev:backend
```

3. Start the frontend in a second terminal for development:

```powershell
npm.cmd run dev:frontend
```

4. Or build the frontend and use the backend to serve the built app:

```powershell
npm.cmd run build
npm.cmd start
```

The backend runs on `http://localhost:4000` and the Vite frontend runs on `http://localhost:5173`.

## MySQL Configuration

The backend now connects to MySQL using these defaults:

- Host: `127.0.0.1`
- Port: `3306`
- Database: `storebuddy`
- User: `root`
- Password: `mypass`

You can override them with environment variables:

- `MYSQL_HOST`
- `MYSQL_PORT`
- `MYSQL_DATABASE`
- `MYSQL_USER`
- `MYSQL_PASSWORD`

On first run, if the main tables are empty, the backend seeds MySQL from [`backend/data/store.json`](/C:/Users/User/Desktop/Bit%20Project%20V2/Site/StoreBuddy/backend/data/store.json).
