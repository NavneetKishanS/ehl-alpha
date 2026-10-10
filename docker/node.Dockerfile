# Dev image for the Next.js app and the offline ingest script.
# poppler-utils provides `pdftotext`, which `npm run ingest` needs for the
# option-list PDFs (see docs/DATA_SETUP.md).
FROM node:20-slim

RUN apt-get update \
    && apt-get install -y --no-install-recommends poppler-utils \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Dependencies are installed into the image; compose mounts a named volume over
# /app/node_modules so host (macOS) binaries never leak into the container.
COPY package.json package-lock.json ./
RUN npm ci

EXPOSE 3000
CMD ["npm", "run", "dev", "--", "-H", "0.0.0.0"]
