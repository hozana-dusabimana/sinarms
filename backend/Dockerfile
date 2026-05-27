# Dev image for the SINARMS Node/Express backend.
# The source tree is bind-mounted by docker-compose; nodemon (polling mode)
# gives reliable hot reload across the Docker Desktop bind mount on Windows.
FROM node:20-alpine

WORKDIR /app

# File-watching restarts in development.
RUN npm install -g nodemon@3

# Install dependencies in their own layer so they are cached independently of
# the bind-mounted source. The anonymous node_modules volume in compose is
# seeded from this layer, keeping the Linux build separate from any host
# node_modules.
COPY package.json package-lock.json ./
RUN npm ci

COPY . .

EXPOSE 4000

# --legacy-watch (polling) because filesystem events do not cross the Docker
# Desktop bind mount reliably on Windows/macOS. The server auto-runs DB
# migrations and seeds on startup, so no separate migrate step is needed.
CMD ["nodemon", "--legacy-watch", "src/server.js"]
