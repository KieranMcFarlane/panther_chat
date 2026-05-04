import os
import re
from dataclasses import dataclass
from datetime import date, datetime
from decimal import Decimal
from typing import Any, Dict, Iterable, List, Optional, Sequence, Tuple
from uuid import UUID

import psycopg
from psycopg.rows import dict_row
from psycopg.types.json import Jsonb


_IDENTIFIER_RE = re.compile(r"^[A-Za-z_][A-Za-z0-9_]*$")


@dataclass
class LocalPgResponse:
    data: Any


def should_use_local_pg() -> bool:
    backend = str(os.getenv("PYTHON_PERSISTENCE_BACKEND") or "").strip().lower()
    if backend in {"supabase", "hosted_supabase", "remote_supabase"}:
        return False
    if str(os.getenv("SUPABASE_FORCE_REMOTE") or "").strip().lower() in {"1", "true", "yes"}:
        return False
    return bool(str(os.getenv("DATABASE_URL") or "").strip())


def create_local_pg_client(database_url: Optional[str] = None) -> "LocalPgClient":
    return LocalPgClient(database_url or os.getenv("DATABASE_URL") or "")


def _quote_identifier(identifier: str) -> str:
    if not _IDENTIFIER_RE.match(identifier):
        raise ValueError(f"Unsupported SQL identifier: {identifier!r}")
    return f'"{identifier}"'


def _normalize_value(value: Any) -> Any:
    if isinstance(value, (dict, list)):
        return Jsonb(value)
    return value


def _serialize_value(value: Any) -> Any:
    if isinstance(value, Jsonb):
        return value.obj
    if isinstance(value, (datetime, date, UUID)):
        return str(value)
    if isinstance(value, Decimal):
        return float(value)
    if isinstance(value, list):
        return [_serialize_value(item) for item in value]
    if isinstance(value, dict):
        return {key: _serialize_value(item) for key, item in value.items()}
    return value


def _serialize_rows(rows: Sequence[Dict[str, Any]]) -> List[Dict[str, Any]]:
    return [{key: _serialize_value(value) for key, value in row.items()} for row in rows]


class LocalPgClient:
    def __init__(self, database_url: str):
        if not database_url:
            raise RuntimeError("DATABASE_URL is required for local Postgres persistence")
        self.database_url = database_url

    def table(self, table_name: str) -> "LocalPgQuery":
        return LocalPgQuery(self, table_name)

    def rpc(self, function_name: str, params: Optional[Dict[str, Any]] = None) -> "LocalPgRpc":
        return LocalPgRpc(self, function_name, params or {})

    def _connect(self):
        return psycopg.connect(self.database_url, row_factory=dict_row)


