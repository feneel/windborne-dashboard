# Use Node LTS
FROM node:20-alpine

WORKDIR /app

# Copy package.json & lockfile first
COPY package*.json ./

RUN npm install --production

# Copy rest of server
COPY . .

EXPOSE 8080
CMD ["node", "server.js"]
