-- =====================================================================
-- TaskFlow - Project & Task Management System
-- PostgreSQL schema (equivalent to what Sequelize creates on startup)
-- =====================================================================

CREATE TYPE user_role       AS ENUM ('ADMIN', 'PROJECT_MANAGER', 'TEAM_MEMBER');
CREATE TYPE project_status  AS ENUM ('PLANNING', 'ACTIVE', 'ON_HOLD', 'COMPLETED');
CREATE TYPE task_status     AS ENUM ('TODO', 'IN_PROGRESS', 'COMPLETED');
CREATE TYPE task_priority   AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- ---------------------------------------------------------------------
-- Users: every person in the system; role drives authorization
-- ---------------------------------------------------------------------
CREATE TABLE users (
    id             SERIAL PRIMARY KEY,
    name           VARCHAR(100) NOT NULL,
    email          VARCHAR(150) NOT NULL UNIQUE,          -- stored lower-case
    password       VARCHAR(255) NOT NULL,                 -- bcrypt hash
    role           user_role    NOT NULL DEFAULT 'TEAM_MEMBER',
    is_active      BOOLEAN      NOT NULL DEFAULT TRUE,    -- soft delete
    last_login_at  TIMESTAMPTZ,
    created_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------
-- Projects
-- ---------------------------------------------------------------------
CREATE TABLE projects (
    id             SERIAL PRIMARY KEY,
    name           VARCHAR(150)   NOT NULL,
    description    TEXT,
    status         project_status NOT NULL DEFAULT 'ACTIVE',
    start_date     DATE,
    deadline       DATE,
    manager_id     INTEGER REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE,
    created_by_id  INTEGER REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_project_dates CHECK (deadline IS NULL OR start_date IS NULL OR deadline >= start_date)
);
CREATE INDEX projects_manager_id ON projects (manager_id);
CREATE INDEX projects_status     ON projects (status);

-- ---------------------------------------------------------------------
-- Project team membership (many-to-many users <-> projects)
-- ---------------------------------------------------------------------
CREATE TABLE project_members (
    id          SERIAL PRIMARY KEY,
    project_id  INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE ON UPDATE CASCADE,
    user_id     INTEGER NOT NULL REFERENCES users(id)    ON DELETE CASCADE ON UPDATE CASCADE,
    joined_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT project_members_project_id_user_id UNIQUE (project_id, user_id)
);

-- ---------------------------------------------------------------------
-- Tasks
-- ---------------------------------------------------------------------
CREATE TABLE tasks (
    id             SERIAL PRIMARY KEY,
    title          VARCHAR(200)  NOT NULL,
    description    TEXT,
    status         task_status   NOT NULL DEFAULT 'TODO',
    priority       task_priority NOT NULL DEFAULT 'MEDIUM',
    due_date       DATE,
    completed_at   TIMESTAMPTZ,                           -- set automatically when status -> COMPLETED
    project_id     INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE ON UPDATE CASCADE,
    assignee_id    INTEGER REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE,
    created_by_id  INTEGER REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX tasks_project_id  ON tasks (project_id);
CREATE INDEX tasks_assignee_id ON tasks (assignee_id);
CREATE INDEX tasks_status      ON tasks (status);
CREATE INDEX tasks_due_date    ON tasks (due_date);

-- ---------------------------------------------------------------------
-- Task comments
-- ---------------------------------------------------------------------
CREATE TABLE comments (
    id          SERIAL PRIMARY KEY,
    content     TEXT    NOT NULL,
    task_id     INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE ON UPDATE CASCADE,
    user_id     INTEGER REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX comments_task_id ON comments (task_id);

-- ---------------------------------------------------------------------
-- Task file attachments (file bytes live on disk under UPLOAD_DIR)
-- ---------------------------------------------------------------------
CREATE TABLE attachments (
    id              SERIAL PRIMARY KEY,
    original_name   VARCHAR(255) NOT NULL,
    stored_name     VARCHAR(255) NOT NULL,                -- random server-side name
    mime_type       VARCHAR(100) NOT NULL,
    size            INTEGER      NOT NULL,                -- bytes
    task_id         INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE ON UPDATE CASCADE,
    uploaded_by_id  INTEGER REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX attachments_task_id ON attachments (task_id);

-- ---------------------------------------------------------------------
-- Audit trail of every significant action
-- ---------------------------------------------------------------------
CREATE TABLE audit_logs (
    id           SERIAL PRIMARY KEY,
    user_id      INTEGER REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE,
    action       VARCHAR(50) NOT NULL,                    -- CREATE, UPDATE, DELETE, LOGIN, STATUS_CHANGE, ...
    entity_type  VARCHAR(50) NOT NULL,                    -- User, Project, Task, System
    entity_id    INTEGER,
    details      JSON,                                    -- e.g. {"status": {"from": "TODO", "to": "COMPLETED"}}
    ip_address   VARCHAR(64),
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX audit_logs_entity_type_entity_id ON audit_logs (entity_type, entity_id);
CREATE INDEX audit_logs_user_id               ON audit_logs (user_id);
CREATE INDEX audit_logs_created_at            ON audit_logs (created_at);
