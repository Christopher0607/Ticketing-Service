FROM node:24-bookworm-slim AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY package*.json ./
RUN --mount=type=secret,id=npm_ca \
    if [ -f /run/secrets/npm_ca ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/npm_ca; fi \
    && npm ci
COPY . .
RUN DOCKER_BUILD=1 npm run build \
    && mkdir -p .next/standalone/.next .next/standalone/scripts \
    && cp -r .next/static .next/standalone/.next/static \
    && cp -r public db .next/standalone/ \
    && cp scripts/database.mjs .next/standalone/scripts/

FROM node:24-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 HOSTNAME=0.0.0.0
COPY --from=build --chown=node:node /app/.next/standalone ./
USER node
EXPOSE 3000
CMD ["node", "server.js"]
