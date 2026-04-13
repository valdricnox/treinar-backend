// src/routes/checklists.js
const router      = require('express').Router();
const { query }   = require('../models/db');
const { auth }    = require('../middleware/auth');
const multer      = require('multer');
const path        = require('path');
const PDFDocument = require('pdfkit');
const fs          = require('fs');

// ─── Upload de fotos ──────────────────────────────────────────────────────────
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, '../../uploads/checklists', req.params.id);
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`),
});
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });

// ─── GET /v1/checklists ───────────────────────────────────────────────────────
router.get('/', auth, async (req, res) => {
  try {
    const { obraId, status, norma } = req.query;
    let sql = 'SELECT * FROM checklists WHERE 1=1';
    const params = [];

    if (req.user.role === 'inspetor') {
      params.push(req.user.id);
      sql += ` AND user_id=$${params.length}`;
    }
    if (obraId) { params.push(obraId); sql += ` AND obra_id=$${params.length}`; }
    if (status) { params.push(status); sql += ` AND status=$${params.length}`; }
    if (norma)  { params.push(norma);  sql += ` AND norma=$${params.length}`; }

    sql += ' ORDER BY data_criacao DESC';
    const { rows } = await query(sql, params);

    const mapped = rows.map(r => ({
      id:             r.id,
      titulo:         r.titulo,
      norma:          r.norma,
      normas:         r.normas,
      obra:           r.obra,
      responsavel:    r.responsavel,
      acompanhante:   r.acompanhante,
      acompanhanteCargo: r.acompanhante_cargo,
      status:         r.status,
      progresso:      r.progresso,
      conformidade:   r.conformidade,
      itens:          r.itens,
      geolocation:    r.geolocation,
      observacoes:    r.observacoes,
      assinatura:     r.assinatura,
      assinaturaData: r.assinatura_data,
      assinaturaAcompanhante:     r.assinatura_acompanhante,
      assinaturaAcompanhanteData: r.assinatura_acompanhante_data,
      dataCriacao:    r.data_criacao,
      dataConclusao:  r.data_conclusao,
      pdfUri:         r.pdf_url,
      syncPendente:   false,
    }));

    res.json(mapped);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao listar checklists' });
  }
});

// ─── GET /v1/checklists/:id ───────────────────────────────────────────────────
router.get('/:id', auth, async (req, res) => {
  try {
    const { rows } = await query('SELECT * FROM checklists WHERE id=$1', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Não encontrado' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Erro interno' });
  }
});

// ─── POST /v1/checklists ──────────────────────────────────────────────────────
router.post('/', auth, async (req, res) => {
  try {
    const {
      titulo, norma, normas, obra, responsavel, itens,
      geolocation, acompanhante, acompanhanteCargo,
    } = req.body;

    const { rows } = await query(
      `INSERT INTO checklists
         (titulo, norma, normas, obra, responsavel, user_id, itens,
          geolocation, acompanhante, acompanhante_cargo)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       RETURNING *`,
      [
        titulo,
        norma,
        normas ? JSON.stringify(normas) : null,
        obra,
        responsavel || req.user.name,
        req.user.id,
        JSON.stringify(itens || []),
        geolocation ? JSON.stringify(geolocation) : null,
        acompanhante || null,
        acompanhanteCargo || null,
      ]
    );
    res.status(201).json({ checklist: rows[0], id: rows[0].id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao criar checklist' });
  }
});

// ─── PUT /v1/checklists/:id ───────────────────────────────────────────────────
router.put('/:id', auth, async (req, res) => {
  try {
    const {
      itens, status, progresso, observacoes, geolocation,
      acompanhante, acompanhanteCargo,
    } = req.body;

    // Busca valores atuais para não sobrescrever campos não enviados
    const current = await query('SELECT * FROM checklists WHERE id=$1', [req.params.id]);
    if (!current.rows[0]) return res.status(404).json({ error: 'Não encontrado' });
    const cur = current.rows[0];

    const { rows } = await query(
      `UPDATE checklists SET
         itens              = $1,
         status             = $2,
         progresso          = $3,
         observacoes        = $4,
         geolocation        = $5,
         acompanhante       = $6,
         acompanhante_cargo = $7,
         updated_at         = NOW()
       WHERE id = $8
       RETURNING *`,
      [
        itens     !== undefined ? JSON.stringify(itens)     : JSON.stringify(cur.itens),
        status    !== undefined ? status    : cur.status,
        progresso !== undefined ? progresso : cur.progresso,
        observacoes !== undefined ? observacoes : cur.observacoes,
        geolocation !== undefined ? JSON.stringify(geolocation) : cur.geolocation,
        acompanhante !== undefined ? acompanhante : cur.acompanhante,
        acompanhanteCargo !== undefined ? acompanhanteCargo : cur.acompanhante_cargo,
        req.params.id,
      ]
    );
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao atualizar' });
  }
});

// ─── DELETE /v1/checklists/:id  ← ROTA QUE FALTAVA ───────────────────────────
router.delete('/:id', auth, async (req, res) => {
  try {
    const { rows } = await query(
      'DELETE FROM checklists WHERE id=$1 RETURNING id',
      [req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Inspeção não encontrada' });
    res.json({ deleted: true, id: rows[0].id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao excluir checklist' });
  }
});

// ─── POST /v1/checklists/:id/concluir ────────────────────────────────────────
router.post('/:id/concluir', auth, async (req, res) => {
  try {
    const {
      assinatura, assinaturaData,
      assinaturaAcompanhante, assinaturaAcompanhanteData,
      conformidade, itens, observacoes, geolocation,
    } = req.body;

    await query(
      `UPDATE checklists SET
         status                       = 'concluido',
         progresso                    = 100,
         conformidade                 = $1,
         data_conclusao               = NOW(),
         assinatura                   = $2,
         assinatura_data              = $3,
         assinatura_acompanhante      = $4,
         assinatura_acompanhante_data = $5,
         itens                        = COALESCE($6, itens),
         observacoes                  = COALESCE($7, observacoes),
         geolocation                  = COALESCE($8, geolocation),
         updated_at                   = NOW()
       WHERE id = $9`,
      [
        conformidade || 0,
        assinatura || null,
        assinaturaData || null,
        assinaturaAcompanhante || null,
        assinaturaAcompanhanteData || null,
        itens ? JSON.stringify(itens) : null,
        observacoes || null,
        geolocation ? JSON.stringify(geolocation) : null,
        req.params.id,
      ]
    );
    res.json({ message: 'Checklist concluído com sucesso' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao concluir' });
  }
});

// ─── POST /v1/checklists/:id/pdf ─────────────────────────────────────────────
router.post('/:id/pdf', auth, async (req, res) => {
  try {
    const { rows } = await query('SELECT * FROM checklists WHERE id=$1', [req.params.id]);
    const cl = rows[0];
    if (!cl) return res.status(404).json({ error: 'Não encontrado' });

    const doc    = new PDFDocument({ margin: 50, size: 'A4' });
    const pdfDir = path.join(__dirname, '../../uploads/pdfs');
    fs.mkdirSync(pdfDir, { recursive: true });
    const pdfPath = path.join(pdfDir, `${cl.id}.pdf`);
    const stream  = fs.createWriteStream(pdfPath);
    doc.pipe(stream);

    // ── Header preto ──────────────────────────────────────────────────────────
    doc.rect(0, 0, 595, 110).fill('#1A1A1A');
    doc.fillColor('#F5C800').fontSize(26).font('Helvetica-Bold')
       .text('TREINAR', 50, 30);
    doc.fillColor('#FFFFFF').fontSize(11).font('Helvetica')
       .text('Engenharia de Segurança do Trabalho', 50, 62);
    doc.fillColor('rgba(245,200,0,0.7)').fontSize(9)
       .text('Relatório de Inspeção · treinar.eng.br', 50, 82);

    // Linha amarela
    doc.moveTo(0, 110).lineTo(595, 110).strokeColor('#F5C800').lineWidth(3).stroke();

    // ── Título ────────────────────────────────────────────────────────────────
    let y = 130;
    doc.fillColor('#1A1A1A').fontSize(16).font('Helvetica-Bold')
       .text(cl.titulo || 'Inspeção de Segurança', 50, y, { width: 495 });
    y += 30;

    // ── Info grid ─────────────────────────────────────────────────────────────
    const infoItems = [
      ['Norma(s)',      Array.isArray(cl.normas) ? cl.normas.join(', ') : (cl.norma || '—')],
      ['Obra / Local',  cl.obra || '—'],
      ['Inspetor',      cl.responsavel || '—'],
      ['Data início',   new Date(cl.data_criacao).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })],
      ['Conclusão',     cl.data_conclusao ? new Date(cl.data_conclusao).toLocaleString('pt-BR') : 'Em andamento'],
      ['Conformidade',  `${cl.conformidade || cl.progresso || 0}%`],
      ['Status',        (cl.status || '').replace('_', ' ').toUpperCase()],
    ];
    if (cl.acompanhante) infoItems.push(['Acompanhante', `${cl.acompanhante}${cl.acompanhante_cargo ? ' · ' + cl.acompanhante_cargo : ''}`]);
    if (cl.geolocation)  infoItems.push(['GPS', `${cl.geolocation.lat?.toFixed(5)}, ${cl.geolocation.lng?.toFixed(5)}`]);

    infoItems.forEach(([k, v]) => {
      doc.fillColor('#888888').fontSize(9).font('Helvetica').text(k, 50, y);
      doc.fillColor('#1A1A1A').fontSize(10).font('Helvetica-Bold').text(String(v), 175, y);
      y += 18;
    });

    // Separador
    y += 8;
    doc.moveTo(50, y).lineTo(545, y).strokeColor('#F5C800').lineWidth(1.5).stroke();
    y += 18;

    // ── Itens ─────────────────────────────────────────────────────────────────
    doc.fillColor('#1A1A1A').fontSize(12).font('Helvetica-Bold')
       .text('ITENS DA INSPEÇÃO', 50, y);
    y += 20;

    const itens = cl.itens || [];
    let currentNorma = '';

    itens.forEach((item) => {
      if (y > 720) { doc.addPage(); y = 50; }

      // Cabeçalho de NR quando muda
      const itemNorma = item._norma || item.norma || '';
      if (itemNorma && itemNorma !== currentNorma) {
        currentNorma = itemNorma;
        if (y > 50) y += 6;
        doc.rect(50, y, 495, 18).fill('#1A1A1A');
        doc.fillColor('#F5C800').fontSize(9).font('Helvetica-Bold')
           .text(itemNorma, 55, y + 4);
        y += 24;
      }

      // Status do item — suporta tanto conforme (novo) quanto checked (legado)
      const conforme = item.conforme === true || item.checked === true;
      const naoConforme = item.conforme === false;
      const semResposta = item.conforme === null || item.conforme === undefined;

      const statusColor = conforme ? '#2E7D32' : naoConforme ? '#C62828' : '#999999';
      const statusIcon  = conforme ? '✓' : naoConforme ? '✗' : '—';

      // Badge de crítico
      if (item.critico && naoConforme) {
        doc.rect(50, y, 42, 12).fill('#C62828').fillColor('#FFFFFF')
           .fontSize(7).font('Helvetica-Bold').text('CRÍTICO', 52, y + 2);
        y += 14;
      }

      doc.fillColor(statusColor).fontSize(11).font('Helvetica-Bold')
         .text(statusIcon, 50, y);
      doc.fillColor('#1A1A1A').fontSize(9).font('Helvetica')
         .text(item.texto || item.label || '', 68, y, { width: 460 });

      if (item.observacao || item.nota) {
        y += 14;
        doc.fillColor('#555555').fontSize(8).font('Helvetica')
           .text(`  Obs: ${item.observacao || item.nota}`, 68, y, { width: 460 });
      }
      y += 18;
    });

    // ── Resumo ────────────────────────────────────────────────────────────────
    const conformes   = itens.filter(i => i.conforme === true || i.checked === true).length;
    const naoConformes= itens.filter(i => i.conforme === false).length;
    const criticos    = itens.filter(i => i.critico && i.conforme === false).length;

    if (y > 680) { doc.addPage(); y = 50; }
    y += 10;
    doc.moveTo(50, y).lineTo(545, y).strokeColor('#E0E0E0').lineWidth(1).stroke();
    y += 15;
    doc.rect(50, y, 495, 60).fill('#F8F8F8');
    doc.fillColor('#1A1A1A').fontSize(11).font('Helvetica-Bold')
       .text(`Resumo: ${conformes} conformes · ${naoConformes} não conformes${criticos > 0 ? ` · ${criticos} críticos` : ''} · ${cl.conformidade || cl.progresso || 0}% conformidade`, 60, y + 10, { width: 475 });
    if (cl.observacoes) {
      doc.fillColor('#555').fontSize(9).font('Helvetica')
         .text(`Observações: ${cl.observacoes}`, 60, y + 30, { width: 475 });
    }
    y += 75;

    // ── Assinaturas ───────────────────────────────────────────────────────────
    if (cl.assinatura) {
      if (y > 680) { doc.addPage(); y = 50; }
      doc.moveTo(50, y).lineTo(545, y).strokeColor('#F5C800').lineWidth(1.5).stroke();
      y += 15;
      doc.fillColor('#1A1A1A').fontSize(12).font('Helvetica-Bold').text('ASSINATURAS', 50, y);
      y += 20;

      // Inspetor
      doc.rect(50, y, 230, 70).strokeColor('#CCCCCC').lineWidth(1).stroke();
      doc.fillColor('#888').fontSize(8).text('INSPETOR', 60, y + 8);
      doc.fillColor('#1A1A1A').fontSize(10).font('Helvetica-Bold').text(cl.assinatura, 60, y + 22);
      doc.moveTo(60, y + 55).lineTo(270, y + 55).strokeColor('#999').lineWidth(0.5).stroke();
      doc.fillColor('#999').fontSize(7).font('Helvetica').text('Assinatura', 60, y + 58);

      // Acompanhante
      if (cl.assinatura_acompanhante) {
        doc.rect(310, y, 235, 70).strokeColor('#CCCCCC').lineWidth(1).stroke();
        doc.fillColor('#888').fontSize(8).text('ACOMPANHANTE', 320, y + 8);
        doc.fillColor('#1A1A1A').fontSize(10).font('Helvetica-Bold').text(cl.assinatura_acompanhante, 320, y + 22);
        doc.moveTo(320, y + 55).lineTo(535, y + 55).strokeColor('#999').lineWidth(0.5).stroke();
        doc.fillColor('#999').fontSize(7).font('Helvetica').text('Assinatura', 320, y + 58);
      }
      y += 85;
    }

    // ── Footer ────────────────────────────────────────────────────────────────
    const pageCount = doc.bufferedPageRange().count || 1;
    doc.fontSize(7).font('Helvetica').fillColor('#AAAAAA')
       .text(
         `Relatório gerado em ${new Date().toLocaleString('pt-BR')} — Treinar Engenharia — treinar.eng.br`,
         50, 820, { align: 'center', width: 495 }
       );

    doc.end();

    stream.on('finish', async () => {
      const pdfUrl = `/uploads/pdfs/${cl.id}.pdf`;
      await query('UPDATE checklists SET pdf_url=$1 WHERE id=$2', [pdfUrl, cl.id]);
      res.json({ pdfUrl, message: 'PDF gerado com sucesso' });
    });

    stream.on('error', (err) => {
      console.error('Stream error:', err);
      res.status(500).json({ error: 'Erro ao gravar PDF' });
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao gerar PDF' });
  }
});

// ─── POST /v1/checklists/:id/itens/:itemId/foto ───────────────────────────────
router.post('/:id/itens/:itemId/foto', auth, upload.single('foto'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Nenhuma foto enviada' });

    const { rows } = await query('SELECT itens FROM checklists WHERE id=$1', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Não encontrado' });

    const itens = rows[0].itens.map((item) => {
      if (String(item.id) === String(req.params.itemId)) {
        return { ...item, foto: `/uploads/checklists/${req.params.id}/${req.file.filename}` };
      }
      return item;
    });

    const respondidos = itens.filter(i => i.conforme !== null && i.conforme !== undefined).length;
    const progresso   = itens.length > 0 ? Math.round((respondidos / itens.length) * 100) : 0;
    const status      = progresso === 100 ? 'concluido' : progresso > 0 ? 'em_andamento' : 'pendente';

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
