import os
import json
import uuid
import asyncio
import logging
from typing import Any, Dict, List, Optional
from urllib.parse import urlparse, urlunparse, parse_qs, urlencode, quote

import psycopg
from psycopg.types.json import Jsonb
from psycopg_pool import AsyncConnectionPool

logger = logging.getLogger("engine.common.persistence")


def normalize_database_url(url: str) -> str:
    """
    Normalizes database URL by stripping or translating Prisma-specific query
    parameters like 'schema=public', which are not valid libpq parameters.
    Translates non-public 'schema=<name>' into libpq 'options=-c search_path=<name>'.
    """
    try:
        parsed = urlparse(url)
        if not parsed.scheme or not parsed.netloc:
            return url

        query_dict = parse_qs(parsed.query, keep_blank_values=True)
        schema = query_dict.pop("schema", None)

        # Remove Prisma-specific query parameters not recognized by libpq/psycopg
        for prisma_param in [
            "connection_limit",
            "pool_timeout",
            "pgbouncer",
            "statement_cache_size",
        ]:
            query_dict.pop(prisma_param, None)

        # If a non-public schema is specified, convert to libpq search_path option
        if schema and "options" not in query_dict:
            schema_name = schema[0]
            if schema_name and schema_name != "public":
                query_dict["options"] = [f"-c search_path={schema_name}"]

        flat_query = []
        for k, v_list in query_dict.items():
            for v in v_list:
                flat_query.append((k, v))

        new_query = (
            urlencode(flat_query, quote_via=quote) if flat_query else ""
        )
        return urlunparse(
            (
                parsed.scheme,
                parsed.netloc,
                parsed.path,
                parsed.params,
                new_query,
                parsed.fragment,
            )
        )
    except Exception as e:
        logger.debug(f"Failed to normalize database URL '{url}': {e}")
        return url


def _generate_candidate_urls(base_url: str) -> List[str]:
    """
    Generates candidate connection URLs to handle both Docker container networks
    and local host environments (e.g., swapping 'postgres:5432' with '127.0.0.1:5432'
    and 'localhost:5432'), with Prisma-specific parameters stripped.
    """
    normalized_base = normalize_database_url(base_url)
    candidates = [normalized_base]
    try:
        parsed = urlparse(normalized_base)
        hostname = parsed.hostname
        port = parsed.port or 5432

        if hostname == "postgres":
            # Running on host outside Docker network
            for alt_host in ["127.0.0.1", "localhost"]:
                netloc = f"{parsed.username}:{parsed.password}@{alt_host}:{port}" if parsed.username else f"{alt_host}:{port}"
                alt_url = urlunparse((parsed.scheme, netloc, parsed.path, parsed.params, parsed.query, parsed.fragment))
                if alt_url not in candidates:
                    candidates.append(alt_url)
        elif hostname in ("127.0.0.1", "localhost"):
            # Running inside Docker network
            netloc = f"{parsed.username}:{parsed.password}@postgres:{port}" if parsed.username else f"postgres:{port}"
            alt_url = urlunparse((parsed.scheme, netloc, parsed.path, parsed.params, parsed.query, parsed.fragment))
            if alt_url not in candidates:
                candidates.append(alt_url)
    except Exception as e:
        logger.debug(f"URL parsing exception for candidate generation: {e}")

    return candidates


