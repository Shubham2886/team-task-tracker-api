# Team Task Tracker API

> **SDE II Take-Home Assignment** — Built by Shubham Sharma  
> Node.js · Express · MongoDB · Redis · Docker

---

## Quick Start (One Command)

```bash
docker compose up
```

API will be live at: `http://localhost:3000`  
Swagger UI: `http://localhost:3000/api-docs`

> No manual setup needed. MongoDB and Redis start automatically.

---

## Tech Stack

| Layer | Choice |
|-------|--------|
| Runtime | Node.js 18 |
| Framework | Express.js |
| Database | MongoDB (Mongoose) |
| Cache | Redis (ioredis) |
| Auth | JWT (access + refresh token rotation) |
| Containerization | Docker + Docker Compose |
| API Docs | Swagger / OpenAPI 3.0 |

---

## API Endpoints

### Auth
| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| POST | `/api/auth/register` | Public | Register with role |
| POST | `/api/auth/login` | Public | Login, get tokens |
| POST | `/api/auth/refresh` | Public | Rotate refresh token |
| POST | `/api/auth/logout` | Any | Invalidate refresh token |

### Users
| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| GET | `/api/users/me` | Any | Own profile |
| GET | `/api/users` | Any | List org members |
| GET | `/api/users/:id` | Any | Get user |
| PATCH | `/api/users/:id/role` | ADMIN | Update role |
| DELETE | `/api/users/:id` | ADMIN | Deactivate user |

### Tasks
| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| GET | `/api/tasks` | Any* | List tasks (paginated, filtered) |
| POST | `/api/tasks` | ADMIN, MANAGER | Create task |
| GET | `/api/tasks/:id` | Any* | Get single task |
| PATCH | `/api/tasks/:id` | ADMIN, MANAGER | Update task fields |
| PATCH | `/api/tasks/:id/status` | Assignee / MANAGER / ADMIN | Transition status |
| DELETE | `/api/tasks/:id` | ADMIN | Delete task |

*MEMBER sees only tasks assigned to them.

### Analytics (Bonus)
| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| GET | `/api/analytics` | ADMIN, MANAGER | Overdue count + avg completion time per user |

---

## RBAC Design

RBAC is enforced **at the middleware level** using `requireRole(...)` — never inside controller logic. This makes permissions explicit and auditable from the route definition alone.

```
ADMIN   → manage:users, manage:projects, manage:tasks, view:tasks
MANAGER → manage:projects, manage:tasks, view:tasks
MEMBER  → view:tasks (own only), update:own_tasks (status)
```

---

## Status Transitions

```
TODO → IN_PROGRESS → IN_REVIEW → DONE
  ↘         ↘           ↘
          BLOCKED (reachable from any active state)
BLOCKED → TODO | IN_PROGRESS (resume flow)
```

Transitions are **server-side enforced** — any invalid transition returns a `400 INVALID_TRANSITION` error with the list of valid next states.

Only the **assignee** or a **MANAGER/ADMIN** can advance a task's status.

---

## Caching Strategy

Redis is used to cache task list results **per assignee**.

**Cache key format:**
```
tasks:assignee:{assigneeId}:status:{status}:priority:{priority}:page:{page}:limit:{limit}
```

**Invalidation triggers:**
- Task created for an assignee → invalidate that assignee's cache
- Task updated (fields or re-assigned) → invalidate old and new assignee caches
- Task status changed → invalidate assignee's cache
- Task deleted → invalidate assignee's cache

**Strategy**: Pattern-based key deletion using `Redis KEYS tasks:assignee:{id}*` on any write operation.  
Cache TTL: 60 seconds. Redis failure is non-fatal — the API degrades gracefully to direct DB queries.

---

## Database Design Decision

**Why compound indexes on `(status, organization)` and `(assignee, organization)`?**

All task queries are organization-scoped (multi-tenant). A standalone index on `status` alone would scan across organizations. The compound index `{ status: 1, organization: 1 }` allows MongoDB to narrow to the org first, then filter by status efficiently.

Similarly, `{ assignee: 1, organization: 1 }` makes the "tasks assigned to me" query (the most frequent MEMBER query) a pure index scan.

**Additional indexes:**
- `{ due_date: 1 }` — powers the analytics overdue query (`due_date < now`)
- `{ priority: 1, organization: 1 }` — supports priority filtering

**Schema summary:**

```
User
  _id, name, email (unique), password (hashed), role, organization, refreshToken, isActive

Task
  _id, title, description, priority, status, assignee (ref: User),
  createdBy (ref: User), organization, due_date, completedAt, createdAt, updatedAt
```

---

## Error Response Format

All errors follow a consistent structure:
```json
{
  "status": 400,
  "code": "VALIDATION_ERROR",
  "message": "due_date must be a future date"
}
```

---

## Testing with Postman

Import `postman/TaskTracker.postman_collection.json` into Postman.

The collection uses variables — `accessToken` and `refreshToken` are auto-set after Register/Login. Run requests in order:
1. Register (ADMIN)
2. Login
3. Create Task (auto-saves `taskId`)
4. Transition statuses in sequence

---

## What I'd Improve With More Time

1. **WebSocket notifications** — emit events via Socket.IO when a task's status changes, so the assignee gets a real-time alert (bonus feature scaffolded but not wired to socket layer).

2. **Integration tests** — Jest + supertest test suite covering the two most critical flows: (a) RBAC enforcement and (b) status transition validation.

3. **Rate limiting** — `express-rate-limit` on auth routes to prevent brute-force attacks.

4. **Refresh token family tracking** — detect refresh token reuse (potential token theft) and revoke the entire session family.

5. **Soft-delete for tasks** — add `deletedAt` field instead of hard-deleting, to support audit trails and undo.

6. **CI/CD pipeline** — GitHub Actions workflow to run lint + tests on every PR.

---

## Project Structure

```
src/
  app.js               # Express setup, routes, Swagger
  server.js            # Entry point — DB + Redis connect
  config/
    database.js        # MongoDB connection
    redis.js           # Redis connection (graceful degradation)
  models/
    User.js            # User schema + indexes
    Task.js            # Task schema + transition map + indexes
  middleware/
    auth.js            # JWT authentication
    rbac.js            # Role-based access control (enforced here, not in controllers)
    validators.js      # express-validator rules
    errorHandler.js    # Consistent error shape
  controllers/
    auth.controller.js      # register, login, refresh, logout
    user.controller.js      # CRUD + role management
    task.controller.js      # CRUD + status transitions + cache
    analytics.controller.js # Overdue + completion time aggregations
  routes/
    auth.routes.js
    user.routes.js
    task.routes.js
    analytics.routes.js
  utils/
    jwt.js             # Token generation + verification
    cache.js           # Redis cache helpers + invalidation
postman/
  TaskTracker.postman_collection.json
swagger.yaml
docker-compose.yml
Dockerfile
```
