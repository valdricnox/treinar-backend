FROM node:20-alpine
WORKDIR /app
COPY package.json ./
RUN npm install --production
COPY . .
RUN mkdir -p uploads
EXPOSE 3000
CMD ["sh", "-c", "node src/models/db.js && node src/models/seed.js; node src/server.js"]
