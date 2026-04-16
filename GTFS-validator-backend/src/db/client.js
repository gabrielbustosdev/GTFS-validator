import { config } from 'dotenv';
import pg from 'pg';

config();

const { Pool } = pg;

// Inicializamos el Pool de conexiones hacia Supabase (Transaction Pooler)
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20, // Máximo de clientes en el pool (Supabase permite bastantes si usamos connection pooler)
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
  ssl: { rejectUnauthorized: false }
});

pool.on('error', (err, client) => {
  console.error('❌ Error inesperado en el cliente de Postgres', err);
});

export default pool;
