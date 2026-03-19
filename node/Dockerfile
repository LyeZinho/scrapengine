FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build

# Copy schema.sql explicitly (TypeScript doesn't copy non-.ts files)
COPY src/db/schema.sql dist/db/

EXPOSE 7650

CMD ["npm", "start"]