class LocalPgQuery:
    def __init__(self, client: LocalPgClient, table_name: str):
        self.client = client
        self.table_name = table_name
        self.action = "select"
        self.columns = "*"
        self.payload: Any = None
        self.filters: List[Tuple[str, str, Any]] = []
        self.order_column: Optional[str] = None
        self.order_descending = False
        self.limit_count: Optional[int] = None
        self.offset_count: Optional[int] = None
        self.conflict_columns: List[str] = []

    def select(self, columns: str = "*") -> "LocalPgQuery":
        self.action = "select"
        self.columns = columns or "*"
        return self

    def insert(self, payload: Any) -> "LocalPgQuery":
        self.action = "insert"
        self.payload = payload
        return self

    def update(self, payload: Dict[str, Any]) -> "LocalPgQuery":
        self.action = "update"
        self.payload = payload
        return self

    def upsert(self, payload: Any, on_conflict: Optional[str] = None) -> "LocalPgQuery":
        self.action = "upsert"
        self.payload = payload
        self.conflict_columns = [
            column.strip() for column in str(on_conflict or "id").split(",") if column.strip()
        ]
        if self.table_name == "entity_dossiers" and self.conflict_columns == ["canonical_entity_id"]:
            self.conflict_columns = ["entity_id"]
        return self

    def eq(self, column: str, value: Any) -> "LocalPgQuery":
        self.filters.append((column, "=", value))
        return self

    def neq(self, column: str, value: Any) -> "LocalPgQuery":
        self.filters.append((column, "!=", value))
        return self

    def gte(self, column: str, value: Any) -> "LocalPgQuery":
        self.filters.append((column, ">=", value))
        return self

    def lte(self, column: str, value: Any) -> "LocalPgQuery":
        self.filters.append((column, "<=", value))
        return self

    def in_(self, column: str, values: Iterable[Any]) -> "LocalPgQuery":
        self.filters.append((column, "in", list(values)))
        return self

    def contains(self, column: str, value: Any) -> "LocalPgQuery":
        self.filters.append((column, "contains", value))
        return self

    def or_(self, _expression: str) -> "LocalPgQuery":
        return self

    def order(self, column: str, desc: bool = False, **_kwargs: Any) -> "LocalPgQuery":
        self.order_column = column
        self.order_descending = bool(desc)
        return self

    def limit(self, count: int) -> "LocalPgQuery":
        self.limit_count = int(count)
        return self

    def range(self, start: int, end: int) -> "LocalPgQuery":
        start_index = max(int(start), 0)
        end_index = max(int(end), start_index - 1)
        self.offset_count = start_index
        self.limit_count = max(end_index - start_index + 1, 0)
        return self

    def maybe_single(self) -> LocalPgResponse:
        response = self.limit(1).execute()
        rows = response.data or []
        return LocalPgResponse(rows[0] if rows else None)

    def single(self) -> Any:
        response = self.limit(1).execute()
        rows = response.data or []
        if not rows:
            raise RuntimeError("No rows returned")
        return rows[0]

    def execute(self) -> LocalPgResponse:
        if self.action == "select":
            return self._execute_select()
        if self.action == "insert":
            return self._execute_insert(upsert=False)
        if self.action == "upsert":
            return self._execute_insert(upsert=True)
        if self.action == "update":
            return self._execute_update()
        raise ValueError(f"Unsupported query action: {self.action}")

    def _select_columns_sql(self) -> str:
        if str(self.columns).strip() == "*":
            return "*"
        columns = [column.strip() for column in str(self.columns).split(",") if column.strip()]
        return ", ".join(_quote_identifier(column) for column in columns) if columns else "*"

    def _filter_sql(self) -> Tuple[str, List[Any]]:
        clauses: List[str] = []
        params: List[Any] = []
        for column, operator, value in self.filters:
            column_sql = _quote_identifier(column)
            if operator == "in":
                values = list(value or [])
                if not values:
                    clauses.append("false")
                    continue
                placeholders = ", ".join(["%s"] * len(values))
                clauses.append(f"{column_sql} IN ({placeholders})")
                params.extend(values)
            elif operator == "contains":
                if isinstance(value, list):
                    clauses.append(f"{column_sql} @> %s::text[]")
                    params.append(value)
                else:
                    clauses.append(f"{column_sql} @> %s::jsonb")
                    params.append(_normalize_value(value))
            else:
                clauses.append(f"{column_sql} {operator} %s")
                params.append(_normalize_value(value))
        return (" WHERE " + " AND ".join(clauses), params) if clauses else ("", [])

    def _execute_select(self) -> LocalPgResponse:
        table_sql = _quote_identifier(self.table_name)
        where_sql, params = self._filter_sql()
        sql = f"SELECT {self._select_columns_sql()} FROM {table_sql}{where_sql}"
        if self.order_column:
            direction = "DESC" if self.order_descending else "ASC"
            sql += f" ORDER BY {_quote_identifier(self.order_column)} {direction}"
        if self.limit_count is not None:
            sql += " LIMIT %s"
            params.append(self.limit_count)
        if self.offset_count is not None:
            sql += " OFFSET %s"
            params.append(self.offset_count)
        with self.client._connect() as conn:
            with conn.cursor() as cur:
                cur.execute(sql, params)
                rows = cur.fetchall()
        return LocalPgResponse(_serialize_rows(rows))

    def _payload_rows(self) -> List[Dict[str, Any]]:
        if isinstance(self.payload, list):
            return [row for row in self.payload if isinstance(row, dict)]
        if isinstance(self.payload, dict):
            return [self.payload]
        raise ValueError("Insert/upsert payload must be a dict or list of dicts")

    def _execute_insert(self, *, upsert: bool) -> LocalPgResponse:
        rows = self._payload_rows()
        if not rows:
            return LocalPgResponse([])
        columns = list(rows[0].keys())
        table_sql = _quote_identifier(self.table_name)
        column_sql = ", ".join(_quote_identifier(column) for column in columns)
        placeholders = "(" + ", ".join(["%s"] * len(columns)) + ")"
        values_sql = ", ".join([placeholders] * len(rows))
        params = [_normalize_value(row.get(column)) for row in rows for column in columns]
        sql = f"INSERT INTO {table_sql} ({column_sql}) VALUES {values_sql}"
        if upsert:
            conflict_sql = ", ".join(_quote_identifier(column) for column in self.conflict_columns)
            update_columns = [column for column in columns if column not in set(self.conflict_columns)]
            update_sql = ", ".join(
                f"{_quote_identifier(column)} = EXCLUDED.{_quote_identifier(column)}"
                for column in update_columns
            )
            sql += f" ON CONFLICT ({conflict_sql}) DO UPDATE SET {update_sql}" if update_sql else f" ON CONFLICT ({conflict_sql}) DO NOTHING"
        sql += " RETURNING *"
        with self.client._connect() as conn:
            with conn.cursor() as cur:
                cur.execute(sql, params)
                rows = cur.fetchall()
        return LocalPgResponse(_serialize_rows(rows))

    def _execute_update(self) -> LocalPgResponse:
        if not isinstance(self.payload, dict) or not self.payload:
            return LocalPgResponse([])
        table_sql = _quote_identifier(self.table_name)
        columns = list(self.payload.keys())
        set_sql = ", ".join(f"{_quote_identifier(column)} = %s" for column in columns)
        params = [_normalize_value(self.payload[column]) for column in columns]
        where_sql, where_params = self._filter_sql()
        sql = f"UPDATE {table_sql} SET {set_sql}{where_sql} RETURNING *"
        with self.client._connect() as conn:
            with conn.cursor() as cur:
                cur.execute(sql, [*params, *where_params])
                rows = cur.fetchall()
        return LocalPgResponse(_serialize_rows(rows))


