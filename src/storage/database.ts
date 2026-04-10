import { mkdir } from "node:fs/promises"
import path from "node:path"

import Database from "better-sqlite3"

import type {
  IndexedFileData,
  LanguageId,
  NormalizedFileRecord,
  NormalizedReferenceRecord,
  NormalizedSymbolRecord,
} from "../indexing/types.js"
import {
  CURRENT_SCHEMA_VERSION,
  dropSchemaStatements,
  schemaStatements,
} from "./schema.js"

type FileRow = {
  relative_path: string
  language: LanguageId
  content_hash: string
  blob_hash?: string
  size: number
  mtime_ms: number
  parse_source: string
  indexed_generation: number
  symbol_count: number
  reference_count: number
}

type SymbolRow = {
  symbol_id: string
  relative_path: string
  language: LanguageId
  name: string
  kind: string
  container_name?: string
  source: string
  line: number
  column_number: number
  end_line?: number
  end_column?: number
}

type ReferenceRow = {
  relative_path: string
  language: LanguageId
  symbol_id?: string
  name: string
  context: string
  source: string
  line: number
  column_number: number
}

const now = () => new Date().toISOString()

const scopeMatches = ({
  relativePath,
  scopePath,
}: {
  relativePath: string
  scopePath?: string
}) => {
  if (!scopePath || scopePath === ".") {
    return true
  }

  return relativePath === scopePath || relativePath.startsWith(`${scopePath}/`)
}

export class EyeDatabase {
  readonly connection: Database.Database
  readonly projectRoot: string

  constructor({
    databasePath,
    projectRoot,
  }: {
    databasePath: string
    projectRoot: string
  }) {
    this.connection = new Database(databasePath)
    this.projectRoot = projectRoot
    this.connection.pragma("journal_mode = WAL")
    this.connection.pragma("foreign_keys = ON")
  }

  static open = async ({
    databasePath,
    projectRoot,
  }: {
    databasePath: string
    projectRoot: string
  }) => {
    await mkdir(path.dirname(databasePath), { recursive: true })

    const database = new EyeDatabase({
      databasePath,
      projectRoot,
    })
    database.ensureSchema()
    database.ensureProject()

    return database
  }

  private resetSchema = () => {
    for (const statement of dropSchemaStatements) {
      this.connection.exec(statement)
    }

    for (const statement of schemaStatements) {
      this.connection.exec(statement)
    }

    this.connection
      .prepare("insert into schema_meta (version, updated_at) values (?, ?)")
      .run(CURRENT_SCHEMA_VERSION, now())
  }

  ensureSchema = () => {
    const hasSchemaMeta = this.connection
      .prepare(
        "select name from sqlite_master where type = 'table' and name = 'schema_meta'",
      )
      .get() as { name?: string } | undefined

    if (!hasSchemaMeta) {
      this.resetSchema()
      return
    }

    const row = this.connection
      .prepare(
        "select version from schema_meta order by updated_at desc limit 1",
      )
      .get() as { version?: number } | undefined

    if (row?.version === CURRENT_SCHEMA_VERSION) {
      for (const statement of schemaStatements) {
        this.connection.exec(statement)
      }

      return
    }

    this.resetSchema()
  }

  ensureProject = () => {
    const timestamp = now()

    this.connection
      .prepare(
        `
          insert into projects (
            project_root,
            created_at,
            updated_at
          )
          values (?, ?, ?)
          on conflict(project_root) do update set
            updated_at = excluded.updated_at
        `,
      )
      .run(this.projectRoot, timestamp, timestamp)
  }

  getProjectState = () =>
    (this.connection
      .prepare(
        `
          select
            index_generation,
            last_index_status,
            last_index_started_at,
            last_index_completed_at,
            last_error
          from projects
          where project_root = ?
        `,
      )
      .get(this.projectRoot) as
      | {
          index_generation: number
          last_index_status: string
          last_index_started_at?: string
          last_index_completed_at?: string
          last_error?: string
        }
      | undefined) ?? {
      index_generation: 0,
      last_index_status: "idle",
    }

