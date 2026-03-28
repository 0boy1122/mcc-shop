# MCC Shop – Backend API

Node.js + Express + Prisma + PostgreSQL + Socket.io

---

## Quick Setup (follow these steps in order)

### 1. Install dependencies
```bash
npm install
```

### 2. Set up environment variables
```bash
cp .env.example .env
```
Then open `.env` and fill in:
- `DATABASE_URL` — your PostgreSQL connection string
- `JWT_SECRET` — any long random string (e.g. `mccshop_super_secret_2024`)
- `PAYSTACK_SECRET_KEY` — from paystack.com (for MoMo payments)
- `STRIPE_SECRET_KEY` — from stripe.com (for card payments)

### 3. Set up the database
```bash
# Copy schema to the right place
cp src/prisma/schema.prisma prisma/schema.prisma

# Run migrations (creates all tables)
npx prisma migrate dev --name init

# Seed the database with products and test users
node src/prisma/seed.js
```

### 4. Start the server
```bash
# Development (auto-restarts on changes)
npm run dev

# Production
npm start
```

Server runs on: `http://localhost:5000`
Health check: `http://localhost:5000/health`

---

## Test Accounts (after seeding)

| Role     | Phone       | Password     |
|----------|-------------|--------------|
| Admin    | 0200000001  | admin123     |
| Customer | 0200000002  | customer123  |
| Rider    | 0200000003  | rider123     |

---

## API Endpoints

### Auth
| Method | URL | Description |
|--------|-----|-------------|
| POST | /api/auth/register | Register a customer |
| POST | /api/auth/login | Login (returns JWT token) |
| GET  | /api/auth/me | Get logged-in user |

### Products
| Method | URL | Description |
|--------|-----|-------------|
| GET | /api/products | List all products |
| GET | /api/products?category=Paints | Filter by category |
| GET | /api/products?search=emulsion | Search products |
| GET | /api/products/categories | Get all categories |
| GET | /api/products/:id | Get single product |

### Orders
| Method | URL | Description |
|--------|-----|-------------|
| POST | /api/orders | Place an order |
| GET  | /api/orders | Get my orders |
| GET  | /api/orders/:id | Track an order |
| PATCH | /api/orders/:id/status | Update order status |

### Payments
| Method | URL | Description |
|--------|-----|-------------|
| POST | /api/payments/initiate | Start MoMo or card payment |
| POST | /api/payments/webhook | Paystack/Stripe webhook |
| GET  | /api/payments/:orderId | Check payment status |

### Dispatch (Rider App)
| Method | URL | Description |
|--------|-----|-------------|
| GET  | /api/dispatch/available | See orders to pick up |
| POST | /api/dispatch/accept/:orderId | Accept an order |
| PATCH | /api/dispatch/location | Send GPS location |
| POST | /api/dispatch/proof/:orderId | Upload delivery proof |
| PATCH | /api/dispatch/availability | Go online/offline |

### Admin
| Method | URL | Description |
|--------|-----|-------------|
| GET  | /api/admin/products | All products (incl. unpublished) |
| POST | /api/admin/products | Create product |
| PUT  | /api/admin/products/:id | Update product |
| GET  | /api/admin/orders | All orders |
| GET  | /api/admin/analytics | Dashboard stats |
| GET  | /api/admin/users | All users |
| POST | /api/admin/riders | Create rider account |

---

## How to use the API from the frontend

Every request (except login/register) must include this header:
```
Authorization: Bearer YOUR_TOKEN_HERE
```

Example login + fetch products:
```javascript
// 1. Login
const res = await fetch('http://localhost:5000/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ phone: '0200000002', password: 'customer123' })
});
const { token } = await res.json();

// 2. Fetch products (use token)
const products = await fetch('http://localhost:5000/api/products', {
  headers: { Authorization: `Bearer ${token}` }
});
```

---

## Real-time tracking (Socket.io)

```javascript
import { io } from 'socket.io-client';
const socket = io('http://localhost:5000');

// Customer: track an order
socket.emit('track:order', orderId);
socket.on('rider:location', ({ lat, lng }) => {
  // Update map pin
});
socket.on('order:status', ({ status }) => {
  // Update order status UI
});
```

---

## Folder structure
```
src/
  index.js              ← Server entry point
  routes/
    auth.routes.js
    product.routes.js
    order.routes.js
    payment.routes.js
    dispatch.routes.js
    admin.routes.js
  middleware/
    auth.middleware.js  ← JWT + role check
    error.middleware.js
  prisma/
    schema.prisma       ← Database schema
    seed.js             ← Test data
```
