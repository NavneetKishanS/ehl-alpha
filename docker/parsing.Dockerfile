# Docling PDF parsing pipeline (parsing/). Large image (torch + models) —
# only built when the `tools` profile is used.
FROM python:3.13-slim

# Runtime libs needed by opencv/docling on slim images.
RUN apt-get update \
    && apt-get install -y --no-install-recommends libgl1 libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements-parsing.txt ./
RUN pip install --no-cache-dir -r requirements-parsing.txt

# Docling downloads layout/table models on first run; compose caches them here.
ENV HF_HOME=/cache/huggingface

CMD ["python", "-m", "parsing.run", "--help"]
