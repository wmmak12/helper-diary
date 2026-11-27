# Helper Diary in one container. Build:  docker build -t helper-diary .
# Run:  docker run -d --name helper-diary --restart unless-stopped -p 8080:8080 \
#         -v helper-diary-data:/data --env-file .env helper-diary
# The database and photos live in /data: keep that volume, and back it up.

FROM node:24-bookworm-slim AS build
WORKDIR /app
RUN npm install -g pnpm@12
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm build && pnpm release

FROM node:24-bookworm-slim
ENV NODE_ENV=production PORT=8080
WORKDIR /app
# The release package carries everything it needs to run; nothing is installed here.
COPY --from=build /app/release/server ./
# Only the app's own user can read the data folder.
RUN mkdir /data && chown node:node /data && chmod 700 /data
USER node
VOLUME /data
EXPOSE 8080
HEALTHCHECK --interval=60s --timeout=5s --start-period=30s --start-interval=2s \
  CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/signin').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"
# The data always goes to the /data volume, even when the --env-file sets DATA_DIR for a non-Docker install.
CMD ["env", "DATA_DIR=/data", "node", "server.mjs"]
