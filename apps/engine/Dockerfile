FROM ghcr.io/astral-sh/uv:python3.13-bookworm-slim

WORKDIR /app

ENV UV_COMPILE_BYTECODE=1 \
    PYTHONUNBUFFERED=1

# Install dependencies with layer caching
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev --no-install-project

# Copy source code and install project
COPY src/ ./src/
COPY README.md ./
RUN uv sync --frozen --no-dev

EXPOSE 8000

CMD ["sh", "-c", "uv run uvicorn engine.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
