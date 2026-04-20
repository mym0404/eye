export const CURRENT_SCHEMA_VERSION = 3

export const dropSchemaStatements = [
  "drop table if exists dirty_files;",
  "drop table if exists dependencies;",
  "drop table if exists references_idx;",
  "drop table if exists symbols;",
  "drop table if exists files;",
  "drop table if exists projects;",
  "drop table if exists schema_meta;",
]

export const schemaStatements = [
  `
    create table if not exists schema_meta (
      version integer not null,
      updated_at text not null
    );
  `,
  `
    create table if not exists projects (
      project_root text primary key,
      index_generation integer not null default 0,
      last_index_status text not null default 'idle',
      last_index_started_at text,
      last_index_completed_at text,
      last_error text,
      created_at text not null,
      updated_at text not null
    );
  `,
  `
    create table if not exists files (
      project_root text not null,
      relative_path text not null,
      language text not null,
      content_hash text not null,
      blob_hash text,
      size integer not null,
      mtime_ms integer not null,
      parse_source text not null,
      last_seen_generation integer not null,
      indexed_generation integer not null,
      symbol_count integer not null,
      reference_count integer not null,
      primary key (project_root, relative_path)
    );
  `,
  `
    create table if not exists symbols (
      symbol_id text primary key,
      project_root text not null,
      relative_path text not null,
      language text not null,
      name text not null,
      kind text not null,
      container_name text,
      source text not null,
      line integer not null,
      column_number integer not null,
      end_line integer,
      end_column integer
    );
  `,
  `
    create table if not exists references_idx (
      id integer primary key autoincrement,
      project_root text not null,
      relative_path text not null,
      language text not null,
      symbol_id text,
      name text not null,
      context text not null,
      source text not null,
      line integer not null,
      column_number integer not null
    );
  `,
  `
    create table if not exists dependencies (
      id integer primary key autoincrement,
      project_root text not null,
      relative_path text not null,
      dependency_path text not null,
      edge_kind text not null,
      specifier text not null
    );
  `,
  `
    create table if not exists dirty_files (
      project_root text not null,
      relative_path text not null,
      reason text not null,
      queued_at text not null,
      primary key (project_root, relative_path)
    );
  `,
  `
    create index if not exists idx_symbols_lookup
    on symbols (project_root, name, relative_path, line);
  `,
  `
    create index if not exists idx_references_lookup
    on references_idx (project_root, name, relative_path, line);
  `,
  `
    create index if not exists idx_files_generation
    on files (project_root, last_seen_generation, indexed_generation);
  `,
]
