// src/routes/incidents.js
const router    = require('express').Router();
const { query } = require('../models/db');
const { auth }  = require('../middleware/auth');
const multer    = require('multer');
const path      = require('path');
const fs        = require('fs');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, '../../uploads/incidentes', req.params.id);
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`),
});
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });

// GET /v1/incidentes
router.get('/', auth, async (req, res) => {
  try {
    const { obraId, status, severidade } = req.query;
    let sql = 'SELECT * FROM incidentes WHERE 1=1';
    const params = [];

    if (req.user.role === 'inspetor') {
      params.push(req.user.id);
      sql += ` AND user_id=$${params.length}`;
    }
    if (obraId)     { params.push(obraId);     sql += ` AND obra_id=$${params.length}`; }
    if (status)     { params.push(status);     sql += ` AND status=$${params.length}`; }
    if (severidade) { params.push(severidade); sql += ` AND severidade=$${params.length}`; }

    sql += ' ORDER BY data_criacao DESC';
    const { rows } = await query(sql, params);

    const mapped = rows.map(r => ({
      id:           r.id,
      titulo:       r.titulo,
      descricao:    r.descricao,
      severidade:   r.severidade,
      tipo:         r.tipo,
      local:        r.local,
      obra:         r.obra,
      responsavel:  r.responsavel,
      status:       r.status,
      fotos:        r.fotos || [],
      geolocation:  r.geolocation,
      acao:         r.acao,
      prazo:        r.prazo,
      dataCriacao:  r.data_criacao,
      syncPendente: false,
    }));

    res.json(mapped);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao listar incidentes' });
  }
});

// POST /v1/incidentes
router.post('/', auth, async (req, res) => {
  try {
    const { titulo, descricao, severidade, tipo, local, obra, responsavel, fotos, geolocation, acao } = req.body;

    const { rows } = await query(
      `INSERT INTO incidentes (titulo, descricao, severidade, tipo, local, obra, responsavel, user_id, fotos, geolocation, acao)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
      [titulo, descricao, severidade, tipo, local, obra,
       responsavel || req.user.name, req.user.id,
       JSON.stringify(fotos || []),
       geolocation ? JSON.stringify(geolocation) : null,
       acao || null]
    );

    // TODO: enviar notificação push para gestores quando severidade === 'alta'

    res.status(201).json({ id: rows[0].id, message: 'Incidente registrado com sucesso' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao criar incidente' });
  }
});

// PUT /v1/incidentes/:id
router.put('/:id', auth, async (req, res) => {
  try {
    const { status, acao, prazo } = req.body;
    const { rows } = await query(
      'UPDATE incidentes SET status=$1, acao=$2, prazo=$3, updated_at=NOW() WHERE id=$4 RETURNING *',
      [status, acao, prazo || null, req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Não encontrado' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao atualizar incidente' });
  }
});

// POST /v1/incidentes/:id/fotos
router.post('/:id/fotos', auth, upload.array('fotos', 10), async (req, res) => {
  try {
    if (!req.files?.length) return res.status(400).json({ error: 'Nenhuma foto enviada' });

    const urls = req.files.map(f => `/uploads/incidentes/${req.params.id}/${f.filename}`);
    const { rows } = await query('SELECT fotos FROM incidentes WHERE id=$1', [req.params.id]);
    const existingFotos = rows[0]?.fotos || [];
    const allFotos = [...existingFotos, ...urls];

    await query('UPDATE incidentes SET fotos=$1, updated_at=NOW() WHERE id=$2', [JSON.stringify(allFotos), req.params.id]);
    res.json({ fotos: allFotos });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao salvar fotos' });
  }
});

module.exports = router;


// ─── TEMPLATES ROUTE ──────────────────────────────────────────────────────────
// src/routes/templates.js
const templateRouter = require('express').Router();

