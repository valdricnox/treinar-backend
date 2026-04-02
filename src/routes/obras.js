// src/routes/obras.js
const router    = require('express').Router();
const { query } = require('../models/db');
const { auth }  = require('../middleware/auth');

router.get('/', auth, async (req, res) => {
  try {
    const { rows } = await query('SELECT * FROM obras ORDER BY nome ASC');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao listar obras' });
  }
});

router.get('/:id', auth, async (req, res) => {
  try {
    const { rows } = await query('SELECT * FROM obras WHERE id=$1', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Obra não encontrada' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Erro interno' });
  }
});

router.post('/', auth, async (req, res) => {
  try {
    const { nome, endereco, responsavel } = req.body;
    const { rows } = await query(
      'INSERT INTO obras (nome, endereco, responsavel) VALUES ($1,$2,$3) RETURNING *',
      [nome, endereco, responsavel]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao criar obra' });
  }
});

module.exports = router;
