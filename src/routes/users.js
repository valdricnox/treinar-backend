// src/routes/users.js
const router    = require('express').Router();
const bcrypt    = require('bcryptjs');
const { query } = require('../models/db');
const { auth, requireRole } = require('../middleware/auth');

// GET /v1/users — apenas gestores/admin
router.get('/', auth, requireRole('gestor', 'admin'), async (req, res) => {
  try {
    const { rows } = await query(
      'SELECT id, name, email, role, obra_id, active, created_at FROM users ORDER BY name ASC'
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao listar usuários' });
  }
});

// POST /v1/users — criar novo inspetor (admin/gestor)
router.post('/', auth, requireRole('gestor', 'admin'), async (req, res) => {
  try {
    const { name, email, senha, role, obra_id } = req.body;
    if (!name || !email || !senha)
      return res.status(400).json({ error: 'Nome, e-mail e senha são obrigatórios' });

    const hash = await bcrypt.hash(senha, 10);
    const { rows } = await query(
      'INSERT INTO users (name, email, password_hash, role, obra_id) VALUES ($1,$2,$3,$4,$5) RETURNING id, name, email, role',
      [name, email.toLowerCase(), hash, role || 'inspetor', obra_id || null]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === '23505')
      return res.status(409).json({ error: 'E-mail já cadastrado' });
    res.status(500).json({ error: 'Erro ao criar usuário' });
  }
});

// GET /v1/users/me — perfil do usuário logado
router.get('/me', auth, async (req, res) => {
  try {
    const { rows } = await query(
      'SELECT id, name, email, role, obra_id, created_at FROM users WHERE id=$1',
      [req.user.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Usuário não encontrado' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Erro interno' });
  }
});

// PUT /v1/users/me — atualizar perfil
router.put('/me', auth, async (req, res) => {
  try {
    const { name, senha } = req.body;
    if (senha) {
      const hash = await bcrypt.hash(senha, 10);
      await query('UPDATE users SET name=$1, password_hash=$2, updated_at=NOW() WHERE id=$3', [name, hash, req.user.id]);
    } else {
      await query('UPDATE users SET name=$1, updated_at=NOW() WHERE id=$2', [name, req.user.id]);
    }
    res.json({ message: 'Perfil atualizado com sucesso' });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao atualizar perfil' });
  }
});

module.exports = router;
