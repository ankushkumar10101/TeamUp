# TeamUp — Full-Stack Collaborative Task Management System

**TeamUp** is a collaborative project and task management system built on the MERN stack. It demonstrates production-grade system-design concepts including real-time communication, Redis caching with cache-aside and invalidation, optimistic concurrency control (OCC), rate limiting, idempotency keys, database indexing, and stateless horizontal scalability.

---

## Table of Contents

1. [Project Overview](#project-overview)
2. [Key System-Design Concepts](#key-system-design-concepts)
3. [Tech Stack](#tech-stack)
4. [Architecture & Request Flow](#architecture--request-flow)
5. [Database Schema & Indexing](#database-schema--indexing)
6. [Authentication & RBAC](#authentication--rbac)
7. [Redis Caching Strategy & Invalidation](#redis-caching-strategy--invalidation)
8. [Optimistic Concurrency Control (OCC)](#optimistic-concurrency-control-occ)
9. [Rate Limiting](#rate-limiting)
10. [Idempotency](#idempotency)
11. [Socket.IO Architecture & Security](#socketio-architecture--security)
12. [Scalability & Real-Time Scaling](#scalability--real-time-scaling)
13. [Failure Scenarios & Resilience](#failure-scenarios--resilience)
14. [API Endpoints](#api-endpoints)
15. [Setup & Installation Instructions](#setup--installation-instructions)
16. [Environment Variables](#environment-variables)
17. [Seed Data & Test Accounts](#seed-data--test-accounts)

---

## 1. Project Overview

TeamUp is engineered to solve collaboration challenges in modern team environments while maintaining a clean, modular, and realistic codebase. Rather than bloating the application with complex microservices or third-party wrappers, TeamUp implements core system-design patterns in a structured modular monolith.

### Core Capabilities:
- **Project Workspaces**: Multi-member workspaces with role-based access.
- **Task Management**: Full task lifecycle (`TODO`, `IN_PROGRESS`, `DONE`) with priority ratings and due dates.
- **Three-Column Kanban Board**: Drag-and-drop task status updates with instantaneous cross-client synchronization.
- **Server-Side Pagination & Filtering**: Filter by status, priority, and assignee with efficient database queries.

---

## 2. Key System-Design Concepts

| Concept | Implementation in TeamUp |
| :--- | :--- |
| **Real-Time Synchronization** | Socket.IO room-based event broadcasting (`project:<projectId>`). |
| **Room Access Security** | Token-authenticated room joins verified against project member list. |
| **Cache-Aside Pattern** | Task lists cached in Redis (`project:<id>:tasks:<page>:<limit>:<filters>`) with 120s TTL. |
| **Cache Invalidation** | Pattern-based invalidation (`project:<id>:tasks:*`) triggered on task write operations. |
| **Optimistic Concurrency** | Version-based concurrency check rejecting stale edits with `HTTP 409 Conflict`. |
| **Rate Limiting** | Stricter limits on auth (10 req/15m) and general API (150 req/15m) with Redis/Memory stores. |
| **Idempotency** | Header `Idempotency-Key` prevents duplicate task creations upon network retries. |
| **Database Indexing** | Compound indexes on `(project, status)`, `(project, createdAt)`, and `(assignedTo, status)`. |
| **Stateless Architecture** | Stateless JWT tokens and external Redis cache allow horizontal server replication. |
| **Graceful Degradation** | If Redis or MongoDB local services drop, non-crashing fallbacks maintain uptime. |

---

## 3. Tech Stack

### Frontend
- **React (v18)** & **Vite**: Ultra-fast build toolchain and component framework.
- **Bootstrap 5.3** & **Bootstrap Icons**: Clean, professional, and accessible UI layout.
- **React Router (v6)**: Client-side routing with guarded routes.
- **Axios**: Centralized HTTP client configured with cookie credentials and token interceptors.
- **Socket.IO Client (v4)**: WebSocket real-time subscription client.

### Backend
- **Node.js (v22)** & **Express.js**: Modular monolith REST API.
- **MongoDB** & **Mongoose**: Document store with schemas, validations, and compound indexes.
- **Redis (ioredis)**: In-memory cache, rate limiter store, and idempotency record repository.
- **Socket.IO (v4)**: WebSocket server with room authorization.
- **Security & Utilities**: `bcryptjs` (password hashing), `jsonwebtoken` (stateless auth), `helmet` (HTTP security headers), `cors`, `express-rate-limit`, and `express-validator`.

---

## 4. Architecture & Request Flow

```text
                                  ┌─────────────────────────────┐
                                  │   React Frontend (Vite)     │
                                  └──────────────┬──────────────┘
                                                 │
                                 HTTP REST / WebSockets (Socket.IO)
                                                 │
                                                 ▼
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│ Express Modular Monolith Backend                                                        │
│                                                                                         │
│   Route  ───►  Middleware  ───►  Controller  ───►  Service  ───►  Models (Mongoose)     │
│                     │                                   │                               │
│              - Rate Limiter                      - Cache-Aside                          │
│              - JWT Auth & RBAC                   - OCC Check                            │
│              - Idempotency Handler               - Socket Broadcast                     │
└────────────────────────────────────────────┬────────────────────────────────────────────┘
                                             │
                       ┌─────────────────────┴─────────────────────┐
                       ▼                                           ▼
            ┌──────────────────────┐                    ┌──────────────────────┐
            │   Redis Cache / Pub  │                    │   MongoDB Cluster    │
            │   - Task list cache  │                    │   - Users            │
            │   - Idempotency keys │                    │   - Projects         │
            │   - Rate limit state │                    │   - Tasks (Indexed)  │
            └──────────────────────┘                    └──────────────────────┘
```

---

## 5. Database Schema & Indexing

### Users Collection (`users`)
```javascript
{
  _id: ObjectId,
  name: String,
  email: { type: String, unique: true, index: true },
  password: String, // bcrypt hashed
  role: { type: String, enum: ['ADMIN', 'MANAGER', 'MEMBER'], default: 'MEMBER' },
  createdAt: Date,
  updatedAt: Date
}
```

### Projects Collection (`projects`)
```javascript
{
  _id: ObjectId,
  name: String,
  description: String,
  owner: { type: ObjectId, ref: 'User', index: true },
  members: [{ type: ObjectId, ref: 'User', index: true }],
  createdAt: Date,
  updatedAt: Date
}
```

### Tasks Collection (`tasks`)
```javascript
{
  _id: ObjectId,
  title: String,
  description: String,
  project: { type: ObjectId, ref: 'Project', required: true, index: true },
  assignedTo: { type: ObjectId, ref: 'User', default: null },
  createdBy: { type: ObjectId, ref: 'User', required: true },
  status: { type: String, enum: ['TODO', 'IN_PROGRESS', 'DONE'], default: 'TODO' },
  priority: { type: String, enum: ['LOW', 'MEDIUM', 'HIGH'], default: 'MEDIUM' },
  dueDate: Date,
  version: { type: Number, default: 1 }, // Optimistic Concurrency Control
  createdAt: Date,
  updatedAt: Date
}
```

### Indexing Strategy
1. `{ project: 1, status: 1 }`: Optimizes Kanban queries and filtered task views by project and status.
2. `{ project: 1, createdAt: -1 }`: Optimizes default paginated task listings sorted chronologically.
3. `{ assignedTo: 1, status: 1 }`: Optimizes the user dashboard view showing assigned tasks and status counts.

---

## 6. Authentication & RBAC

### Permissions Matrix
| Action | ADMIN | MANAGER | MEMBER |
| :--- | :---: | :---: | :---: |
| **Create Project** | Yes | Yes | No |
| **Update Project** | Yes | Yes | No |
| **Delete Project** | Yes | No | No |
| **Create Task** | Yes | Yes | Yes |
| **Update Task** | Yes | Yes | Yes |
| **Delete Task** | Yes | Yes | No |
| **Assign Task** | Yes | Yes | No |
| **View Project** | Yes | Yes | Yes (if member) |

*Note: RBAC checks are strictly enforced on the backend middleware layer. Frontend restrictions are UI conveniences.*

---

## 7. Redis Caching Strategy & Invalidation

### Cache-Aside Pattern
1. Client requests `GET /api/projects/:id/tasks?page=1&limit=20`.
2. Backend computes the deterministic cache key:
   `project:<projectId>:tasks:<page>:<limit>:<status>:<priority>:<assignedTo>`
3. **Cache Hit**: Returns cached JSON payload with `cached: true`.
4. **Cache Miss**: Queries MongoDB, sets the result into Redis with a 120-second TTL, and returns the response.

### Invalidation
Whenever a write operation occurs on a task (`createTask`, `updateTask`, `deleteTask`, or `deleteProject`):
- The server scans and invalidates all keys matching `project:<projectId>:tasks:*`.
- Stale cached pagination results are evicted immediately without waiting for TTL expiration.

---

## 8. Optimistic Concurrency Control (OCC)

When multiple users collaborate simultaneously, race conditions can cause **lost updates**. TeamUp prevents this through version tracking:

1. Every task document includes an integer `version` field (initialized to `1`).
2. When a client reads a task, it receives the current `version`.
3. When updating (`PUT /api/tasks/:id`), the client sends the expected version:
   ```json
   {
     "status": "DONE",
     "version": 3
   }
   ```
4. The service compares the stored version with the submitted version.
5. If the versions match:
   - The document updates and increments to `version = 4`.
6. If the versions do not match (another client already modified it):
   - The request is rejected with `HTTP 409 Conflict`.
   - The response includes the current version and task document, allowing the client to reload and resolve the conflict.

---

## 9. Rate Limiting

Rate limiting protects against brute force attacks and denial of service:

- **Authentication Endpoints (`/api/auth/login`, `/api/auth/register`)**: Stricter limit of **10 requests per 15 minutes** per IP. Exceeding returns `HTTP 429 Too Many Requests`.
- **General API Endpoints (`/api/*`)**: Standard limit of **150 requests per 15 minutes** per IP.
- **Distributed Store**: Uses Redis as the backing store when connected, allowing rate limit counters to be shared across horizontally scaled backend nodes. Falls back gracefully to in-memory tracking if Redis is unreachable.

---

## 10. Idempotency

Network timeouts can lead users or clients to retry write requests, resulting in duplicate task creation. TeamUp supports an `Idempotency-Key` header:

```http
POST /api/projects/665f.../tasks
Idempotency-Key: task-req-1718000000
```

1. The middleware checks Redis for `idempotency:<userId>:<key>`.
2. If found, it immediately replies with the previous cached status code and response body (adding `X-Idempotent-Replay: true`), without creating a duplicate record.
3. If not found, the operation executes, and the resulting response is cached with a 1-hour TTL.

---

## 11. Socket.IO Architecture & Security

### Project Room Authorization
Arbitrary socket connections cannot listen to events across foreign projects.
1. Clients establish an authenticated WebSocket handshake passing the JWT token.
2. When joining a room:
   ```javascript
   socket.emit('join-project', projectId, callback);
   ```
3. Backend validates that the authenticated user is either an `ADMIN`, project owner, or assigned project member.
4. Only upon authorization does the socket join `project:<projectId>`.

### Real-Time Events
- `task:created`: Emitted when a new task is posted.
- `task:updated`: Emitted when a task is edited or dragged to a new status.
- `task:deleted`: Emitted when a task is deleted.

---

## 12. Scalability & Real-Time Scaling

### Stateless Backend Monolith
The Node.js server does not store session state in memory. JWT tokens and external Redis caching enable horizontal scaling behind an NGINX or AWS ALB load balancer:

```text
                          Load Balancer
                        /       |       \
                       ▼        ▼        ▼
                   Node #1   Node #2   Node #3
                       \        |        /
                        ▼       ▼       ▼
                          Redis Cluster
                       (Pub/Sub + Cache)
                                │
                        MongoDB Replica Set
```

### Multi-Node Socket.IO Scaling
In a multi-server setup, WebSocket connections terminate on different Node instances. To propagate events across all nodes, the `@socket.io/redis-adapter` attaches Redis Pub/Sub so that an event emitted on Node #1 broadcasts to clients connected to Node #2 and Node #3 seamlessly.

---

## 13. Failure Scenarios & Resilience

1. **Redis Offline**: Safe wrappers in `server/src/config/redis.js` intercept connection errors. The server emits a warning, sets `isRedisConnected = false`, bypasses caching, falls back to direct MongoDB queries, and uses memory for rate limiting without crashing.
2. **MongoDB Connection Disruption**: Database operations fail with descriptive error messages caught by centralized Express error handling, returning clean `500 Internal Server Error` responses rather than crashing the Node process.
3. **Socket Disconnect**: The frontend SocketContext gracefully attempts automatic reconnection with exponential backoff while allowing the user to continue working using standard REST endpoints.
4. **Concurrent Edits**: Returns `HTTP 409 Conflict`, preserving data integrity and preventing lost updates.

---

## 14. API Endpoints

### Authentication
- `POST /api/auth/register` — Register a new account.
- `POST /api/auth/login` — Sign in and obtain token/cookie.
- `POST /api/auth/logout` — Clear session cookie.
- `GET  /api/auth/me` — Retrieve current authenticated user.

### Projects
- `GET    /api/projects` — List accessible projects.
- `GET    /api/projects/users` — List users for member pickers.
- `POST   /api/projects` — Create project *(Admin/Manager)*.
- `GET    /api/projects/:id` — Get project details.
- `PUT    /api/projects/:id` — Update project *(Admin/Manager)*.
- `DELETE /api/projects/:id` — Delete project and its tasks *(Admin only)*.

### Tasks
- `GET    /api/projects/:projectId/tasks` — Paginated & filtered task list *(Redis cached)*.
- `GET    /api/projects/:projectId/tasks/board` — All project tasks for Kanban view.
- `POST   /api/projects/:projectId/tasks` — Create task *(Supports Idempotency-Key)*.
- `GET    /api/tasks/:id` — Get single task.
- `PUT    /api/tasks/:id` — Update task *(Enforces OCC version)*.
- `DELETE /api/tasks/:id` — Delete task *(Admin/Manager)*.
- `GET    /api/tasks/my-tasks` — Aggregate tasks assigned to current user.

---

## 15. Setup & Installation Instructions

### Prerequisites
- Node.js (v18+) and npm installed.
- (Optional) Local MongoDB (`mongodb://127.0.0.1:27017`) and Redis (`redis://127.0.0.1:6379`).
  *Note: If local MongoDB is not running, the development server automatically spins up an in-memory MongoDB fallback server so you can test immediately with zero setup!*

### 1. Install Dependencies
From the repository root:
```bash
npm run install:all
```
*(Or run `npm install` inside `server` and `client` individually).*

### 2. Seed Sample Data
Populate the database with demo users, projects, and tasks:
```bash
npm run seed
```

### 3. Start Backend Server
```bash
# Terminal 1:
cd server
npm run dev
```
The server will start at `http://localhost:5000`.

### 4. Start Frontend Client
```bash
# Terminal 2:
cd client
npm run dev
```
The client will start at `http://localhost:5173`.

---

## 16. Environment Variables

Create `server/.env` (a template is provided in `server/.env.example`):

```env
PORT=5000
MONGODB_URI=mongodb://127.0.0.1:27017/teamup
JWT_SECRET=teamup_production_secret_key_2026_demo
JWT_EXPIRES_IN=7d
REDIS_URL=redis://127.0.0.1:6379
CLIENT_URL=http://localhost:5173
NODE_ENV=development
```

---

## 17. Seed Data & Test Accounts

All demo accounts use password: **`password123`**

| Role | Email | Password | Permissions Summary |
| :--- | :--- | :--- | :--- |
| **ADMIN** | `admin@teamup.dev` | `password123` | Full access: delete projects, manage tasks & members |
| **MANAGER** | `manager@teamup.dev` | `password123` | Create/edit projects, assign & delete tasks |
| **MEMBER 1** | `charlie@teamup.dev` | `password123` | Create/update tasks, view project, move Kanban cards |
| **MEMBER 2** | `diana@teamup.dev` | `password123` | Create/update tasks, view project, move Kanban cards |
| **MEMBER 3** | `evan@teamup.dev` | `password123` | Create/update tasks, view project, move Kanban cards |
