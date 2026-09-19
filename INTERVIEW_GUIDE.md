# TeamUp — System Design & Technical Interview Guide

This guide contains concise, technically rigorous explanations of the architectural decisions, system-design trade-offs, and failure scenarios implemented in **TeamUp**. Use this document to prepare for engineering discussions and technical interviews.

---

## 1. Authentication & Authorization

### How does JWT authentication work?
A JSON Web Token (JWT) is a compact, URL-safe means of representing claims to be transferred between two parties. It consists of three base64url-encoded parts separated by dots:
1. **Header**: Contains token type (`JWT`) and signing algorithm (e.g. `HS256`).
2. **Payload**: Contains the claims (e.g. `userId`, `exp`, `iat`).
3. **Signature**: Cryptographic hash of `HMACSHA256(base64UrlEncode(header) + "." + base64UrlEncode(payload), secret)`.

When a user logs in with valid credentials, the server signs a JWT and transmits it via an **HTTP-only cookie** or Bearer token header. On subsequent requests, the backend verifies the signature using the shared secret. Because the signature guarantees the payload has not been tampered with, the backend can trust the user identity without performing a database session lookup on every request.

### Authentication vs. Authorization
- **Authentication (AuthN)**: "Who are you?" Validating identity (e.g., verifying email and password against bcrypt hashes, or verifying a valid JWT signature).
- **Authorization (AuthZ)**: "What are you allowed to do?" Determining whether an authenticated identity has permission to perform a specific action on a specific resource (e.g., ensuring only an `ADMIN` can delete a project).

### How does Role-Based Access Control (RBAC) work?
In TeamUp, users are assigned a role (`ADMIN`, `MANAGER`, `MEMBER`). RBAC is enforced through Express middleware:
1. **Role Guard Middleware (`authorizeRoles('ADMIN', 'MANAGER')`)**: Checks if `req.user.role` matches the permitted roles for the target route.
2. **Resource Ownership & Membership Guard (`checkProjectAccess`)**: Confirms that if a user is not an `ADMIN`, they are specifically listed in the project's `members` array or are the `owner`.
3. **Operation-Specific Guard (`checkTaskAssignmentPermission`)**: Restricts task re-assignment privileges to `ADMIN` and `MANAGER` roles, rejecting member attempts with `403 Forbidden`.

Frontend role checks only conditionally render buttons for visual convenience; backend middleware strictly enforces security.

---

## 2. Redis Caching & Cache Invalidation

### Why Redis instead of querying MongoDB directly?
- **Speed & Latency**: Redis stores data in-memory with sub-millisecond read response times ($<1\text{ms}$), compared to disk-backed database queries ($10\text{--}50\text{ms}$).
- **Database Offloading**: A dashboard or task board request queried hundreds of times per second by multiple team members will saturate MongoDB CPU and connection pools. Redis absorbs 80–90% of read traffic.

### What is the Cache-Aside (Lazy Loading) Pattern?
In the cache-aside pattern:
1. The application checks the cache first for the requested data key.
2. **Cache Hit**: The cached data is returned immediately.
3. **Cache Miss**: The application reads from MongoDB, writes the result to Redis with a TTL, and then returns the data.

The database is never updated directly by the cache; the application orchestrates reading and writing to both stores.

### How do TTL and Cache Invalidation work?
- **TTL (Time-To-Live)**: Acts as a safety net. In TeamUp, keys have a 120-second TTL. If an invalidation event is missed, stale data is evicted automatically after two minutes.
- **Explicit Invalidation**: When any task is created, updated, or deleted, TeamUp triggers `delByPattern("project:<projectId>:tasks:*")`. This purges all paginated query variations for that project immediately, ensuring subsequent reads retrieve fresh data.

### What happens if Redis goes down? (Graceful Degradation)
Redis is treated as an accelerator, not a point of failure:
1. The Redis client catches connection errors and sets `isRedisConnected = false`.
2. Safe wrapper methods (`safeRedis.get`, `safeRedis.set`) catch errors and return `null` without throwing unhandled exceptions.
3. The application falls back seamlessly to querying MongoDB directly and using in-memory fallbacks for rate limiting and idempotency. The system continues operating without downtime.

---

## 3. Real-Time Communication & WebSockets (Socket.IO)

### Why WebSockets over REST Polling?
- **Bidirectional & Event-Driven**: WebSockets maintain a persistent, full-duplex TCP connection. The server can push changes to clients instantly.
- **Efficiency**: Eliminates the overhead of HTTP headers ($1\text{--}2\text{KB}$ per request) and server polling queries repeated every few seconds.

### Why project-specific rooms?
A project management system has thousands of distinct projects. Broadcasting every task update globally to all connected clients would create an $O(N)$ network flood. Rooms isolate traffic: only clients actively viewing `project:123` join the `project:123` room and receive its task updates.

### How do you prevent unauthorized room access?
Arbitrary room joins are blocked on the backend:
1. When a client emits `join-project`, the backend extracts the user identity from the authenticated socket handshake.
2. The server queries the project in MongoDB to verify that `user.role === 'ADMIN'` or the user ID is present in `project.members` or `project.owner`.
3. Only if verified does the server execute `socket.join("project:" + projectId)`. Unauthorized requests are rejected.

