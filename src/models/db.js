const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || process.env.DATABASE_PUBLIC_URL,
  ssl: { rejectUnauthorized: false },
});

const createTables = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name VARCHAR(255) NOT NULL,
      email VARCHAR(255) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      role VARCHAR(50) DEFAULT 'inspetor',
      obra VARCHAR(255),
      obra_id UUID,
      created_at TIMESTAMP DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS sessions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID REFERENCES users(id) ON DELETE CASCADE,
      token TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT NOW(),
      expires_at TIMESTAMP DEFAULT NOW() + INTERVAL '7 days'
    );
    CREATE TABLE IF NOT EXISTS obras (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      nome VARCHAR(255) NOT NULL,
      endereco TEXT,
      responsavel VARCHAR(255),
      status VARCHAR(50) DEFAULT 'ativa',
      created_at TIMESTAMP DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS checklists (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      titulo VARCHAR(500) NOT NULL,
      norma VARCHAR(50),
      obra_id UUID,
      obra VARCHAR(255),
      responsavel VARCHAR(255),
      user_id UUID REFERENCES users(id),
      status VARCHAR(50) DEFAULT 'pendente',
      progresso INTEGER DEFAULT 0,
      itens JSONB DEFAULT '[]',
      geolocation JSONB,
      pdf_uri TEXT,
      data_criacao TIMESTAMP DEFAULT NOW(),
      data_conclusao TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS incidentes (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      titulo VARCHAR(500) NOT NULL,
      descricao TEXT,
      severidade VARCHAR(50) DEFAULT 'media',
      tipo VARCHAR(100) DEFAULT 'nao_conformidade',
      local VARCHAR(255),
      obra VARCHAR(255),
      responsavel VARCHAR(255),
      user_id UUID REFERENCES users(id),
      status VARCHAR(50) DEFAULT 'aberto',
      fotos JSONB DEFAULT '[]',
      geolocation JSONB,
      acao TEXT,
      data_criacao TIMESTAMP DEFAULT NOW()
    );
  `);
  console.log('Tabelas OK');
};

const query = (text, params) => pool.query(text, params);

module.exports = { pool, query, createTables };
