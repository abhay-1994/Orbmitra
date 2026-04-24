FROM node:20-alpine

WORKDIR /app

COPY package.json ./
COPY frontend ./frontend
COPY backend ./backend

EXPOSE 3000

CMD ["node", "backend/src/server.js"]