### How would Socket.IO scale across multiple Node.js instances?
By default, WebSockets are bound to a single server process. If Client A is on Server 1 and Client B is on Server 2, Server 1 cannot emit to Client B directly.
- **Solution**: Use the **Socket.IO Redis Adapter** (`@socket.io/redis-adapter`).
- When Server 1 emits an event to a room, the Redis adapter publishes it to a Redis Pub/Sub channel. Server 2 receives the Redis message and forwards it to its locally connected clients.

---

## 4. Concurrency Control (Optimistic vs. Pessimistic)

### What is a race condition and a lost update?
A **lost update** occurs when two users read the same version of a task concurrently, make edits, and save:
1. User A reads Task #1 (Version 1).
2. User B reads Task #1 (Version 1).
3. User A updates description and saves $\rightarrow$ Version becomes 2.
4. User B changes status to `DONE` and saves $\rightarrow$ Overwrites User A's changes because User B was operating on stale data.

### How does Optimistic Concurrency Control (OCC) prevent this?
OCC assumes conflicts are infrequent and checks for conflicts at the moment of update:
1. Every task document contains an integer `version` field.
2. The client submits the version it originally read: `{ status: "DONE", version: 1 }`.
3. The database updates only if `{ _id: taskId, version: expectedVersion }` matches:
   ```javascript
   const task = await Task.findOneAndUpdate(
     { _id: taskId, version: expectedVersion },
     { ...updates, $inc: { version: 1 } }
   );
   ```
4. If no document matches because another user already incremented `version` to `2`, the update fails and the server returns **`HTTP 409 Conflict`**.
5. The frontend alerts the user and fetches the latest document for conflict resolution.

### Why Optimistic Concurrency Control instead of Pessimistic Locking?
- **Pessimistic Locking**: Locks the record in the database while a user has an edit modal open. If the user closes their laptop or loses connection, the record remains locked for everyone else.
- **OCC**: Non-blocking, highly scalable for web applications, and eliminates deadlocks while strictly preserving data integrity.

---

## 5. Rate Limiting

### Why rate limit APIs?
- Prevents brute-force credential stuffing attacks against `/api/auth/login`.
- Prevents Denial of Service (DoS) and API abuse.
- Protects downstream database capacity from rogue client loops.

### Why stricter limits on login?
General API routes allow normal user browsing (e.g. 150 requests / 15 minutes). Authentication routes are restricted to 10 requests / 15 minutes because login endpoints perform expensive cryptographic hashing (`bcrypt.compare`), which intentionally consumes CPU cycles.

### Why use Redis for distributed rate limiting?
In-memory rate limit counters stored on an individual Node.js server are bypassed when a user hits multiple backend instances behind a round-robin load balancer. Using Redis allows all server instances to share atomic counter increments (`INCR` with `EXPIRE`).

---

## 6. Idempotency

### Why can network retries cause duplicate operations?
In distributed networks, a client may send a `POST /tasks` request that the server processes successfully. However, if the server's HTTP response drops due to a temporary network blip or mobile handoff, the client assumes failure and retries. Without protection, two duplicate tasks are created.

### How does the `Idempotency-Key` work?
1. The client generates a unique UUID or key header: `Idempotency-Key: req_12345`.
2. The backend checks Redis for `idempotency:<userId>:<key>`.
3. **If already processed**: The backend immediately returns the previously cached HTTP status code and response payload with header `X-Idempotent-Replay: true`.
4. **If new**: The backend executes the creation, saves the response in Redis with a 1-hour TTL, and returns the newly created resource.

---

## 7. Database Indexing & Pagination

### Why server-side pagination?
Fetching 50,000 tasks into React and paginating client-side transfers tens of megabytes of JSON over the network, increases memory usage, and cripples mobile browsers. Server-side pagination (`skip` and `limit` in MongoDB) transfers only the requested 10–20 records per page.

### Index Justification
1. **`{ project: 1, status: 1 }`**: Speeds up board column grouping and filtered task queries by allowing MongoDB to perform an index scan directly on the composite keys without scanning non-project tasks.
2. **`{ project: 1, createdAt: -1 }`**: Eliminates in-memory sorting (`SORT_KEY_GENERATOR`) when listing project tasks in reverse chronological order.
3. **`{ assignedTo: 1, status: 1 }`**: Accelerates the user dashboard aggregation query that computes assigned task counts per status.

---

## 8. Horizontal Scaling & Architecture

### How to scale TeamUp to 1 million users?
1. **Stateless Backend Tier**: The Node.js monolithic service stores no local sessions or ephemeral state in process memory. Instances can scale horizontally (e.g., 20 container replicas behind an AWS ALB or NGINX).
2. **Redis Cluster for Caching & Socket Pub/Sub**: Deploy a Redis cluster with master-replica replication to handle high-throughput task list caching and Socket.IO multi-node event distribution.
3. **MongoDB Replica Set & Read Scaling**:
   - Primary handles all writes.
   - Secondary nodes handle read-heavy analytical or dashboard queries using read preferences (`readPreference: 'secondaryPreferred'`).
4. **CDN Edge Caching**: Serve static assets (Vite React bundle, CSS, Bootstrap icons) via Cloudflare or CloudFront edge nodes.
