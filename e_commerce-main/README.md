# E-Commerce Web Application

A basic full-stack online store with product catalog browsing, cart checkout, role-based access, backend APIs, MongoDB persistence, product management, and order tracking.

## Features

- Product catalog with seeded starter products
- Add to cart and checkout
- User registration and login
- First registered account is automatically assigned the `Admin` role
- Admin-only product create, update, and delete
- User order history
- Admin order tracking and status updates
- MongoDB database integration

## Run Locally

1. Install dependencies:

   ```bash
   npm install
   ```

2. Copy environment settings:

   ```bash
   cp .env.example .env
   ```

3. Start MongoDB locally, use Docker, or set `MONGODB_URI` in `.env` to a MongoDB Atlas connection string.

   ```bash
   docker compose up -d
   ```

4. Start the application:

   ```bash
   npm start
   ```

5. Open `http://localhost:3000`.

## API Overview

### Auth

- `POST /api/auth/register`
- `POST /api/auth/login`

### Products

- `GET /api/products`
- `POST /api/products` Admin only
- `PUT /api/products/:id` Admin only
- `DELETE /api/products/:id` Admin only

### Orders

- `POST /api/orders` Authenticated users
- `GET /api/orders` Admin sees all orders, users see their own
- `PATCH /api/orders/:id/status` Admin only

## Notes

- Set a strong `JWT_SECRET` before using this beyond local practice.
- Checkout uses guarded stock updates so it works with a normal local MongoDB instance.
