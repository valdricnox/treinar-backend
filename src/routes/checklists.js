// src/routes/checklists.js
const router   = require('express').Router();
const { query } = require('../models/db');
const { auth }  = require('../middleware/auth');
const multer    = require('multer');
const path      = require('path');
const PDFDocument = require('pdfkit');
const fs        = require('fs');

// Upload de fotos
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, '../../uploads/checklists', req.params.id);
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`),
});
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });

// GET /v1/checklists
router.get('/', auth, async (req, res) => {
  try {
    const { obraId, status, norma } = req.query;
    let sql = 'SELECT * FROM checklists WHERE 1=1';
    const params = [];

    // Inspetor só vê seus próprios, gestor vê todos
    if (req.user.role === 'inspetor') {
      params.push(req.user.id);
      sql += ` AND user_id=$${params.length}`;
    }
    if (obraId) { params.push(obraId); sql += ` AND obra_id=$${params.length}`; }
    if (status)  { params.push(status);  sql += ` AND status=$${params.length}`; }
    if (norma)   { params.push(norma);   sql += ` AND norma=$${params.length}`; }

    sql += ' ORDER BY data_criacao DESC';
    const { rows } = await query(sql, params);

    // Mapeia para o formato do app
    const mapped = rows.map(r => ({
      id:           r.id,
      titulo:       r.titulo,
      norma:        r.norma,
      obra:         r.obra,
      responsavel:  r.responsavel,
      status:       r.status,
      progresso:    r.progresso,
      itens:        r.itens,
      geolocation:  r.geolocation,
      dataCriacao:  r.data_criacao,
      dataConclusao:r.data_conclusao,
      pdfUri:       r.pdf_url,
      syncPendente: false,
    }));

    res.json(mapped);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao listar checklists' });
  }
});

// GET /v1/checklists/:id
router.get('/:id', auth, async (req, res) => {
  try {
    const { rows } = await query('SELECT * FROM checklists WHERE id=$1', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Não encontrado' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Erro interno' });
  }
});

// POST /v1/checklists
router.post('/', auth, async (req, res) => {
  try {
    const { titulo, norma, obra, responsavel, itens, geolocation } = req.body;
    const { rows } = await query(
      `INSERT INTO checklists (titulo, norma, obra, responsavel, user_id, itens, geolocation)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [titulo, norma, obra, responsavel || req.user.name, req.user.id,
       JSON.stringify(itens || []), geolocation ? JSON.stringify(geolocation) : null]
    );
    res.status(201).json({ id: rows[0].id, ...rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao criar checklist' });
  }
});

// PUT /v1/checklists/:id
router.put('/:id', auth, async (req, res) => {
  try {
    const { itens, status, progresso } = req.body;
    const { rows } = await query(
      `UPDATE checklists SET itens=$1, status=$2, progresso=$3, updated_at=NOW()
       WHERE id=$4 RETURNING *`,
      [JSON.stringify(itens), status, progresso, req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Não encontrado' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao atualizar' });
  }
});

// POST /v1/checklists/:id/concluir
router.post('/:id/concluir', auth, async (req, res) => {
  try {
    const { assinatura } = req.body;
    await query(
      `UPDATE checklists SET status='concluido', progresso=100,
       data_conclusao=NOW(), assinatura=$1, updated_at=NOW() WHERE id=$2`,
      [assinatura || null, req.params.id]
    );
    res.json({ message: 'Checklist concluído com sucesso' });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao concluir' });
  }
});

