const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');

const TEMPLATES = [
  {
    id: 'nr18', norma: 'NR-18', titulo: 'Verificacao de EPI - Obra',
    itens: [
      { id:'i1', label:'Capacete com jugular em bom estado', obrigatorio:true, tipo:'checkbox' },
      { id:'i2', label:'Cinto de seguranca tipo paraquedista', obrigatorio:true, tipo:'checkbox' },
      { id:'i3', label:'Oculos de protecao adequados', obrigatorio:false, tipo:'checkbox' },
      { id:'i4', label:'Luvas adequadas para a atividade', obrigatorio:true, tipo:'checkbox' },
      { id:'i5', label:'Calcado de seguranca com biqueira', obrigatorio:true, tipo:'checkbox' },
    ]
  },
  {
    id: 'nr35', norma: 'NR-35', titulo: 'Trabalho em Altura - Pre-Atividade',
    itens: [
      { id:'i1', label:'Andaime inspecionado e liberado', obrigatorio:true, tipo:'checkbox' },
      { id:'i2', label:'Cinto paraquedista com talabarte duplo', obrigatorio:true, tipo:'checkbox' },
      { id:'i3', label:'Ponto de ancoragem identificado', obrigatorio:true, tipo:'checkbox' },
      { id:'i4', label:'Area abaixo sinalizada e isolada', obrigatorio:true, tipo:'checkbox' },
    ]
  },
  {
    id: 'nr6', norma: 'NR-6', titulo: 'Inspecao Semanal de EPI',
    itens: [
      { id:'i1', label:'Estoque minimo de capacetes disponivel', obrigatorio:true, tipo:'checkbox' },
      { id:'i2', label:'EPIs dentro do prazo de validade', obrigatorio:true, tipo:'checkbox' },
      { id:'i3', label:'Cintos sem avarias visiveis', obrigatorio:true, tipo:'checkbox' },
    ]
  },
  {
    id: 'nr12', norma: 'NR-12', titulo: 'Inspecao de Maquinas e Equipamentos',
    itens: [
      { id:'i1', label:'Protecoes de partes moveis instaladas', obrigatorio:true, tipo:'checkbox' },
      { id:'i2', label:'Dispositivo de parada de emergencia funcional', obrigatorio:true, tipo:'checkbox' },
      { id:'i3', label:'Aterramento eletrico verificado', obrigatorio:true, tipo:'checkbox' },
    ]
  }
];

router.get('/', authenticate, (req, res) => {
  res.json(TEMPLATES);
});

router.get('/:id', authenticate, (req, res) => {
  const t = TEMPLATES.find(t => t.id === req.params.id);
  if (!t) return res.status(404).json({ error: 'Template nao encontrado' });
  res.json(t);
});

module.exports = router;
