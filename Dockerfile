# Stage 1: Build the React renderer
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build:renderer

# Stage 2: Serve with nginx
FROM nginx:alpine

COPY --from=builder /app/dist/renderer /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
