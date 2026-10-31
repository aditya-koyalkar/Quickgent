import asyncio
from unittest.mock import AsyncMock, MagicMock
from contextlib import asynccontextmanager
from engine.common.persistence import EnginePersister, _generate_candidate_urls


def test_candidates():
    import psycopg
    urls = _generate_candidate_urls(
        "postgresql://tinku:pass@postgres:5432/quickgentdb?schema=public"
    )
    assert len(urls) == 3, f"Expected 3 urls, got {urls}"
    assert any("127.0.0.1:5432" in u for u in urls)
    assert any("localhost:5432" in u for u in urls)
    # Ensure prisma query parameter 'schema=public' is stripped and psycopg parses cleanly
    for u in urls:
        assert "schema=" not in u, f"URL still has schema parameter: {u}"
        parsed = psycopg.conninfo.conninfo_to_dict(u)
        assert parsed["user"] == "tinku"
    print("PASS: test_candidates")


async def test_offline_fallback():
    persister = EnginePersister()
    persister.is_connected = False
    persister.pool = None
    persister.initialize = AsyncMock(return_value=False)

    hist = await persister.get_conversation_history("conv-1")
    assert hist == []

    st = await persister.get_latest_checkpoint_state("sess-1")
    assert st == {}

    saved = await persister.save_execution_checkpoint(
        "e1", "w1", "p1", "completed", {}, {}, {}, []
    )
    assert saved is False
    print("PASS: test_offline_fallback")


async def test_mock_query_and_mapping():
    persister = EnginePersister()
    persister.is_connected = True

    mock_cur = AsyncMock()
    mock_cur.fetchall.return_value = [
        ("USER", {"text": "Hello agent"}),
        ("ASSISTANT", {"text": "Hello human"}),
    ]

    @asynccontextmanager
    async def mock_cursor_cm(*args, **kwargs):
        yield mock_cur

    mock_conn = MagicMock()
    mock_conn.cursor = mock_cursor_cm

    @asynccontextmanager
    async def mock_conn_cm(*args, **kwargs):
        yield mock_conn

    mock_pool = MagicMock()
    mock_pool.connection = mock_conn_cm
    persister.pool = mock_pool

    hist = await persister.get_conversation_history("conv-123")
    assert len(hist) == 2
    # Chronological: oldest first (reversed from descending)
    assert hist[0] == {"role": "assistant", "content": "Hello human"}
    assert hist[1] == {"role": "user", "content": "Hello agent"}
    print("PASS: test_mock_query_and_mapping")


async def test_mock_checkpoint_save():
    persister = EnginePersister()
    persister.is_connected = True

    mock_cur = AsyncMock()

    @asynccontextmanager
    async def mock_cursor_cm(*args, **kwargs):
        yield mock_cur

    mock_conn = MagicMock()
    mock_conn.cursor = mock_cursor_cm

    @asynccontextmanager
    async def mock_conn_cm(*args, **kwargs):
        yield mock_conn

    mock_pool = MagicMock()
    mock_pool.connection = mock_conn_cm
    persister.pool = mock_pool

    saved = await persister.save_execution_checkpoint(
        execution_id="e100",
        workflow_id="w100",
        project_id="p100",
        status="completed",
        inputs={"user_message": "hi"},
        outputs={"response": "ok"},
        state={"status": "ok"},
        trace=[],
    )
    assert saved is True
    assert mock_cur.execute.called
    print("PASS: test_mock_checkpoint_save")


async def run_all_async():
    await test_offline_fallback()
    await test_mock_query_and_mapping()
    await test_mock_checkpoint_save()


def main():
    test_candidates()
    asyncio.run(run_all_async())
    print("\nALL PERSISTENCE UNIT TESTS PASSED SUCCESSFULLY!")


if __name__ == "__main__":
    main()
