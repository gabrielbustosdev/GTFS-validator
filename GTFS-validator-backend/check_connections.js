import { config } from 'dotenv';
import pg from 'pg';
import { Redis } from 'ioredis';

config();

async function checkConnections() {
    console.log("🔍 Comprobando conexiones...");

    // 1. Check Redis (Upstash)
    const redisUrl = process.env.REDIS_URL;
    if (!redisUrl) {
        console.error("❌ REDIS_URL no está definida en .env");
    } else {
        const redis = new Redis(redisUrl, {
            tls: { rejectUnauthorized: false },
            maxRetriesPerRequest: 1
        });
        try {
            const pingRes = await redis.ping();
            if (pingRes === 'PONG') {
                console.log("✅ Conexión a Redis (Upstash) exitosa!");
            }
        } catch (e) {
            console.error("❌ Falla conectando a Redis:", e.message);
        } finally {
            redis.disconnect();
        }
    }

    console.log("-----------------------------------------");

    // 2. Check Database (Supabase)
    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) {
         console.error("❌ DATABASE_URL no está definida en .env");
    } else if (dbUrl.includes('[YOUR-PASSWORD]')) {
         console.error("❌ Aún no has reemplazado [YOUR-PASSWORD] en el archivo .env. Por favor edítalo.");
    } else {
        const { Client } = pg;
        const client = new Client({ connectionString: dbUrl });
        try {
            await client.connect();
            const res = await client.query('SELECT version();');
            console.log("✅ Conexión a PostgreSQL (Supabase) exitosa!");
            console.log("   Info:", res.rows[0].version);
            
            // Check for PostGIS
            const geoRes = await client.query('SELECT extversion FROM pg_extension WHERE extname = $1;', ['postgis']);
            if (geoRes.rows.length > 0) {
                 console.log(`✅ Extensión PostGIS detectada (v${geoRes.rows[0].extversion})`);
            } else {
                 console.log("⚠️ PostGIS no está activo por defecto. Recuerda activarlo luego: CREATE EXTENSION postgis;");
            }

        } catch (e) {
            console.error("❌ Falla conectando a PostgreSQL:", e.message);
        } finally {
            await client.end();
        }
    }
}

checkConnections();
