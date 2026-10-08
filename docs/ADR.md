# Architecture Decision Record

## 1. Redis for Shared WebSocket State

### Context

The application supports multiple API instances, and WebSocket clients may connect to different instances.

Keeping socket information only in an in-memory `Map` would make that state local to a single process. Another API instance would not be able to coordinate with sockets connected to a different instance.

This becomes a problem when the application is horizontally scaled.

### Decision

We use Redis as shared infrastructure for WebSocket communication instead of relying only on process-local memory.

Redis allows multiple application instances to coordinate WebSocket-related communication and supports horizontal scaling.

### Consequences

**Benefits:**

- Supports multiple API instances.
- WebSocket communication is not tied to a single process.
- New API instances can be added without depending on local socket state.

**Trade-offs:**

- Redis becomes an infrastructure dependency.
- Cross-instance communication introduces network overhead.

---

## 2. Redis-based Rate Limiting

### Context

An in-memory rate limiter would maintain separate counters for every application process.

For example, if three API instances are running, each instance could have its own independent rate-limit counter. This could allow a client to exceed the intended global limit by distributing requests across instances.

### Decision

Rate-limiting state is stored in Redis instead of application memory.

Redis provides a shared counter/state that can be accessed by all API instances.

### Consequences

**Benefits:**

- Rate limits are shared across all API instances.
- Works correctly when the application is horizontally scaled.
- Rate-limit state is not tied to a single API process.

**Trade-offs:**

- Rate limiting depends on Redis availability.
- Adds Redis operations to the request path.

---

## 3. Worker Failure Recovery

### Context

Tasks are processed asynchronously by background workers.

A worker can fail because of an application error, process crash, or container failure while a task is being processed.

The system should provide mechanisms to recover from worker failures and avoid leaving tasks stuck indefinitely.

### Decision

Worker failure recovery is currently handled using two mechanisms:

1. **pg-boss job retries**
2. **Automatic worker container restart**

pg-boss can retry failed jobs according to the configured retry policy.

Docker Compose is configured to automatically restart the worker container when the worker process terminates unexpectedly.

This provides recovery at both the job level and the process/container level.

### Future Improvement

A future improvement would be to add a periodic recovery job.

The recovery job could inspect PostgreSQL for tasks that have remained in a non-terminal state for an unusually long period of time.

For example:

```text
processing
    ↓
no progress for a long time
    ↓
recovery job detects stale task
    ↓
re-enqueue task
```

This would provide an additional recovery mechanism for edge cases where a task is no longer actively being processed but its state remains non-terminal.

### Consequences

**Benefits:**

- Failed jobs can be retried automatically.
- Worker containers can recover automatically after process failure.
- A future recovery mechanism can handle stale tasks.

**Trade-offs:**

- Retried processing must be safe to resume.
- Additional recovery logic would increase system complexity.

---

## 4. Preventing Concurrent Processing of the Same Task

### Context

The system supports multiple workers processing tasks concurrently.

Different tasks should be processed concurrently, but the same task must never be processed by two workers at the same time.

For example:

```text
                 pg-boss
                /       \
               ↓         ↓
          Worker 1    Worker 2
```

Both workers should be able to process different tasks, while a single task should have only one active processor.

### Decision

We use multiple layers of protection.

### 4.1 pg-boss Singleton Key

When creating a job, the task ID is used as the `singletonKey`:

```ts
{
  singletonKey: task.id
}
```

This prevents duplicate jobs for the same task from being created within pg-boss's singleton scope.

Therefore, if the application accidentally tries to enqueue the same task more than once, pg-boss can prevent duplicate queued/active jobs for that singleton key according to its singleton configuration.

### 4.2 pg-boss Job Claiming / Locking

pg-boss also handles job claiming internally.

When multiple workers consume the same queue, a job is claimed by a worker so that the same pg-boss job is not concurrently processed by multiple workers.

For example:

```text
                    pg-boss
                       │
                 ┌─────┴─────┐
                 ↓           ↓
             Worker 1    Worker 2
                 │           │
                 ↓           ↓
              Job A        Job B
```

A single job is owned by one worker at a time during normal processing.

This is different from `singletonKey`:

- `singletonKey` helps prevent duplicate jobs for the same task.
- pg-boss job claiming/locking ensures a single job is assigned to one worker at a time.

### 4.3 Future Improvement: Distributed Lock

As an additional defensive mechanism, a distributed lock could be introduced using Redis/Redlock.

For example:

```text
Worker 1
   │
   ├── acquire lock: task:123
   │
   ↓
 process task
   │
   └── release lock


Worker 2
   │
   └── acquire lock: task:123
             ↓
          rejected
```

This would provide an explicit application-level distributed lock around task processing.

### Why We Do Not Currently Use It

The current architecture already relies on pg-boss singleton behavior and job claiming/locking. Adding another distributed lock would introduce additional complexity and another failure mode without being necessary for the current requirements.

Redlock can be considered later if additional processing paths are introduced where the same task could be triggered outside the normal pg-boss flow.

### Consequences

**Benefits:**

- Independent tasks can be processed concurrently.
- Duplicate enqueue attempts are controlled by the singleton key.
- A single pg-boss job is claimed by one worker at a time.
- A distributed lock remains an option for future hardening.

**Trade-offs:**

- The design depends on correct pg-boss configuration and job-processing behavior.
- Adding Redlock later would increase infrastructure and implementation complexity.