  startIndexRun = () => {
    const projectState = this.getProjectState()
    const nextGeneration = projectState.index_generation + 1

    this.connection
      .prepare(
        `
          update projects
          set
            last_index_status = 'indexing',
            last_index_started_at = ?,
            updated_at = ?,
            last_error = null
          where project_root = ?
        `,
      )
      .run(now(), now(), this.projectRoot)

    return nextGeneration
  }

  replaceDirtyFiles = ({
    paths,
    reason,
  }: {
    paths: string[]
    reason: string
  }) => {
    const replace = this.connection.transaction(() => {
      this.connection
        .prepare("delete from dirty_files where project_root = ?")
        .run(this.projectRoot)

      if (paths.length === 0) {
        return
      }

      const statement = this.connection.prepare(
        `
          insert into dirty_files (
            project_root,
            relative_path,
            reason,
            queued_at
          )
          values (?, ?, ?, ?)
        `,
      )
      const queuedAt = now()

      for (const relativePath of paths) {
        statement.run(this.projectRoot, relativePath, reason, queuedAt)
      }
    })

    replace()
  }

  private deleteFileRows = (relativePath: string) => {
    this.connection
      .prepare("delete from files where project_root = ? and relative_path = ?")
      .run(this.projectRoot, relativePath)
    this.connection
      .prepare(
        "delete from symbols where project_root = ? and relative_path = ?",
      )
      .run(this.projectRoot, relativePath)
    this.connection
      .prepare(
        "delete from references_idx where project_root = ? and relative_path = ?",
      )
      .run(this.projectRoot, relativePath)
    this.connection
      .prepare(
        "delete from dependencies where project_root = ? and relative_path = ?",
      )
      .run(this.projectRoot, relativePath)
    this.connection
      .prepare(
        "delete from dirty_files where project_root = ? and relative_path = ?",
      )
      .run(this.projectRoot, relativePath)
  }

