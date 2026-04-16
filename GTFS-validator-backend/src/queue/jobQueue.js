import { Queue, QueueEvents } from 'bullmq';
import IORedis from 'ioredis';
import { config } from 'dotenv';

config();

// Configuración recomendada para Upstash (TLS activo y maxRetriesPerRequest null para BullMQ)
const connection = new IORedis(process.env.REDIS_URL, {
  tls: { rejectUnauthorized: false },
  maxRetriesPerRequest: null,
});

export const gtfsQueueName = 'ValidateGTFSQueue';

export const gtfsQueue = new Queue(gtfsQueueName, {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 2000 },
    removeOnComplete: { age: 3600, count: 100 }, // Guardar el reporte JSON durante 1 hora
    removeOnFail: false
  }
});

// QueueEvents permite seguir el progreso
export const queueEvents = new QueueEvents(gtfsQueueName, { connection });

/**
 * Añade un trabajo a la cola
 * @param {string} filePath Ruta del archivo ZIP temporal
 * @param {string} originalName Nombre original del archivo para metadata
 */
export async function addValidationJob(filePath, originalName) {
  const job = await gtfsQueue.add('validate-gtfs-feed', { filePath, originalName });
  return job.id;
}
