FROM node:22-bookworm-slim

WORKDIR /app
ENV NODE_ENV=production
ENV DATA_DIR=/data

# better-sqlite3 usually has prebuilt binaries, but build tools make registry
# builds reliable on both amd64 Unraid servers and arm64 devices.
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

EXPOSE 3000
CMD ["npm", "start"]
