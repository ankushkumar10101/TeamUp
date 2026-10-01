# TeamUp: Collaborative Task Management System

A full-stack MERN (MongoDB, Express, React, Node.js) application for collaborative project and task management.

## Features

- **Dashboard**: Track your assigned tasks, completion stats, and recent project activity.
- **Project Workspaces**: Create, manage, and collaborate on projects with role-based member access.
- **Task Management**: Create, assign, and organize tasks across Todo, In Progress, and Done with priorities and due dates.
- **Concurrency Control**: Optimistic Concurrency Control (OCC) prevents lost updates and alerts users when tasks are edited concurrently.
- **Idempotency Protection**: In-memory idempotency key support prevents duplicate task creation during network retries.
- **User Authentication & RBAC**: Secure JWT-based auth with role-based permissions (Admin, Manager, Member).
- **Responsive UI**: Clean, mobile-friendly interface built with Bootstrap 5 and Bootstrap Icons.

## Tech Stack

- **Client**: React (v18), Vite, Bootstrap 5, Bootstrap Icons, React Router, Axios
- **Server**: Node.js, Express.js, Mongoose (MongoDB), JWT, Bcrypt

## Installation & Setup

### Prerequisites

- Node.js (v18+)
- MongoDB instance (local or Atlas)

### 1. Clone the repository

```bash
git clone https://github.com/ankushkumar10101/TeamUp.git
cd TeamUp
```

### 2. Server Setup

Navigate to the server directory and install dependencies:

```bash
cd server
npm install
```

Create a `.env` file in the `server` directory:

```env
PORT=5000
MONGODB_URI=your_mongodb_connection_string
JWT_SECRET=your_jwt_secret_key
JWT_EXPIRES_IN=7d
CLIENT_URL=http://localhost:5173
```

*(Optional)* Seed demo accounts and sample projects:

```bash
npm run seed
```

Start the server:

```bash
npm run dev
```

### 3. Client Setup

Open a new terminal, navigate to the client directory, and install dependencies:

```bash
cd client
npm install
```

Start the client development server:

```bash
npm run dev
```

The application will be running at `http://localhost:5173`.

## Demo Accounts

If you ran `npm run seed`, you can log in with any of these accounts (password: `password123`):

- **Admin**: `admin@teamup.dev`
- **Manager**: `manager@teamup.dev`
- **Member**: `charlie@teamup.dev`

## Usage

1. Sign up for a new account or log in with a demo account.
2. Create a new project or select an existing workspace.
3. Add tasks, set priority levels (Low, Medium, High), and assign them to members.
4. Update task progress from **TODO** to **IN_PROGRESS** and **DONE**.
5. Check your personal **Dashboard** to monitor your workload and completion rate.
