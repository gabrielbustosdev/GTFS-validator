import { Worker } from 'bullmq';
import IORedis from 'ioredis';
import { config } from 'dotenv';
import { gtfsQueueName } from '../queue/jobQueue.js';
import { processJob } from './processor.js';

config();

const connection = new IORedis(process.env.REDIS_URL, {
  tls: { rejectUnauthorized: false },
  maxRetriesPerRequest: null,
});

// Inicializa el Worker que escuchará la cola apuntando a la función processJob
const worker = new Worker(gtfsQueueName, processJob, {
  connection,
  concurrency: 2 // Numero de ZIPs que procesará simultáneamente (Evita colapsar RAM/Postgres)
});

worker.on('completed', job => {
  console.log(`✅ [Worker] Trabajo ${job.id} completado con éxito.`);
});

worker.on('failed', (job, err) => {
  console.error(`❌ [Worker] Trabajo ${job.id} falló criticamente:`, err.message);
});

console.log(`👷 [Worker] Inicializado. Escuchando la cola Redis "${gtfsQueueName}"...`);
