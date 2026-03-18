FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install

COPY . .

# Build needs a dummy DATABASE_URL to pass config validation
ENV DATABASE_URL=postgres://localhost/dummy
RUN npx medusa build

FROM node:20-alpine

WORKDIR /app

COPY --from=builder /app/.medusa ./.medusa
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
COPY --from=builder /app/medusa-config.ts ./

EXPOSE 9000

# Run migrations then start the server
CMD ["sh", "-c", "npx medusa db:migrate && npx medusa start"]
