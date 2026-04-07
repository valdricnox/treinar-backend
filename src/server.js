process.on('uncaughtException', (err) => {
  console.error('ERRO FATAL:', err.message);
  console.error(err.stack);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  console.error('PROMISE REJEITADA:', reason);
  process.exit(1);
});
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const { createTables } = require('./models/db');
const bcrypt = require('bcryptjs');
const { query } = require('./models/db');

const app = express();
app.use(helmet());
app.use(cors({ origin: '*' }));
app.use(morgan('combined'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

app.use('/v1/auth',       require('./routes/auth'));
app.use('/v1/checklists', require('./routes/checklists'));
app.use('/v1/incidentes', require('./routes/incidents'));
app.use('/v1/templates',  require('./routes/templates'));
app.use('/v1/obras',      require('./routes/obras'));
app.use('/v1/users',      require('./routes/users'));

app.get('/health', (req, res) => res.json({ status: 'OK' }));
app.use((req, res) => res.status(404).json({ error: 'Nao encontrado' }));
app.use((err, req, res, next) => res.status(500).json({ error: err.message }));

const PORT = process.env.PORT || 8000;

async function start() {
  try {
    await createTables();
    
    // Seed inicial
    const { rows } = await query('SELECT COUNT(*) FROM users');
    if (parseInt(rows[0].count) === 0) {
      const hash = await bcrypt.hash('treinar123', 10);
      await query(`INSERT INTO users (name,email,password_hash,role) VALUES
        ('Armindo','armindo@treinar.eng.br',$1,'inspetor'),
        ('Gestor','gestor@treinar.eng.br',$1,'gestor'),
        ('Admin','admin@treinar.eng.br',$1,'admin')
        ON CONFLICT DO NOTHING`, [hash]);
      console.log('Usuarios criados');
    }

    app.listen(PORT, () => console.log(`Treinar API rodando na porta ${PORT}`));
  } catch (err) {
    console.error('Erro ao iniciar:', err);
    process.exit(1);
  }
}

start();