class LocalPgRpc:
    def __init__(self, client: LocalPgClient, function_name: str, params: Dict[str, Any]):
        self.client = client
        self.function_name = function_name
        self.params = params

    def execute(self) -> LocalPgResponse:
        handler = getattr(self, f"_execute_{self.function_name}", None)
        if not handler:
            raise ValueError(f"Unsupported local Postgres RPC: {self.function_name}")
        return handler()

    def _execute_claim_next_entity_import_batch(self) -> LocalPgResponse:
        worker_id = str(self.params.get("worker_id") or "")
        lease_seconds = int(self.params.get("lease_seconds") or 300)
        with self.client._connect() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    WITH next_batch AS (
                        SELECT id
                        FROM entity_import_batches
                        WHERE status = 'queued'
                          AND completed_at IS NULL
                        ORDER BY
                          CASE
                            WHEN metadata->>'source' = 'question_first_timeout_continuation' THEN 0
                            WHEN metadata->>'source' = 'entity_dossier_operator_rerun'
                              AND metadata->>'rerun_mode' = 'question' THEN 1
                            WHEN metadata->>'source' = 'self_healing_repair'
                              AND metadata->>'rerun_mode' = 'question'
                              AND metadata->>'question_id' IN (
                                'q11_decision_owner',
                                'q12_connections',
                                'q13_capability_gap',
                                'q14_yp_fit',
                                'q15_outreach_strategy'
                              ) THEN 2
                            ELSE 3
                          END,
                          started_at ASC
                        LIMIT 1
                        FOR UPDATE SKIP LOCKED
                    )
                    UPDATE entity_import_batches AS batch
                    SET status = 'running',
                        metadata = coalesce(batch.metadata, '{}'::jsonb)
                            || jsonb_build_object(
                                'worker_id', (%s)::text,
                                'lease_expires_at', (now() + make_interval(secs => %s))::text,
                                'claimed_at', now()::text
                            )
                    FROM next_batch
                    WHERE batch.id = next_batch.id
                    RETURNING batch.*
                    """,
                    [worker_id, lease_seconds],
                )
                rows = cur.fetchall()
        return LocalPgResponse(_serialize_rows(rows))

    def _execute_select_next_entity_cursor_candidate(self) -> LocalPgResponse:
        current_entity_id = str(self.params.get("current_entity_id") or "")
        current_canonical_entity_id = str(self.params.get("current_canonical_entity_id") or "").strip() or None
        with self.client._connect() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    WITH latest_runs AS (
                        SELECT *
                        FROM (
                            SELECT
                                r.*,
                                row_number() OVER (
                                    PARTITION BY coalesce(r.canonical_entity_id::text, r.entity_id::text)
                                    ORDER BY coalesce(r.completed_at, r.started_at) DESC NULLS LAST
                                ) AS row_number_rank
                            FROM entity_pipeline_runs AS r
                        ) ranked_runs
                        WHERE row_number_rank = 1
                    ),
                    resumable_runs AS (
                        SELECT
                            CASE
                                WHEN coalesce(r.metadata->>'next_repair_question_id', '') <> '' THEN 'resume_repair'
                                ELSE 'resume_entity'
                            END AS candidate_kind,
                            r.entity_id::text AS entity_id,
                            r.canonical_entity_id::text AS canonical_entity_id,
                            r.entity_name,
                            coalesce(r.metadata->>'entity_type', 'ENTITY') AS entity_type,
                            nullif(r.metadata->>'next_repair_question_id', '') AS question_id,
                            nullif(r.metadata->>'current_question_id', '') AS current_question_id,
                            nullif(r.metadata->>'next_repair_question_id', '') AS next_repair_question_id,
                            0 AS priority_rank
                        FROM latest_runs AS r
                        WHERE (
                            r.entity_id <> %s
                            AND (%s::uuid IS NULL OR r.canonical_entity_id IS DISTINCT FROM %s::uuid)
                        )
                          AND r.status IN ('running', 'retrying', 'failed')
                          AND coalesce(r.metadata->>'continue_pipeline_on_failure', 'false') <> 'true'
                          AND coalesce(r.metadata->>'infrastructure_failure', 'false') <> 'true'
                          AND coalesce(r.metadata->>'failure_class', '') <> 'backend_route_missing'
                          AND coalesce(r.metadata->>'failure_class', '') <> 'entity_pipeline_timeout'
                          AND (
                            coalesce(r.metadata->>'current_question_id', '') <> ''
                            OR coalesce(r.metadata->>'next_repair_question_id', '') <> ''
                          )
                        ORDER BY
                            CASE
                                WHEN coalesce(r.metadata->>'next_repair_question_id', '') <> '' THEN 0
                                ELSE 1
                            END,
                            coalesce(r.completed_at, r.started_at) DESC NULLS LAST
                        LIMIT 1
                    ),
                    next_entities AS (
                        SELECT
                            'next_entity' AS candidate_kind,
                            c.id::text AS entity_id,
                            c.id::text AS canonical_entity_id,
                            c.name AS entity_name,
                            coalesce(c.entity_type, 'ENTITY') AS entity_type,
                            null::text AS question_id,
                            null::text AS current_question_id,
                            null::text AS next_repair_question_id,
                            1 AS priority_rank
                        FROM canonical_entities AS c
                        WHERE (%s::uuid IS NULL OR c.id <> %s::uuid)
                          AND c.id::text <> %s
                        ORDER BY c.id ASC
                        LIMIT 1
                    )
                    SELECT
                        candidate_kind,
                        entity_id,
                        canonical_entity_id,
                        entity_name,
                        entity_type,
                        question_id,
                        current_question_id,
                        next_repair_question_id
                    FROM (
                        SELECT * FROM resumable_runs
                        UNION ALL
                        SELECT * FROM next_entities
                    ) AS candidates
                    ORDER BY priority_rank ASC
                    LIMIT 1
                    """,
                    [
                        current_entity_id,
                        current_canonical_entity_id,
                        current_canonical_entity_id,
                        current_canonical_entity_id,
                        current_canonical_entity_id,
                        current_entity_id,
                    ],
                )
                rows = cur.fetchall()
        return LocalPgResponse(_serialize_rows(rows))

    def _execute_requeue_stale_entity_import_batches(self) -> LocalPgResponse:
        stale_before = self.params.get("stale_before")
        with self.client._connect() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    UPDATE entity_import_batches
                    SET status = 'queued',
                        metadata = coalesce(metadata, '{}'::jsonb)
                            || jsonb_build_object('requeued_at', now()::text, 'requeue_reason', 'stale_lease')
                    WHERE status = 'running'
                      AND completed_at IS NULL
                      AND coalesce((metadata->>'lease_expires_at')::timestamptz, started_at) < %s::timestamptz
                    RETURNING *
                    """,
                    [stale_before],
                )
                rows = cur.fetchall()
        return LocalPgResponse(_serialize_rows(rows))

    def _execute_renew_entity_import_batch_lease(self) -> LocalPgResponse:
        batch_id = str(self.params.get("batch_id") or "")
        worker_id = str(self.params.get("worker_id") or "")
        lease_seconds = int(self.params.get("lease_seconds") or 300)
        with self.client._connect() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    UPDATE entity_import_batches
                    SET metadata = coalesce(metadata, '{}'::jsonb)
                        || jsonb_build_object(
                            'worker_id', (%s)::text,
                            'lease_expires_at', (now() + make_interval(secs => %s))::text,
                            'heartbeat_at', now()::text
                        )
                    WHERE id = %s
                    RETURNING *
                    """,
                    [worker_id, lease_seconds, batch_id],
                )
                rows = cur.fetchall()
        return LocalPgResponse(_serialize_rows(rows))

    def _execute_complete_entity_import_batch(self) -> LocalPgResponse:
        batch_id = str(self.params.get("batch_id") or "")
        worker_id = str(self.params.get("worker_id") or "")
        with self.client._connect() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    UPDATE entity_import_batches
                    SET status = 'completed',
                        completed_at = now(),
                        metadata = coalesce(metadata, '{}'::jsonb)
                            || jsonb_build_object('worker_id', (%s)::text, 'completed_at', now()::text)
                    WHERE id = %s
                    RETURNING *
                    """,
                    [worker_id, batch_id],
                )
                rows = cur.fetchall()
        return LocalPgResponse(_serialize_rows(rows))

    def _execute_fail_entity_pipeline_run(self) -> LocalPgResponse:
        batch_id = str(self.params.get("batch_id") or "")
        entity_id = str(self.params.get("entity_id") or "")
        error_message = str(self.params.get("error_message") or "")
        retryable = bool(self.params.get("retryable"))
        status = "retrying" if retryable else "failed"
        with self.client._connect() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    UPDATE entity_pipeline_runs
                    SET status = %s,
                        error_message = %s,
                        completed_at = CASE WHEN %s THEN NULL ELSE now() END,
                        metadata = coalesce(metadata, '{}'::jsonb)
                            || jsonb_build_object('last_error', (%s)::text, 'retryable', (%s)::boolean)
                    WHERE batch_id = %s
                      AND entity_id = %s
                    RETURNING *
                    """,
                    [status, error_message, retryable, error_message, retryable, batch_id, entity_id],
                )
                rows = cur.fetchall()
        return LocalPgResponse(_serialize_rows(rows))
