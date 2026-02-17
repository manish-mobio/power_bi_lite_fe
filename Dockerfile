# Build stage
FROM node:18-alpine AS builder

WORKDIR /app

COPY package*.json ./

RUN npm install

# Runtime stage
FROM node:18-alpine

WORKDIR /app

COPY --from=builder /app/node_modules /app/node_modules

COPY . .

CMD ["npm", "run", "dev"]
