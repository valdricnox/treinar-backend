// src/server.js
require('dotenv').config();
const express     = require('express');
const cors        = require('cors');
const helmet      = require('helmet');
const morgan      = require('morgan');
const rateLimit   = require('express-rate-limit');
const path        = require('path');

const app = express();

// ─── MIDDLEWARE ───────────────────────────────────────────────────────────────
app.use(helmet());
app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }));
app.use(morgan('combined'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Servir uploads
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Rate limit global
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 200 }));

// ─── ROTAS ────────────────────────────────────────────────────────────────────
app.use('/v1/auth',       require('./routes/auth'));
app.use('/v1/checklists', require('./routes/checklists'));
app.use('/v1/incidentes', require('./routes/incidents'));
app.use('/v1/templates',  require('./routes/templates'));
app.use('/v1/obras',      require('./routes/obras'));
app.use('/v1/users',      require('./routes/users'));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString(), version: '1.0.0' });
});

// 404
app.use((req, res) => {
  res.status(404).json({ error: 'Rota não encontrada' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    error: err.message || 'Erro interno do servidor',
  });
});

// ─── START ────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Treinar API rodando na porta ${PORT}`);
  console.log(`📊 Ambiente: ${process.env.NODE_ENV || 'development'}`);
});

module.exports = app;
