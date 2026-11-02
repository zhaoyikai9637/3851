FROM node:24-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
RUN npm run build && npm prune --omit=dev --ignore-scripts

FROM node:24-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends gosu ca-certificates \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV NODE_ENV=production DB_MODE=production HOST=0.0.0.0 PORT=8080 JRS_ENV_FILE="" JRS_DATA_DIR=/data
COPY --from=build /app /app
ENTRYPOINT ["/bin/sh", "/app/deploy/entrypoint.sh"]
CMD ["node", "scripts/start.mjs"]
