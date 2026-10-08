CREATE TABLE service_runs (
  service TEXT PRIMARY KEY NOT NULL CHECK(service IN ('publisher','billing')),
  started_at INTEGER NOT NULL,
  finished_at INTEGER NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('success','failed','disabled')),
  http_status INTEGER NOT NULL
);
