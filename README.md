# Stockapp

Stockapp is a full-stack inventory and sales management system built with React on the frontend and Express + MongoDB on the backend. It supports authentication, inventory tracking, customer management, sales entry, dashboard analytics, and user/admin workflows.

## Tech Stack

- Frontend: React, React Router, Bootstrap, Axios
- Backend: Node.js, Express, MongoDB, Mongoose
- Authentication: JWT + bcrypt

## Project Structure

- `stockapp-backend/` – Express API and database logic
- `stockapp-frontend/` – React application UI

## Features

- User registration and login
- Admin and user dashboards
- Inventory management
- Customer management
- Sales entry and sales history
- Credit bills and stock transfer flows
- Role-based access control

## Prerequisites

Before running the app, make sure you have:

- Node.js 18+
- npm
- MongoDB database connection

## Environment Variables

Create a `.env` file inside `stockapp-backend/` with the following values:

```env
PORT=5001
MONGODB_URI=your_mongodb_connection_string
JWT_SECRET=your_jwt_secret
NODE_ENV=development
```

## Running the Backend

```bash
cd stockapp-backend
npm install
npm start
```

The backend runs by default on:

- http://localhost:5001

## Running the Frontend

```bash
cd stockapp-frontend
npm install
npm start
```

The frontend runs by default on:

- http://localhost:3000

If port 3000 is busy, React will ask whether to use another port, usually 3001.

## Default API Proxy

The frontend is configured with a proxy to the backend:

```json
"proxy": "http://localhost:5001"
```

## Notes

- The backend uses MongoDB for persistent storage.
- The frontend communicates with the backend through API routes under `/api`.
- Keep `.env` files private and do not commit them to source control.

## License

This project is for internal or personal use as defined by the repository owner.
