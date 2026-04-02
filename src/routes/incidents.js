const router = require('express').Router();
const { query } = require('../models/db');
const { auth } = require('../middleware/auth');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, '../../uploads/incidentes', req.params.id || 'temp');
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`),
});
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });

router.get('/', auth, async (req, res) => {
  try {
    let sql = 'SELECT * FROM incidentes WHERE 1=1';
    const params = [];
    if (req.user.role === 'inspetor') { params.push(req.user.id); sql += ` AND user_id=$${params.length}`; }
    sql += ' ORDER BY data_criacao DESC';
    const { rows } = await query(sql, params);
    res.json(rows.map(r => ({
      id: r.id, titulo: r.titulo, descricao: r.descricao,
      severidade: r.severidade, tipo: r.tipo, local: r.local,
      obra: r.obra, responsavel: r.responsavel, status: r.status,
      fotos: r.fotos || [], geolocation: r.geolocation,
      acao: r.acao, dataCriacao: r.data_criacao, syncPendente: false,
    })));
  } catch (err) { console.error(err); res.status(500).json({ error: 'Erro ao listar' }); }
});

router.post('/', auth, async (req, res) => {
  try {
    const { titulo, descricao, severidade, tipo, local, obra, responsavel, fotos, geolocation, acao } = req.body;
    const { rows } = await query(
      `INSERT INTO incidentes (titulo,descricao,severidade,tipo,local,obra,responsavel,user_id,fotos,geolocation,acao)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
      [titulo, descricao, severidade||'media', tipo||'nao_conformidade', local, obra,
       responsavel||req.user.name, req.user.id,
       JSON.stringify(fotos||[]),
       geolocation ? JSON.stringify(geolocation) : null, acao||null]
    );
    res.status(201).json({ id: rows[0].id });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Erro ao criar' }); }
});

router.put('/:id', auth, async (req, res) => {
  try {
    const { status, acao } = req.body;
    const { rows } = await query(
      'UPDATE incidentes SET status=$1, acao=$2 WHERE id=$3 RETURNING *',
      [status, acao, req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Nao encontrado' });
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: 'Erro ao atualizar' }); }
});

router.post('/:id/fotos', auth, upload.array('fotos', 10), async (req, res) => {
  try {
    if (!req.files?.length) return res.status(400).json({ error: 'Nenhuma foto' });
    const urls = req.files.map(f => `/uploads/incidentes/${req.params.id}/${f.filename}`);
    const { rows } = await query('SELECT fotos FROM incidentes WHERE id=$1', [req.params.id]);
    const all = [...(rows[0]?.fotos||[]), ...urls];
    await query('UPDATE incidentes SET fotos=$1 WHERE id=$2', [JSON.stringify(all), req.params.id]);
    res.json({ fotos: all });
  } catch (err) { res.status(500).json({ error: 'Erro ao salvar fotos' }); }
});

module.exports = router;