const TEMPLATES_BUILTIN = [
  {
    id: 'nr18-epi', norma: 'NR-18', titulo: 'Verificação de EPI — Obra',
    descricao: 'Checklist diário de equipamentos de proteção individual',
    itens: [
      { id: 'i1', label: 'Capacete com jugular em bom estado',         obrigatorio: true,  tipo: 'checkbox' },
      { id: 'i2', label: 'Cinto de segurança tipo paraquedista',        obrigatorio: true,  tipo: 'checkbox' },
      { id: 'i3', label: 'Óculos de proteção adequados',                obrigatorio: false, tipo: 'checkbox' },
      { id: 'i4', label: 'Luvas adequadas para a atividade',            obrigatorio: true,  tipo: 'checkbox' },
      { id: 'i5', label: 'Protetor auricular (se necessário)',          obrigatorio: false, tipo: 'checkbox' },
      { id: 'i6', label: 'Calçado de segurança com biqueira de aço',   obrigatorio: true,  tipo: 'checkbox' },
      { id: 'i7', label: 'Colete refletivo (se área com tráfego)',     obrigatorio: false, tipo: 'checkbox' },
      { id: 'i8', label: 'Foto do colaborador equipado',                obrigatorio: false, tipo: 'foto'     },
    ],
  },
  {
    id: 'nr35-altura', norma: 'NR-35', titulo: 'Trabalho em Altura — Pré-Atividade',
    descricao: 'Verificação obrigatória antes de qualquer trabalho em altura',
    itens: [
      { id: 'i1', label: 'Andaime inspecionado e liberado por responsável',  obrigatorio: true,  tipo: 'checkbox' },
      { id: 'i2', label: 'Cinto paraquedista com talabarte duplo',            obrigatorio: true,  tipo: 'checkbox' },
      { id: 'i3', label: 'Ponto de ancoragem identificado e testado',         obrigatorio: true,  tipo: 'checkbox' },
      { id: 'i4', label: 'Área abaixo sinalizada e isolada',                  obrigatorio: true,  tipo: 'checkbox' },
      { id: 'i5', label: 'Trabalhador com certificado NR-35 válido',           obrigatorio: true,  tipo: 'checkbox' },
      { id: 'i6', label: 'Condições climáticas adequadas (sem chuva/vento)',  obrigatorio: true,  tipo: 'checkbox' },
      { id: 'i7', label: 'Comunicação com encarregado estabelecida',          obrigatorio: true,  tipo: 'checkbox' },
      { id: 'i8', label: 'Foto do local com equipamento instalado',           obrigatorio: true,  tipo: 'foto'     },
    ],
  },
  {
    id: 'nr6-semanal', norma: 'NR-6', titulo: 'Inspeção Semanal de EPI — Estoque',
    descricao: 'Controle semanal do estoque e condição dos EPIs',
    itens: [
      { id: 'i1', label: 'Estoque mínimo de capacetes disponível',  obrigatorio: true,  tipo: 'checkbox' },
      { id: 'i2', label: 'EPIs dentro do prazo de validade (CA)',   obrigatorio: true,  tipo: 'checkbox' },
      { id: 'i3', label: 'Cintos de segurança sem avarias visíveis',obrigatorio: true,  tipo: 'checkbox' },
      { id: 'i4', label: 'Registro de entrega de EPI atualizado',   obrigatorio: true,  tipo: 'checkbox' },
      { id: 'i5', label: 'Descarte correto de EPIs vencidos',       obrigatorio: false, tipo: 'checkbox' },
      { id: 'i6', label: 'Foto do almoxarifado de EPI',             obrigatorio: false, tipo: 'foto'     },
    ],
  },
  {
    id: 'nr12-maquinas', norma: 'NR-12', titulo: 'Inspeção de Máquinas e Equipamentos',
    descricao: 'Verificação de segurança em máquinas e equipamentos da obra',
    itens: [
      { id: 'i1', label: 'Proteções de partes móveis instaladas e fixas',   obrigatorio: true,  tipo: 'checkbox' },
      { id: 'i2', label: 'Dispositivo de parada de emergência funcional',    obrigatorio: true,  tipo: 'checkbox' },
      { id: 'i3', label: 'Aterramento elétrico verificado e documentado',   obrigatorio: true,  tipo: 'checkbox' },
      { id: 'i4', label: 'Operador habilitado (CNH categoria adequada)',     obrigatorio: true,  tipo: 'checkbox' },
      { id: 'i5', label: 'Manual do equipamento acessível no local',        obrigatorio: false, tipo: 'checkbox' },
      { id: 'i6', label: 'Sinalização de segurança afixada corretamente',   obrigatorio: true,  tipo: 'checkbox' },
      { id: 'i7', label: 'Manutenção preventiva em dia (laudo vigente)',    obrigatorio: true,  tipo: 'checkbox' },
      { id: 'i8', label: 'Foto da máquina com proteções instaladas',        obrigatorio: false, tipo: 'foto'     },
    ],
  },
];

templateRouter.get('/', auth, async (req, res) => {
  const { norma } = req.query;
  let templates = TEMPLATES_BUILTIN;
  if (norma) templates = templates.filter(t => t.norma === norma);
  res.json(templates);
});

templateRouter.get('/:id', auth, (req, res) => {
  const t = TEMPLATES_BUILTIN.find(t => t.id === req.params.id);
  if (!t) return res.status(404).json({ error: 'Template não encontrado' });
  res.json(t);
});

module.exports = { incidentsRouter: router, templateRouter };
