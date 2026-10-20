"""Read-only data access. Predefined, parameterized queries only - no LLM SQL."""
from __future__ import annotations

import os
import re
from typing import Any, Protocol

MAX_ROWS = 10
STATEMENT_TIMEOUT_MS = 3000
_SCHEMA_RE = re.compile(r"^[a-z_][a-z0-9_]{0,30}$")


class RepositoryError(Exception):
    """Raised when the data layer is unavailable (mapped to a safe message upstream)."""


class Repository(Protocol):
    def get_match(self, match_id: str) -> dict[str, Any] | None:
        """Fetch single match by ID."""
        raise NotImplementedError

    def get_match_statistics(self, match_id: str) -> dict[str, Any]:
        """Fetch match scorecard statistics."""
        raise NotImplementedError

    def list_recent_matches(self, limit: int) -> list[dict[str, Any]]:
        """List most recent matches."""
        raise NotImplementedError

    def search_rules(self, embedding: list[float], limit: int) -> list[dict[str, Any]]:
        """Search vector rules by embedding similarity."""
        raise NotImplementedError


# Columns deliberately exclude scorer_email (PII) and ai_summary.
_MATCH_COLS = (
    "id, team_a_name, team_b_name, total_overs, bat_first_team, team_a_score, team_a_wickets, "
    "team_a_overs, team_b_score, team_b_wickets, team_b_overs, status, match_winner, "
    "player_of_the_match, toss_winner, toss_decision, created_at"
)


class PostgresRepository:
    """psycopg-backed repository. A connection is cached per warm Lambda and
    re-opened if it has gone stale. Use a read-only DB role via AI_DATABASE_URL."""

    def __init__(self, dsn: str | None = None, schema: str | None = None):
        self._dsn = dsn or os.environ.get("AI_DATABASE_URL") or os.environ.get("DATABASE_URL")
        self._schema = (schema or os.environ.get("DB_SCHEMA") or "public").lower()
        if not self._dsn:
            raise RepositoryError("database not configured")
        if not _SCHEMA_RE.match(self._schema):
            raise RepositoryError("invalid schema name")
        self._conn = None

    def _connection(self):
        import psycopg

        if self._conn is not None and not self._conn.closed:
            try:
                self._conn.execute("SELECT 1")
                return self._conn
            except Exception:
                try:
                    self._conn.close()
                except Exception:
                    # Ignore connection close failure when re-establishing connection
                    pass
        try:
            self._conn = psycopg.connect(self._dsn, autocommit=True, connect_timeout=5)
        except Exception as exc:  # no DSN detail in the error
            raise RepositoryError("database unavailable") from exc
        return self._conn

    def _query(self, sql: str, params: tuple) -> list[dict[str, Any]]:
        from psycopg.rows import dict_row

        try:
            conn = self._connection()
            with conn.transaction():
                conn.execute("SET TRANSACTION READ ONLY")
                conn.execute(f"SET LOCAL statement_timeout = {STATEMENT_TIMEOUT_MS}")
                conn.execute(f"SET LOCAL search_path TO {self._schema}, public")
                with conn.cursor(row_factory=dict_row) as cur:
                    cur.execute(sql, params)
                    return cur.fetchall()
        except RepositoryError:
            raise
        except Exception as exc:
            raise RepositoryError("query failed") from exc

    def get_match(self, match_id):
        rows = self._query(f"SELECT {_MATCH_COLS} FROM matches WHERE id = %s", (match_id,))
        return rows[0] if rows else None

    def get_match_statistics(self, match_id):
        innings = self._query(
            "SELECT id, inning_number, batting_team_name, bowling_team_name, target, total_runs, "
            "total_wickets, overs, balls, is_completed FROM innings WHERE match_id = %s "
            "ORDER BY inning_number LIMIT 4",
            (match_id,),
        )
        batters = self._query(
            "SELECT i.inning_number, p.name, p.runs, p.balls_faced, p.fours, p.sixes, p.is_out "
            "FROM players p JOIN innings i ON i.id = p.inning_id WHERE i.match_id = %s "
            "ORDER BY p.runs DESC LIMIT %s",
            (match_id, MAX_ROWS),
        )
        bowlers = self._query(
            "SELECT i.inning_number, b.name, b.overs_completed, b.balls, b.runs_conceded, b.wickets "
            "FROM bowlers b JOIN innings i ON i.id = b.inning_id WHERE i.match_id = %s "
            "ORDER BY b.wickets DESC, b.runs_conceded ASC LIMIT %s",
            (match_id, MAX_ROWS),
        )
        return {"innings": innings, "topBatters": batters, "topBowlers": bowlers}

    def list_recent_matches(self, limit):
        limit = max(1, min(int(limit), MAX_ROWS))
        return self._query(
            f"SELECT {_MATCH_COLS} FROM matches ORDER BY created_at DESC LIMIT %s", (limit,)
        )

    def search_rules(self, embedding, limit):
        limit = max(1, min(int(limit), 8))
        vec = "[" + ",".join(f"{float(x):.8f}" for x in embedding) + "]"
        return self._query(
            "SELECT id, document_name, chunk_text FROM tournament_rules "
            "ORDER BY embedding <=> %s::public.vector LIMIT %s",
            (vec, limit),
        )