class EnginePersister:
    """
    Production-grade persistence layer for Quickgent Engine.
    Handles conversation history retrieval, workflow state rehydration,
    and execution checkpoints directly via PostgreSQL.
    """

    def __init__(self, database_url: Optional[str] = None):
        self.raw_url = database_url or os.environ.get(
            "DATABASE_URL",
            "postgresql://tinku:randompassword@postgres:5432/quickgentdb",
        )
        self.candidate_urls = _generate_candidate_urls(self.raw_url)
        self.active_url: Optional[str] = None
        self.pool: Optional[AsyncConnectionPool] = None
        self.is_connected = False
        self._init_attempted = False

    async def initialize(self) -> bool:
        """
        Attempts to establish connection pool across candidate database URLs.
        Falls back gracefully if the database is offline or unreachable.
        """
        self._init_attempted = True
        for url in self.candidate_urls:
            # Mask password in logs
            display_url = url.split("@")[-1] if "@" in url else url
            logger.info(f"Attempting to initialize Postgres pool with: {display_url}")
            try:
                # Test connection before creating persistent pool with strict timeout
                async def _probe():
                    async with await psycopg.AsyncConnection.connect(url, connect_timeout=2) as conn:
                        async with conn.cursor() as cur:
                            await cur.execute("SELECT 1")
                            return await cur.fetchone()

                await asyncio.wait_for(_probe(), timeout=2.0)

                # Connection verified, configure AsyncConnectionPool with automatic connection health checking
                pool = AsyncConnectionPool(
                    conninfo=url,
                    min_size=1,
                    max_size=10,
                    open=False,
                    timeout=5.0,
                    check=AsyncConnectionPool.check_connection,
                )
                await pool.open(wait=True)
                self.pool = pool
                self.active_url = url
                self.is_connected = True
                logger.info(f"Successfully connected to PostgreSQL database at {display_url}")
                return True
            except Exception as e:
                logger.warning(f"Could not connect to database at {display_url}: {e}")

        logger.warning(
            "PostgreSQL database is currently unreachable. "
            "Engine will operate in graceful in-memory fallback mode."
        )
        self.is_connected = False
        return False

    async def ensure_connected(self) -> bool:
        """Ensures the pool is active, attempting initialization if not yet performed."""
        if self.is_connected and self.pool is not None:
            return True
        return await self.initialize()

    async def close(self) -> None:
        """Closes the connection pool gracefully."""
        if self.pool is not None:
            try:
                await self.pool.close()
                logger.info("Closed PostgreSQL connection pool.")
            except Exception as e:
                logger.error(f"Error closing PostgreSQL connection pool: {e}")
            finally:
                self.pool = None
                self.is_connected = False

    async def get_conversation_history(
        self,
        conversation_id: str,
        limit: int = 10,
    ) -> List[Dict[str, str]]:
        """
        Retrieves recent conversation messages for a conversation ID.
        Normalizes roles ('USER' -> 'user', 'ASSISTANT' -> 'assistant')
        and extracts plain text message content.
        """
        if not conversation_id:
            return []

        if not await self.ensure_connected() or self.pool is None:
            return []

        query = """
            SELECT "role", "content"
            FROM "messages"
            WHERE "conversationId" = %s
            ORDER BY "createdAt" DESC
            LIMIT %s
        """
        try:
            async with self.pool.connection() as conn:
                async with conn.cursor() as cur:
                    await cur.execute(query, (conversation_id, limit))
                    rows = await cur.fetchall()

            # Reverse to get chronological order (oldest to newest)
            chronological_rows = list(reversed(rows))
            history: List[Dict[str, str]] = []

            for role_enum, content_data in chronological_rows:
                # Normalize role
                role_str = str(role_enum).lower()
                if "user" in role_str:
                    clean_role = "user"
                elif "assistant" in role_str:
                    clean_role = "assistant"
                elif "system" in role_str:
                    clean_role = "system"
                else:
                    clean_role = "user"

                # Extract text from jsonb or string content
                if isinstance(content_data, dict):
                    text = (
                        content_data.get("text")
                        or content_data.get("message")
                        or content_data.get("reply")
                        or json.dumps(content_data)
                    )
                elif isinstance(content_data, str):
                    try:
                        parsed = json.loads(content_data)
                        if isinstance(parsed, dict):
                            text = (
                                parsed.get("text")
                                or parsed.get("message")
                                or parsed.get("reply")
                                or content_data
                            )
                        else:
                            text = str(parsed)
                    except Exception:
                        text = content_data
                else:
                    text = str(content_data)

                history.append({"role": clean_role, "content": str(text)})

            logger.info(
                f"Retrieved {len(history)} messages from DB for conversation {conversation_id}"
            )
            return history
        except Exception as e:
            logger.error(
                f"Failed to fetch conversation history for {conversation_id}: {e}",
                exc_info=True,
            )
            return []

    async def get_latest_checkpoint_state(
        self,
        session_id: str,
        workflow_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Rehydrates state variables from the most recent workflow execution
        belonging to this session (or workflow).
        """
        if not session_id:
            return {}

        if not await self.ensure_connected() or self.pool is None:
            return {}

        # 1. Search for executions where inputs or state contains session_id
        query = """
            SELECT "state"
            FROM "workflow_executions"
            WHERE ("inputs"->>'session_id' = %s OR "state"->>'session_id' = %s)
            ORDER BY "created_at" DESC
            LIMIT 1
        """
        try:
            async with self.pool.connection() as conn:
                async with conn.cursor() as cur:
                    await cur.execute(query, (session_id, session_id))
                    row = await cur.fetchone()

                    if row and row[0]:
                        state_val = row[0]
                        if isinstance(state_val, str):
                            try:
                                state_val = json.loads(state_val)
                            except Exception:
                                pass
                        if isinstance(state_val, dict):
                            logger.info(
                                f"Rehydrated state ({len(state_val)} keys) from checkpoint for session {session_id}"
                            )
                            return state_val

                    # 2. If session_id matches a conversation ID with an attached workflow
                    conv_query = """
                        SELECT "workflow_id"
                        FROM "conversations"
                        WHERE "id" = %s
                        LIMIT 1
                    """
                    await cur.execute(conv_query, (session_id,))
                    conv_row = await cur.fetchone()
                    resolved_wf_id = workflow_id or (conv_row[0] if conv_row else None)

                    if resolved_wf_id:
                        wf_exec_query = """
                            SELECT "state"
                            FROM "workflow_executions"
                            WHERE "workflow_id" = %s
                            ORDER BY "created_at" DESC
                            LIMIT 1
                        """
                        await cur.execute(wf_exec_query, (resolved_wf_id,))
                        wf_row = await cur.fetchone()
                        if wf_row and wf_row[0]:
                            state_val = wf_row[0]
                            if isinstance(state_val, str):
                                try:
                                    state_val = json.loads(state_val)
                                except Exception:
                                    pass
                            if isinstance(state_val, dict):
                                logger.info(
                                    f"Rehydrated state ({len(state_val)} keys) from workflow {resolved_wf_id}"
                                )
                                return state_val

            return {}
        except Exception as e:
            logger.error(
                f"Failed to fetch checkpoint state for session {session_id}: {e}",
                exc_info=True,
            )
            return {}

    async def save_execution_checkpoint(
        self,
        execution_id: str,
        workflow_id: str,
        project_id: str,
        status: str,
        inputs: Dict[str, Any],
        outputs: Dict[str, Any],
        state: Dict[str, Any],
        trace: List[Any],
        duration_ms: int = 0,
        total_tokens: int = 0,
    ) -> bool:
        """
        Directly persists workflow execution outcome, traces, and state checkpoints.
        """
        if not await self.ensure_connected() or self.pool is None:
            return False

        query = """
            INSERT INTO "workflow_executions" (
                "id", "workflow_id", "project_id", "status",
                "inputs", "outputs", "state", "trace",
                "duration_ms", "total_tokens", "created_at"
            ) VALUES (
                %s, %s, %s, %s,
                %s, %s, %s, %s,
                %s, %s, NOW()
            )
            ON CONFLICT ("id") DO UPDATE SET
                "status" = EXCLUDED."status",
                "outputs" = EXCLUDED."outputs",
                "state" = EXCLUDED."state",
                "trace" = EXCLUDED."trace",
                "duration_ms" = EXCLUDED."duration_ms",
                "total_tokens" = EXCLUDED."total_tokens"
        """
        try:
            # Convert traces to json-serializable dicts if they are Pydantic models
            serializable_trace = []
            for t in trace:
                if hasattr(t, "model_dump"):
                    serializable_trace.append(t.model_dump())
                elif hasattr(t, "dict"):
                    serializable_trace.append(t.dict())
                elif isinstance(t, dict):
                    serializable_trace.append(t)
                else:
                    serializable_trace.append(str(t))

            async with self.pool.connection() as conn:
                async with conn.cursor() as cur:
                    # Guard against ForeignKeyViolation if workflow_id does not exist in workflows table
                    await cur.execute('SELECT "id" FROM "workflows" WHERE "id" = %s', (workflow_id,))
                    if not await cur.fetchone():
                        logger.warning(
                            f"Skipping checkpoint save: workflow_id '{workflow_id}' does not exist in 'workflows' table (draft canvas run)."
                        )
                        return False

                    await cur.execute(
                        query,
                        (
                            execution_id,
                            workflow_id,
                            project_id,
                            status,
                            Jsonb(inputs or {}),
                            Jsonb(outputs or {}),
                            Jsonb(state or {}),
                            Jsonb(serializable_trace),
                            duration_ms,
                            total_tokens,
                        ),
                    )
            logger.info(f"Saved execution checkpoint {execution_id} to workflow_executions")
            return True
        except Exception as e:
            logger.error(
                f"Failed to persist execution checkpoint {execution_id}: {e}",
                exc_info=True,
            )
            return False

    async def save_message(
        self,
        conversation_id: str,
        role: str,
        content: Any,
        metadata: Optional[Dict[str, Any]] = None,
        model: Optional[str] = None,
        tokens: Optional[int] = None,
    ) -> Optional[str]:
        """
        Persists a message directly to the messages table.
        """
        if not conversation_id:
            return None

        if not await self.ensure_connected() or self.pool is None:
            return None

        msg_id = str(uuid.uuid4())
        # Format role enum ('USER', 'ASSISTANT', 'SYSTEM', 'TOOL')
        role_upper = role.upper()
        if role_upper not in ("USER", "ASSISTANT", "SYSTEM", "TOOL"):
            role_upper = "ASSISTANT"

        # Format content JSONB
        if isinstance(content, str):
            content_json = {"text": content}
        elif isinstance(content, dict):
            content_json = content
        else:
            content_json = {"text": str(content)}

        query = """
            INSERT INTO "messages" (
                "id", "conversationId", "role", "content", "metadata",
                "model", "outputTokens", "createdAt", "updatedAt"
            ) VALUES (
                %s, %s, %s::"MessageRole", %s, %s,
                %s, %s, NOW(), NOW()
            )
        """
        try:
            async with self.pool.connection() as conn:
                async with conn.cursor() as cur:
                    await cur.execute(
                        query,
                        (
                            msg_id,
                            conversation_id,
                            role_upper,
                            Jsonb(content_json),
                            Jsonb(metadata or {}),
                            model,
                            tokens,
                        ),
                    )
            logger.info(f"Saved {role_upper} message {msg_id} for conversation {conversation_id}")
            return msg_id
        except Exception as e:
            logger.error(
                f"Failed to save message for conversation {conversation_id}: {e}",
                exc_info=True,
            )
            return None

    async def get_conversation(self, conversation_id: str) -> Optional[Dict[str, Any]]:
        """
        Fetches conversation metadata including associated workflow_id and project_id.
        """
        if not conversation_id:
            return None

        if not await self.ensure_connected() or self.pool is None:
            return None

        query = """
            SELECT "id", "name", "projectId", "workflow_id", "workflow_version", "is_live", "isActive"
            FROM "conversations"
            WHERE "id" = %s
            LIMIT 1
        """
        try:
            async with self.pool.connection() as conn:
                async with conn.cursor() as cur:
                    await cur.execute(query, (conversation_id,))
                    row = await cur.fetchone()
                    if not row:
                        return None
                    return {
                        "id": row[0],
                        "name": row[1],
                        "project_id": row[2],
                        "workflow_id": row[3],
                        "workflow_version": row[4],
                        "is_live": row[5],
                        "is_active": row[6],
                    }
        except Exception as e:
            logger.error(f"Failed to get conversation {conversation_id}: {e}", exc_info=True)
            return None

    async def get_langgraph_checkpointer(self):
        """
        Returns an instance of AsyncPostgresSaver configured with the current pool
        for native LangGraph multi-turn checkpointing.
        """
        if not await self.ensure_connected() or self.pool is None:
            return None

        try:
            from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver
            checkpointer = AsyncPostgresSaver(self.pool)
            await checkpointer.setup()
            return checkpointer
        except Exception as e:
            logger.warning(f"Could not initialize AsyncPostgresSaver: {e}")
            return None


# Global singleton instance
_persister_instance: Optional[EnginePersister] = None


def get_persister() -> EnginePersister:
    """Returns the singleton EnginePersister instance."""
    global _persister_instance
    if _persister_instance is None:
        _persister_instance = EnginePersister()
    return _persister_instance


async def init_persister() -> EnginePersister:
    """Initializes and connects the global persister instance."""
    persister = get_persister()
    await persister.initialize()
    return persister


async def close_persister() -> None:
    """Gracefully shuts down the global persister pool."""
    global _persister_instance
    if _persister_instance is not None:
        await _persister_instance.close()
        _persister_instance = None
