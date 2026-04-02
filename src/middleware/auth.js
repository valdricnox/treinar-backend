// src/middleware/auth.js
const jwt = require('jsonwebtoken');
const { query } = require('../models/db');

const JWT_SECRET = process.env.JWT_SECRET || 'treinar-secret-key-change-in-production';

const auth = async (req, res, next) => {
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer '))
      return res.status(401).json({ error: 'Token não fornecido' });

    const token = header.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET);

    // Verifica se o token foi revogado
    const { rows } = await query(
      'SELECT id FROM sessions WHERE user_id=$1 AND token_hash=$2 AND expires_at > NOW()',
      [decoded.id, token.slice(-32)]
    );
    if (!rows.length)
      return res.status(401).json({ error: 'Token inválido ou expirado' });

    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Token inválido' });
  }
};

const requireRole = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user?.role))
    return res.status(403).json({ error: 'Sem permissão' });
  next();
};

module.exports = { auth, requireRole, JWT_SECRET };
