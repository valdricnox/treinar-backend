// src/routes/auth.js
const router   = require('express').Router();
const bcrypt   = require('bcryptjs');
const jwt      = require('jsonwebtoken');
const { query } = require('../models/db');
const { auth, JWT_SECRET } = require('../middleware/auth');

// POST /v1/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, senha } = req.body;
    if (!email || !senha)
      return res.status(400).json({ error: 'E-mail e senha são obrigatórios' });

    const { rows } = await query(
      'SELECT * FROM users WHERE email=$1 AND active=true',
      [email.toLowerCase().trim()]
    );
    const user = rows[0];
    if (!user)
      return res.status(401).json({ error: 'Credenciais inválidas' });

    const valid = await bcrypt.compare(senha, user.password_hash);
    if (!valid)
      return res.status(401).json({ error: 'Credenciais inválidas' });

    const payload = {
      id:    user.id,
      name:  user.name,
      email: user.email,
      role:  user.role,
      obra:  user.obra_id,
    };

    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });

    // Registra sessão
    await query(
      'INSERT INTO sessions (user_id, token_hash, expires_at) VALUES ($1,$2,NOW()+INTERVAL\'7 days\')',
      [user.id, token.slice(-32)]
    );

    res.json({
      token,
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro interno' });
  }
});

// POST /v1/auth/logout
router.post('/logout', auth, async (req, res) => {
  try {
    await query('DELETE FROM sessions WHERE user_id=$1', [req.user.id]);
    res.json({ message: 'Logout realizado com sucesso' });
  } catch (err) {
    res.status(500).json({ error: 'Erro interno' });
  }
});

// POST /v1/auth/refresh
router.post('/refresh', auth, async (req, res) => {
  try {
    const payload = { id: req.user.id, name: req.user.name, email: req.user.email, role: req.user.role };
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
    await query(
      'UPDATE sessions SET token_hash=$1, expires_at=NOW()+INTERVAL\'7 days\' WHERE user_id=$2',
      [token.slice(-32), req.user.id]
    );
    res.json({ token });
  } catch (err) {
    res.status(500).json({ error: 'Erro interno' });
  }
});

module.exports = router;
