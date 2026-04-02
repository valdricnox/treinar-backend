# backend/Dockerfile
FROM node:20-alpine

WORKDIR /app

# Dependências
COPY package*.json ./
RUN npm ci --only=production

# Código
COPY . .

# Pasta de uploads
RUN mkdir -p uploads/checklists uploads/incidentes uploads/pdfs

# Roda migration e inicia
EXPOSE 3000
CMD ["sh", "-c", "node src/models/db.js && node src/server.js"]
