# syntax=docker/dockerfile:1.7
# Legart — production image (Next.js standalone server).
#
#   docker build -t legart-web .
#   docker run -p 3000:3000 --env-file .env legart-web
#
# Build args:
#   FETCH_LIBRARY=1   download the 20 library paintings from Wikimedia Commons during the build (default)
#   FETCH_LIBRARY=0   skip it (use files already in public/library or library-src/)
# Optional build secret for networks with a TLS-inspecting proxy:
#   --secret id=extra_ca,src=/path/to/corporate-ca.pem

ARG NODE_IMAGE=node:22-bookworm-slim

# ---------------------------------------------------------------- dependencies
FROM ${NODE_IMAGE} AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN --mount=type=secret,id=extra_ca,required=false \
    if [ -f /run/secrets/extra_ca ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/extra_ca; fi; \
    npm ci --no-audit --no-fund

# ---------------------------------------------------------------- library paintings
FROM deps AS library
ARG FETCH_LIBRARY=1
COPY scripts/fetch-library.mjs ./scripts/
COPY src/content/artworks.ts ./src/content/
COPY library-src ./library-src
COPY public/library ./public/library
RUN --mount=type=secret,id=extra_ca,required=false \
    if [ -f /run/secrets/extra_ca ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/extra_ca; fi; \
    if [ "$FETCH_LIBRARY" = "1" ] || [ -n "$(ls library-src | grep -v README)" ]; then \
      node scripts/fetch-library.mjs || echo "WARNING: some library paintings could not be fetched"; \
    fi

# ---------------------------------------------------------------- build
FROM deps AS build
ENV NEXT_TELEMETRY_DISABLED=1
COPY . .
COPY --from=library /app/public/library ./public/library
RUN npm run build

# ---------------------------------------------------------------- runtime
FROM ${NODE_IMAGE} AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
COPY --from=build --chown=node:node /app/public ./public
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "server.js"]