  commitIndexRun = ({
    generation,
    indexedFiles,
    reusedFiles,
    removedPaths,
  }: {
    generation: number
    indexedFiles: IndexedFileData[]
    reusedFiles: NormalizedFileRecord[]
    removedPaths: string[]
  }) => {
    const transaction = this.connection.transaction(() => {
      for (const relativePath of removedPaths) {
        this.deleteFileRows(relativePath)
      }

      const updateReusedFile = this.connection.prepare(
        `
          update files
          set
            size = ?,
            mtime_ms = ?,
            last_seen_generation = ?
          where project_root = ? and relative_path = ?
        `,
      )

      for (const file of reusedFiles) {
        updateReusedFile.run(
          file.size,
          file.mtimeMs,
          generation,
          this.projectRoot,
          file.relativePath,
        )
      }

      const upsertFile = this.connection.prepare(
        `
          insert into files (
            project_root,
            relative_path,
            language,
            content_hash,
            blob_hash,
            size,
            mtime_ms,
            parse_source,
            last_seen_generation,
            indexed_generation,
            symbol_count,
            reference_count
          )
          values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          on conflict(project_root, relative_path) do update set
            language = excluded.language,
            content_hash = excluded.content_hash,
            blob_hash = excluded.blob_hash,
            size = excluded.size,
            mtime_ms = excluded.mtime_ms,
            parse_source = excluded.parse_source,
            last_seen_generation = excluded.last_seen_generation,
            indexed_generation = excluded.indexed_generation,
            symbol_count = excluded.symbol_count,
            reference_count = excluded.reference_count
        `,
      )

      const insertSymbol = this.connection.prepare(
        `
          insert into symbols (
            symbol_id,
            project_root,
            relative_path,
            language,
            name,
            kind,
            container_name,
            source,
            line,
            column_number,
            end_line,
            end_column
          )
          values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
      )

      const insertReference = this.connection.prepare(
        `
          insert into references_idx (
            project_root,
            relative_path,
            language,
            symbol_id,
            name,
            context,
            source,
            line,
            column_number
          )
          values (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
      )

      const insertDependency = this.connection.prepare(
        `
          insert into dependencies (
            project_root,
            relative_path,
            dependency_path,
            edge_kind,
            specifier
          )
          values (?, ?, ?, ?, ?)
        `,
      )

      for (const indexedFile of indexedFiles) {
        const { file } = indexedFile

        this.deleteFileRows(file.relativePath)

        upsertFile.run(
          this.projectRoot,
          file.relativePath,
          file.language,
          file.contentHash,
          file.blobHash,
          file.size,
          file.mtimeMs,
          file.parseSource,
          generation,
          generation,
          indexedFile.symbols.length,
          indexedFile.references.length,
        )

        for (const symbol of indexedFile.symbols) {
          insertSymbol.run(
            symbol.symbolId,
            this.projectRoot,
            symbol.relativePath,
            symbol.language,
            symbol.name,
            symbol.kind,
            symbol.containerName,
            symbol.source,
            symbol.line,
            symbol.column,
            symbol.endLine,
            symbol.endColumn,
          )
        }

        for (const reference of indexedFile.references) {
          insertReference.run(
            this.projectRoot,
            reference.relativePath,
            reference.language,
            reference.symbolId,
            reference.name,
            reference.context,
            reference.source,
            reference.line,
            reference.column,
          )
        }

        for (const dependency of indexedFile.dependencies) {
          insertDependency.run(
            this.projectRoot,
            dependency.relativePath,
            dependency.dependencyPath,
            dependency.edgeKind,
            dependency.specifier,
          )
        }
      }

      this.connection
        .prepare("delete from dirty_files where project_root = ?")
        .run(this.projectRoot)
      this.connection
        .prepare(
          `
            update projects
            set
              index_generation = ?,
              last_index_status = 'ready',
              last_index_completed_at = ?,
              updated_at = ?,
              last_error = null
            where project_root = ?
          `,
        )
        .run(generation, now(), now(), this.projectRoot)
    })

    transaction()
  }

  markIndexRunFailed = (errorMessage: string) => {
    this.connection
      .prepare(
        `
          update projects
          set
            last_index_status = 'failed',
            last_error = ?,
            updated_at = ?
          where project_root = ?
        `,
      )
      .run(errorMessage, now(), this.projectRoot)
  }

  listTrackedFiles = ({ scopePath }: { scopePath?: string } = {}) => {
    const rows = this.connection
      .prepare(
        `
          select
            relative_path,
            language,
            content_hash,
            blob_hash,
            size,
            mtime_ms,
            parse_source,
            indexed_generation,
            symbol_count,
            reference_count
          from files
          where project_root = ?
          order by relative_path asc
        `,
      )
      .all(this.projectRoot) as FileRow[]

    return rows.filter((row) =>
      scopeMatches({
        relativePath: row.relative_path,
        scopePath,
      }),
    )
  }

  listSemanticFiles = ({ languages }: { languages?: LanguageId[] } = {}) => {
    const languageSet = languages ? new Set(languages) : undefined

    return this.listTrackedFiles()
      .filter((row) => (languageSet ? languageSet.has(row.language) : true))
      .map((row) => row.relative_path)
  }

  getIndexStatus = () => {
    const projectState = this.getProjectState()
    const fileStats = this.connection
      .prepare(
        `
          select
            count(*) as file_count,
            coalesce(sum(symbol_count), 0) as symbol_count,
            coalesce(sum(reference_count), 0) as reference_count
          from files
          where project_root = ?
        `,
      )
      .get(this.projectRoot) as
      | {
          file_count: number
          symbol_count: number
          reference_count: number
        }
      | undefined

    const dirtyCountRow = this.connection
      .prepare(
        `
          select count(*) as dirty_count
          from dirty_files
          where project_root = ?
        `,
      )
      .get(this.projectRoot) as { dirty_count: number } | undefined

    return {
      indexGeneration: projectState.index_generation,
      status: projectState.last_index_status,
      lastIndexStartedAt: projectState.last_index_started_at,
      lastIndexCompletedAt: projectState.last_index_completed_at,
      lastError: projectState.last_error,
      fileCount: fileStats?.file_count ?? 0,
      symbolCount: fileStats?.symbol_count ?? 0,
      referenceCount: fileStats?.reference_count ?? 0,
      dirtyCount: dirtyCountRow?.dirty_count ?? 0,
    }
  }

  findSymbolById = (symbolId: string) =>
    this.connection
      .prepare(
        `
          select
            symbol_id,
            relative_path,
            language,
            name,
            kind,
            container_name,
            source,
            line,
            column_number,
            end_line,
            end_column
          from symbols
          where project_root = ? and symbol_id = ?
        `,
      )
      .get(this.projectRoot, symbolId) as SymbolRow | undefined

  findNearestSymbol = ({
    relativePath,
    line,
    column,
  }: {
    relativePath: string
    line: number
    column: number
  }) =>
    this.connection
      .prepare(
        `
          select
            symbol_id,
            relative_path,
            language,
            name,
            kind,
            container_name,
            source,
            line,
            column_number,
            end_line,
            end_column
          from symbols
          where
            project_root = ?
            and relative_path = ?
            and abs(line - ?) <= 3
          order by
            abs(line - ?) asc,
            abs(column_number - ?) asc
          limit 1
        `,
      )
      .get(this.projectRoot, relativePath, line, line, column) as
      | SymbolRow
      | undefined

  findSymbolsByName = ({
    name,
    scopePath,
    limit,
    languages,
  }: {
    name: string
    scopePath?: string
    limit: number
    languages?: LanguageId[]
  }) => {
    const languageSet = languages ? new Set(languages) : undefined

    return (
      this.connection
        .prepare(
          `
            select
              symbol_id,
              relative_path,
              language,
              name,
              kind,
              container_name,
              source,
              line,
              column_number,
              end_line,
              end_column
            from symbols
            where project_root = ? and name = ?
            order by
              case source when 'semantic' then 0 when 'tree-sitter' then 1 else 2 end asc,
              relative_path asc,
              line asc
            limit ?
          `,
        )
        .all(this.projectRoot, name, limit) as SymbolRow[]
    ).filter((row) => {
      if (languageSet && !languageSet.has(row.language)) {
        return false
      }

      return scopeMatches({
        relativePath: row.relative_path,
        scopePath,
      })
    })
  }

  findReferencesByName = ({
    name,
    scopePath,
    limit,
    languages,
  }: {
    name: string
    scopePath?: string
    limit: number
    languages?: LanguageId[]
  }) => {
    const languageSet = languages ? new Set(languages) : undefined

    return (
      this.connection
        .prepare(
          `
            select
              relative_path,
              language,
              symbol_id,
              name,
              context,
              source,
              line,
              column_number
            from references_idx
            where project_root = ? and name = ?
            order by
              case source when 'semantic' then 0 when 'tree-sitter' then 1 else 2 end asc,
              relative_path asc,
              line asc
            limit ?
          `,
        )
        .all(this.projectRoot, name, limit) as ReferenceRow[]
    ).filter((row) => {
      if (languageSet && !languageSet.has(row.language)) {
        return false
      }

      return scopeMatches({
        relativePath: row.relative_path,
        scopePath,
      })
    })
  }

  toSymbolRecord = (row: SymbolRow): NormalizedSymbolRecord => ({
    symbolId: row.symbol_id,
    relativePath: row.relative_path,
    language: row.language,
    name: row.name,
    kind: row.kind as NormalizedSymbolRecord["kind"],
    containerName: row.container_name,
    source: row.source as NormalizedSymbolRecord["source"],
    line: row.line,
    column: row.column_number,
    endLine: row.end_line,
    endColumn: row.end_column,
  })

  toReferenceRecord = (row: ReferenceRow): NormalizedReferenceRecord => ({
    relativePath: row.relative_path,
    language: row.language,
    symbolId: row.symbol_id,
    name: row.name,
    context: row.context,
    source: row.source as NormalizedReferenceRecord["source"],
    line: row.line,
    column: row.column_number,
  })

  close = () => {
    this.connection.close()
  }
}
