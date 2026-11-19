# ER Diagram

![ER diagram](ER-diagram.png)

> The source below is Mermaid (GitHub renders it automatically).

```mermaid
erDiagram
    USERS ||--o{ PROJECTS : "manages (manager_id)"
    USERS ||--o{ PROJECTS : "creates (created_by_id)"
    USERS ||--o{ PROJECT_MEMBERS : "belongs to"
    PROJECTS ||--o{ PROJECT_MEMBERS : "has team"
    PROJECTS ||--o{ TASKS : "contains"
    USERS ||--o{ TASKS : "assigned (assignee_id)"
    USERS ||--o{ TASKS : "creates (created_by_id)"
    TASKS ||--o{ COMMENTS : "has"
    USERS ||--o{ COMMENTS : "writes"
    TASKS ||--o{ ATTACHMENTS : "has"
    USERS ||--o{ ATTACHMENTS : "uploads"
    USERS ||--o{ AUDIT_LOGS : "performs"

    USERS {
        int id PK
        varchar name
        varchar email UK
        varchar password "bcrypt hash"
        enum role "ADMIN | PROJECT_MANAGER | TEAM_MEMBER"
        boolean is_active
        timestamptz last_login_at
        timestamptz created_at
        timestamptz updated_at
    }
    PROJECTS {
        int id PK
        varchar name
        text description
        enum status "PLANNING | ACTIVE | ON_HOLD | COMPLETED"
        date start_date
        date deadline
        int manager_id FK
        int created_by_id FK
        timestamptz created_at
        timestamptz updated_at
    }
    PROJECT_MEMBERS {
        int id PK
        int project_id FK "UK(project_id, user_id)"
        int user_id FK
        timestamptz joined_at
    }
    TASKS {
        int id PK
        varchar title
        text description
        enum status "TODO | IN_PROGRESS | COMPLETED"
        enum priority "LOW | MEDIUM | HIGH"
        date due_date
        timestamptz completed_at
        int project_id FK
        int assignee_id FK
        int created_by_id FK
        timestamptz created_at
        timestamptz updated_at
    }
    COMMENTS {
        int id PK
        text content
        int task_id FK
        int user_id FK
        timestamptz created_at
        timestamptz updated_at
    }
    ATTACHMENTS {
        int id PK
        varchar original_name
        varchar stored_name
        varchar mime_type
        int size
        int task_id FK
        int uploaded_by_id FK
        timestamptz created_at
    }
    AUDIT_LOGS {
        int id PK
        int user_id FK
        varchar action
        varchar entity_type
        int entity_id
        json details
        varchar ip_address
        timestamptz created_at
    }
```

## Relationships

| Relationship | Cardinality | On delete |
|---|---|---|
| User → Project (manager) | 1 : N | `SET NULL` (project keeps existing, needs a new manager) |
| User ↔ Project (team) via `project_members` | M : N | `CASCADE` (membership row removed) |
| Project → Task | 1 : N | `CASCADE` (deleting a project deletes its tasks) |
| User → Task (assignee) | 1 : N | `SET NULL` (task becomes unassigned) |
| Task → Comment | 1 : N | `CASCADE` |
| Task → Attachment | 1 : N | `CASCADE` (files are also removed from disk) |
| User → AuditLog | 1 : N | `SET NULL` (history is preserved) |

## Design notes

- **Users are soft-deleted** (`is_active = false`) so comments, tasks and audit history keep their author.
- **`project_members` has a unique `(project_id, user_id)`** constraint, so a person can't be added twice.
- **`completed_at`** is maintained by a model hook whenever `status` changes. It powers the "completed vs created" trend chart.
- **Indexes** cover every foreign key used for filtering (`project_id`, `assignee_id`), plus `status` and `due_date` for the task filters and overdue queries.
- **Attachments** store only metadata. The bytes live on disk under a random `stored_name`, so user-supplied filenames never touch the filesystem.
