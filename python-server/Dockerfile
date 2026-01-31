FROM ghcr.io/astral-sh/uv:python3.12-alpine

WORKDIR /app
COPY python-server/pyproject.toml python-server/uv.lock ./
RUN uv sync --frozen --no-dev

COPY python-server/server.py .
COPY data/ ./data/

ENV DATA_DIR=/app/data
EXPOSE 5001
CMD ["uv", "run", "server.py"]
