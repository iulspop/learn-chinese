FROM ghcr.io/astral-sh/uv:python3.12-alpine

WORKDIR /app
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev

COPY server.py .

ENV DATA_DIR=/app/data
EXPOSE 5001
CMD ["uv", "run", "server.py"]
