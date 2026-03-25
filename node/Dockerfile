FROM node:20-alpine AS builder

WORKDIR /app

# Use development for build to ensure devDependencies are installed
ARG NODE_ENV=development
ENV NODE_ENV=$NODE_ENV

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build
RUN cp src/db/schema.sql dist/db/

FROM node:20-alpine

WORKDIR /app

# Use production for runtime
ARG NODE_ENV=production
ENV NODE_ENV=$NODE_ENV

COPY package*.json ./
RUN npm ci --omit=dev

COPY --from=builder /app/dist ./dist

EXPOSE 3000

CMD ["npm", "start"]
