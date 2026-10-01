# TeamUp — Full-Stack Collaborative Task Management System

**TeamUp** is a collaborative project and task management system built on the MERN stack (MongoDB, Express, React, Node.js). It demonstrates core system design and engineering patterns including Role-Based Access Control (RBAC), Optimistic Concurrency Control (OCC), idempotency key protection, environment-driven rate limiting, compound database indexing, and cloud deployment readiness.

---

## Table of Contents

1. [Features](#features)
2. [Tech Stack](#tech-stack)
3. [Architecture & Request Flow](#architecture--request-flow)
4. [Key System Design Concepts](#key-system-design-concepts)
5. [Database Schema & Indexing](#database-schema--indexing)
6. [API Endpoints](#api-endpoints)
7. [Environment Variables](#environment-variables)
8. [Local Setup & Installation](#local-setup--installation)
9. [Seed Data & Demo Accounts](#seed-data--demo-accounts)
10. [Deployment (Render)](#deployment-render)

---

## 1. Features

- **Project Workspaces**: Create, view, and delete collaborative project workspaces with ownership controls.
- **Task Management**: Full task lifecycle (`TODO`, `IN_PROGRESS`, `DONE`) with priority ratings (`LOW`, `MEDIUM`, `HIGH`) and due dates.
- **Server-Side Pagination & Filtering**: Filter tasks by status and priority with server-side pagination.
- **Optimistic Concurrency Control (OCC)**: Version-checked updates prevent concurrent lost updates by returning `409 Conflict` with conflict resolution UI.
- **Idempotency Protection**: In-memory idempotency middleware with automatic TTL cleanup prevents duplicate task creation during network retries.
- **Role-Based Access Control (RBAC)**: Fine-grained permissions for `ADMIN`, `MANAGER`, and `MEMBER` roles.
- **Dynamic Membership Management**: Automatically manages project membership based on task assignments.
- **Personal Dashboard**: Track assigned tasks, delivery stats, and recent project activity.
- **Zero-Setup Local Database Fallback**: Automatically spins up an in-memory MongoDB instance for local testing if local MongoDB is not running.

---

## 2. Tech Stack

### Frontend
- **React (v18)** & **Vite**: Single-Page Application (SPA) with fast bundling.
- **Bootstrap 5.3** & **Bootstrap Icons**: Responsive UI layout and styling.
- **React Router (v6)**: Client-side routing with authentication guards.
- **Axios**: HTTP client with request/response interceptors for JWT auth and session handling.

### Backend
- **Node.js** & **Express.js**: Modular REST API.
- **MongoDB** & **Mongoose**: Document store with compound indexing and schema validations.
- **Security & Utilities**:
  - `bcryptjs`: Password hashing.
  - `jsonwebtoken`: Stateless JWT authentication.
  - `helmet`: HTTP security headers.
  - `cors`: Configurable multi-origin resource sharing.
  - `express-rate-limit`: Rate limiting for auth and API routes.
  - `express-validator`: Request payload validation.
  - `mongodb-memory-server`: Local development fallback database.

---

## 3. Architecture & Request Flow

```text
                           ┌─────────────────────────────┐
                           │    React SPA (Vite / Client)│
                           └──────────────┬──────────────┘
                                          │  HTTP REST Requests
                                          ▼
┌───────────────────────────────────────────────────────────────────────────┐
│ Express.js Backend                                                        │
│                                                                           │
│   Routes ──► Middleware ────────► Controllers ──► Services ──► Mongoose   │
│                 │                                     │                   │
│          - Rate Limiter                         - OCC Check               │
│          - JWT Authentication                   - Membership Sync         │
│          - RBAC & Project Access                - Business Logic          │
│          - Idempotency Handler                                            │
│          - Express Validator                                              │
└─────────────────────────────────────┬─────────────────────────────────────┘
                                      │
                                      ▼
                           ┌─────────────────────┐
                           │   MongoDB Database  │
                           │   - Users           │
                           │   - Projects        │
                           │   - Tasks (Indexed) │
                           └─────────────────────┘
```

---

## 4. Key System Design Concepts

### 1. Role-Based Access Control (RBAC)
- **ADMIN**: Global administrative privileges across all workspaces, projects, and tasks.
- **MANAGER**: Can create projects, manage project workspaces, and assign tasks to any team member.
- **MEMBER**: Can access projects they belong to or own, view tasks, and update the status of tasks assigned to them.

### 2. Optimistic Concurrency Control (OCC)
- Every task document tracks an integer `version` field (starts at `1`).
- When a client updates a task (`PUT /api/tasks/:id`), it submits the current version it holds:
  ```json
  {
    "status": "DONE",
    "version": 2
  }
  ```
- If another user modified the task concurrently, the database version will not match the client's submitted version.
- The server rejects the update with **`HTTP 409 Conflict`** and returns the latest task data. The UI alerts the user and provides a "Load Latest" button to inspect changes and retry safely.

### 3. Idempotency Key Handling
- Write requests (such as task creation) generate a unique `Idempotency-Key` header.
- The server caches successful responses in-memory for 1 hour keyed by user and idempotency token.
- If network timeouts cause the client or user to retry, the server serves the cached response (`X-Idempotent-Replay: true`) rather than creating duplicate task documents.

### 4. Configurable Rate Limiting
- **Authentication Limiter**: Protects `/api/auth/login` and `/api/auth/register` against brute-force attacks.
- **General API Limiter**: Protects `/api/*` against traffic spikes and runaway loops.
- Configurable via environment variables with safe production and development defaults.

---

## 5. Database Schema & Indexing

### Users Collection (`users`)
- `name`: String (required, max 100)
- `email`: String (required, unique, lowercase, indexed)
- `password`: String (bcrypt hashed)
- `role`: Enum `['ADMIN', 'MANAGER', 'MEMBER']` (default: `'MEMBER'`)

### Projects Collection (`projects`)
- `name`: String (required, max 120)
- `description`: String (max 1000)
- `owner`: ObjectId (ref: `'User'`, required, indexed)
- `members`: Array of ObjectIds (ref: `'User'`, indexed)

### Tasks Collection (`tasks`)
- `title`: String (required, max 200)
- `description`: String (max 2000)
- `project`: ObjectId (ref: `'Project'`, required, indexed)
- `assignedTo`: ObjectId (ref: `'User'`, default: `null`)
- `createdBy`: ObjectId (ref: `'User'`, required)
- `status`: Enum `['TODO', 'IN_PROGRESS', 'DONE']` (default: `'TODO'`)
- `priority`: Enum `['LOW', 'MEDIUM', 'HIGH']` (default: `'MEDIUM'`)
- `dueDate`: Date (default: `null`)
- `version`: Number (default: `1`, used for OCC)

### Database Compound Indexes
```javascript
// Optimized for filtered and paginated task list queries
taskSchema.index({ project: 1, status: 1 });
taskSchema.index({ project: 1, createdAt: -1 });

// Optimized for user dashboard aggregations
taskSchema.index({ assignedTo: 1, status: 1 });

// Optimized for project access checks
projectSchema.index({ owner: 1 });
projectSchema.index({ members: 1 });
```

---

## 6. API Endpoints

### Authentication (`/api/auth`)
| Method | Endpoint | Description | Access |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/auth/register` | Register new user account | Public |
| `POST` | `/api/auth/login` | Sign in and receive token/cookie | Public |
| `POST` | `/api/auth/logout` | Clear session cookie | Authenticated |
| `GET` | `/api/auth/me` | Fetch authenticated user profile | Authenticated |

### Projects (`/api/projects`)
| Method | Endpoint | Description | Access |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/projects` | List projects accessible to user | Authenticated |
| `POST` | `/api/projects` | Create a new project workspace | Admin / Manager |
| `GET` | `/api/projects/:id` | Get project details and members | Project Member / Admin |
| `PUT` | `/api/projects/:id` | Update project name, description, or members | Admin / Manager / Owner |
| `DELETE` | `/api/projects/:id` | Delete project and cascade-delete tasks | Project Owner / Admin |
| `GET` | `/api/projects/users` | List users for assignment selectors | Authenticated |

### Tasks (`/api/tasks` & `/api/projects/:projectId/tasks`)
| Method | Endpoint | Description | Access |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/projects/:projectId/tasks` | Get paginated/filtered tasks | Project Member / Admin |
| `POST` | `/api/projects/:projectId/tasks` | Create task (supports `Idempotency-Key`) | Admin / Manager |
| `GET` | `/api/tasks/my-tasks` | Get current user's assigned tasks & stats | Authenticated |
| `GET` | `/api/tasks/:id` | Get single task details | Authenticated |
| `PUT` | `/api/tasks/:id` | Update task (enforces OCC `version`) | Assignee / Creator / Admin / Owner |
| `DELETE` | `/api/tasks/:id` | Delete task | Admin / Manager / Owner |

### Health Check
| Method | Endpoint | Description | Access |
| :--- | :--- | :--- | :--- |
| `GET` | `/health` | Server uptime and health probe | Public |

---

## 7. Environment Variables

### Backend (`server/.env`)
```env
PORT=5000
MONGODB_URI=mongodb://127.0.0.1:27017/teamup
JWT_SECRET=your_jwt_secret_key_here
JWT_EXPIRES_IN=7d
CLIENT_URL=http://localhost:5173
NODE_ENV=development

# Optional Rate Limiting Overrides
RATE_LIMIT_AUTH_MAX=20
RATE_LIMIT_AUTH_WINDOW_MIN=15
RATE_LIMIT_API_MAX=1000
RATE_LIMIT_API_WINDOW_MIN=15
```

### Frontend (`client/.env`)
```env
# Optional in unified deployments; required only if hosting frontend on a separate domain
VITE_API_URL=http://localhost:5000/api
```

---

## 8. Local Setup & Installation

### Prerequisites
- Node.js (v18+) and npm installed.
- (Optional) Local MongoDB running at `mongodb://127.0.0.1:27017`. If MongoDB is not running locally, the server automatically spins up an in-memory database instance for testing.

### 1. Clone & Install Dependencies
```bash
git clone https://github.com/ankushkumar10101/TeamUp.git
cd TeamUp

# Install dependencies for both server and client
npm run install:all
```

### 2. Seed Database
Populate demo users, projects, and tasks:
```bash
npm run seed
```

### 3. Run Development Servers
Open two terminal windows:

```bash
# Terminal 1 — Backend (runs on http://localhost:5000)
npm run dev:server

# Terminal 2 — Frontend (runs on http://localhost:5173)
npm run dev:client
```

---

## 9. Seed Data & Demo Accounts

The seed script creates the following demo accounts (all passwords: `password123`):

| Role | Email | Password | Permissions |
| :--- | :--- | :--- | :--- |
| **ADMIN** | `admin@teamup.dev` | `password123` | Full access across all projects and tasks |
| **MANAGER** | `manager@teamup.dev` | `password123` | Can create projects and assign tasks |
| **MEMBER** | `charlie@teamup.dev` | `password123` | Workspace collaborator |
| **MEMBER** | `diana@teamup.dev` | `password123` | Workspace collaborator |
| **MEMBER** | `evan@teamup.dev` | `password123` | Workspace collaborator |

---

## 10. Deployment (Render)

The project includes a ready-to-use [`render.yaml`](./render.yaml) file for single-service full-stack deployment on Render.

### Option A: Unified Web Service (Recommended)
Both backend API and compiled React frontend are served from a single Render Web Service:
- **Build Command**: `npm run build`
- **Start Command**: `npm start`
- **Health Check Path**: `/health`
- **Environment Variables**:
  - `NODE_ENV`: `production`
  - `MONGODB_URI`: `mongodb+srv://<username>:<password>@cluster0.xxxxx.mongodb.net/teamup?retryWrites=true&w=majority`
  - `JWT_SECRET`: Random 256-bit secret (Render can auto-generate this)
  - `JWT_EXPIRES_IN`: `7d`

### Option B: Separate Services
- **Backend (Render Web Service)**:
  - Root directory: `server`
  - Build command: `npm install`
  - Start command: `npm start`
- **Frontend (Render Static Site / Vercel / Netlify)**:
  - Root directory: `client`
  - Build command: `npm install && npm run build`
  - Publish directory: `dist`
  - Environment variable: `VITE_API_URL=https://your-backend-service.onrender.com/api`

> [!NOTE]
> When using MongoDB Atlas with Render, ensure **`0.0.0.0/0`** is added in your Atlas **Network Access** settings to allow connections from Render's dynamic IP addresses.
