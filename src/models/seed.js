// src/models/seed.js
const bcrypt = require('bcryptjs');
const { pool } = require('./db');

async function seed() {
  try {
    // Verifica se já tem usuários
    const { rows } = await pool.query('SELECT COUNT(*) FROM users');
    if (parseInt(rows[0].count) > 0) {
      console.log('Seed já executado, pulando...');
      return;
    }

    const hash = await bcrypt.hash('treinar123', 10);

    await pool.query(`
      INSERT INTO obras (nome, endereco, responsavel, status)
      VALUES ('Edifício Comercial Santos', 'Rua XV de Novembro, 200 - Santos/SP', 'Eng. Armindo', 'ativa')
    `);

    const { rows: obras } = await pool.query('SELECT id FROM obras LIMIT 1');
    const obraId = obras[0]?.id;

    await pool.query(`
      INSERT INTO users (name, email, password_hash, role, obra, obra_id)
      VALUES
        ('Armindo', 'armindo@treinar.eng.br', $1, 'inspetor', 'Edifício Comercial Santos', $2),
        ('Ana Costa', 'ana@treinar.eng.br', $1, 'inspetor', 'Edifício Comercial Santos', $2),
        ('Gestor', 'gestor@treinar.eng.br', $1, 'gestor', 'Edifício Comercial Santos', $2),
        ('Admin', 'admin@treinar.eng.br', $1, 'admin', null, null)
      ON CONFLICT (email) DO NOTHING
    `, [hash, obraId]);

    console.log('Seed concluído!');
    console.log('Login: armindo@treinar.eng.br / treinar123');
  } catch (err) {
    console.error('Erro no seed:', err.message);
  }
}

seed().catch(console.error);

module.exports = { seed };