// POST /v1/checklists/:id/pdf  — Gera PDF com marca Treinar
router.post('/:id/pdf', auth, async (req, res) => {
  try {
    const { rows } = await query('SELECT * FROM checklists WHERE id=$1', [req.params.id]);
    const checklist = rows[0];
    if (!checklist) return res.status(404).json({ error: 'Não encontrado' });

    const doc = new PDFDocument({ margin: 50 });
    const pdfDir = path.join(__dirname, '../../uploads/pdfs');
    fs.mkdirSync(pdfDir, { recursive: true });
    const pdfPath = path.join(pdfDir, `${checklist.id}.pdf`);
    const stream  = fs.createWriteStream(pdfPath);
    doc.pipe(stream);

    // ─── CAPA DO PDF ──────────────────────────────────────────────────────────
    // Header com fundo preto
    doc.rect(0, 0, 612, 120).fill('#1A1A1A');
    doc.fillColor('#F5C800').fontSize(28).font('Helvetica-Bold')
       .text('TREINAR', 50, 35, { align: 'left' });
    doc.fillColor('#FFFFFF').fontSize(12).font('Helvetica')
       .text('Engenharia — Relatório de Inspeção de Segurança', 50, 70);
    doc.fillColor('#F5C800').fontSize(10)
       .text(`treinar.eng.br`, 50, 90);

    // Informações do checklist
    doc.fillColor('#1A1A1A').fontSize(18).font('Helvetica-Bold')
       .text(checklist.titulo, 50, 140);

    doc.fontSize(11).font('Helvetica').fillColor('#555');
    const info = [
      ['Norma',        checklist.norma],
      ['Obra',         checklist.obra],
      ['Responsável',  checklist.responsavel],
      ['Data',         new Date(checklist.data_criacao).toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })],
      ['Conclusão',    checklist.data_conclusao ? new Date(checklist.data_conclusao).toLocaleString('pt-BR') : 'Em andamento'],
      ['Progresso',    `${checklist.progresso}%`],
      ['Status',       checklist.status.replace('_', ' ').toUpperCase()],
    ];
    let y = 175;
    info.forEach(([k, v]) => {
      doc.fillColor('#999').text(k + ':', 50, y).fillColor('#1A1A1A').text(v, 160, y);
      y += 18;
    });

    if (checklist.geolocation) {
      doc.fillColor('#999').text('Geolocalização:', 50, y)
         .fillColor('#1A1A1A').text(`${checklist.geolocation.lat}, ${checklist.geolocation.lng}`, 160, y);
      y += 18;
    }

    // Separador
    y += 10;
    doc.moveTo(50, y).lineTo(562, y).strokeColor('#F5C800').lineWidth(2).stroke();
    y += 20;

    // ─── ITENS ────────────────────────────────────────────────────────────────
    doc.fontSize(13).font('Helvetica-Bold').fillColor('#1A1A1A').text('ITENS DA INSPEÇÃO', 50, y);
    y += 25;

    const itens = checklist.itens || [];
    itens.forEach((item, idx) => {
      if (y > 720) { doc.addPage(); y = 50; }
      const check = item.checked ? '✓' : '○';
      const color = item.checked ? '#2E7D32' : '#C62828';
      doc.fontSize(11).font('Helvetica-Bold').fillColor(color).text(check, 50, y);
      doc.fillColor('#1A1A1A').font('Helvetica').text(item.label, 75, y, { width: 420 });
      if (item.obrigatorio) {
        doc.fillColor('#C62828').fontSize(8).text('OBR', 510, y + 2);
      }
      if (item.nota) {
        y += 15;
        doc.fillColor('#666').fontSize(9).text(`  Nota: ${item.nota}`, 75, y);
      }
      y += 20;
    });

    // Resumo final
    const concluidos = itens.filter(i => i.checked).length;
    y += 15;
    doc.moveTo(50, y).lineTo(562, y).strokeColor('#E0E0E0').lineWidth(1).stroke();
    y += 15;
    doc.fontSize(12).font('Helvetica-Bold').fillColor('#1A1A1A')
       .text(`Resultado: ${concluidos}/${itens.length} itens conformes (${checklist.progresso}%)`, 50, y);

    // Footer
    doc.fontSize(8).font('Helvetica').fillColor('#999')
       .text(
         `Relatório gerado em ${new Date().toLocaleString('pt-BR')} — Treinar Engenharia — treinar.eng.br`,
         50, 780, { align: 'center', width: 512 }
       );

    doc.end();

    stream.on('finish', async () => {
      const pdfUrl = `/uploads/pdfs/${checklist.id}.pdf`;
      await query('UPDATE checklists SET pdf_url=$1 WHERE id=$2', [pdfUrl, checklist.id]);
      res.json({ pdfUrl, message: 'PDF gerado com sucesso' });
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao gerar PDF' });
  }
});

// POST /v1/checklists/:id/itens/:itemId/foto
router.post('/:id/itens/:itemId/foto', auth, upload.single('foto'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Nenhuma foto enviada' });

    const { rows } = await query('SELECT itens FROM checklists WHERE id=$1', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Não encontrado' });

    const itens = rows[0].itens.map((item) => {
      if (item.id === req.params.itemId) {
        return { ...item, fotoUri: `/uploads/checklists/${req.params.id}/${req.file.filename}`, checked: true };
      }
      return item;
    });

    const concluidos = itens.filter(i => i.checked).length;
    const progresso  = Math.round((concluidos / itens.length) * 100);
    const status     = progresso === 100 ? 'concluido' : progresso > 0 ? 'em_andamento' : 'pendente';

    await query(
      'UPDATE checklists SET itens=$1, progresso=$2, status=$3, updated_at=NOW() WHERE id=$4',
      [JSON.stringify(itens), progresso, status, req.params.id]
    );

    res.json({ fotoUrl: `/uploads/checklists/${req.params.id}/${req.file.filename}`, progresso });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao salvar foto' });
  }
});

module.exports = router;
