# AWTY (Are We There Yet)

Real-time task processing application with WebSocket updates.

## Setup

1. **Install dependencies:**

   ```bash
   npm install
   ```

2. **Environment Variables:**

   Copy the example environment file and configure it with your credentials:

   ```bash
   cp .env.example .env
   ```

3. **Infrastructure & Database Setup:**

   Ensure PostgreSQL and Redis are running. You can use Docker Compose:

   ```bash
   docker compose up -d
   ```

   When running with Docker Compose, database migrations are executed automatically by the `migrator` service.

   For local development without Docker, run:

   ```bash
   npm run migration:run
   ```

## How to Run

### Application Server

Starts the main HTTP and WebSocket server.

```bash
# development
npm run dev

# production mode
npm run start:prod
```

### Workers

Starts the background worker responsible for processing tasks.

```bash
# development
npm run worker:dev
```

### Running Multiple Workers

The application supports running multiple worker processes concurrently.

With Docker Compose, you can scale the worker service:

```bash
docker compose up --scale worker=3
```

This starts three independent worker containers consuming jobs from the same pg-boss queue.

You can change the number of workers as needed:

```bash
docker compose up --scale worker=5
```

Tasks are persisted in PostgreSQL and processed asynchronously through pg-boss, allowing multiple workers to process independent tasks concurrently.

## API Docs

The application exposes REST API endpoints under the `/api/v1/` prefix.

### Create a Task

**Endpoint:** `POST /api/v1/tasks`

Creates a new task that takes a specific duration to process.

**Request Body:**

```json
{
  "duration": 10
}
```

- `duration`: The time in seconds the task will take to complete.

**Response (201 Created):**

```json
{
  "id": "b3e5140e-5a02-45e9-9150-13b72c918239",
  "status": "pending",
  "progress": 0,
  "duration": 10,
  "createdAt": "2023-10-08T12:00:00.000Z",
  "updatedAt": "2023-10-08T12:00:00.000Z"
}
```

### Get Task Status

**Endpoint:** `GET /api/v1/tasks/:id`

Retrieves the current status and progress of a task by its UUID.

**Response (200 OK):**

```json
{
  "id": "b3e5140e-5a02-45e9-9150-13b72c918239",
  "status": "processing",
  "progress": 50,
  "duration": 10,
  "createdAt": "2023-10-08T12:00:00.000Z",
  "updatedAt": "2023-10-08T12:00:05.000Z"
}
```

## WebSocket Docs

The application provides real-time updates for tasks using WebSockets (Socket.io).

**Namespace:** `/ws`

### Subscription Events

To receive updates for a task, the client must send a `message` event with a JSON payload containing the task ID and action type.

#### Subscribe

```json
{
  "type": "subscribe",
  "taskId": "b3e5140e-5a02-45e9-9150-13b72c918239"
}
```

**Note:** Upon subscribing, the server will immediately emit the current task state, allowing for instant feedback on mid-task reconnections.

#### Unsubscribe

```json
{
  "type": "unsubscribe",
  "taskId": "b3e5140e-5a02-45e9-9150-13b72c918239"
}
```

### Task Updates

The server emits a unified `task:update` event whenever the task's status or progress changes.

**Event:** `task:update`

**Payload Examples:**

**Processing:**

```json
{
  "type": "processing",
  "taskId": "b3e5140e-5a02-45e9-9150-13b72c918239",
  "progress": 50,
  "error": null
}
```

**Completed:**

```json
{
  "type": "completed",
  "taskId": "b3e5140e-5a02-45e9-9150-13b72c918239",
  "progress": 100,
  "error": null
}
```

**Failed:**

```json
{
  "type": "failed",
  "taskId": "b3e5140e-5a02-45e9-9150-13b72c918239",
  "progress": null,
  "error": "Task failed due to a processing error."
}
```
