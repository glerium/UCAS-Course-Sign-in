CREATE TABLE IF NOT EXISTS audit_events (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    action TEXT NOT NULL,
    outcome TEXT NOT NULL CHECK (outcome IN ('success', 'failure')),
    username TEXT,
    course_date CHAR(8),
    course_id TEXT,
    course_uuid TEXT,
    course_name TEXT,
    teacher_name TEXT,
    keyword TEXT,
    result_count INTEGER,
    error_code TEXT,
    upstream_status TEXT
);

CREATE INDEX IF NOT EXISTS audit_events_created_at_idx ON audit_events (created_at DESC);
CREATE INDEX IF NOT EXISTS audit_events_username_created_at_idx ON audit_events (username, created_at DESC);
CREATE INDEX IF NOT EXISTS audit_events_action_created_at_idx ON audit_events (action, created_at DESC);
