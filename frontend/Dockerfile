# Dev image for the SINARMS React/Vite frontend.
# The source tree is bind-mounted by docker-compose so edits hot-reload (HMR);
# node_modules lives in an anonymous volume so the Linux build is not shadowed
# by any host (Windows) node_modules.
FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json ./
# --legacy-peer-deps: @tailwindcss/vite@4.2.1 still declares a vite <=7 peer
# range while this project runs vite 8 (matches how the host lockfile was built).
RUN npm ci --legacy-peer-deps

COPY . .

EXPOSE 5173

# vite.config.js binds 0.0.0.0 and reads BACKEND_PROXY_TARGET / VITE_USE_POLLING
# from the environment (set in docker-compose).
CMD ["npm", "run", "dev", "--", "--host"]
