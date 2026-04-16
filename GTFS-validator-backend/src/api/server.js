import express from 'express';
import cors from 'cors';
import { config } from 'dotenv';
import apiRoutes from './routes.js';

config();

const app = express();
const port = process.env.PORT || 3001;

// Middlewares
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*'
}));
app.use(express.json());

// Routes
app.use('/api', apiRoutes);

// Health check para el balanceador / railway / render
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', service: 'gtfs-validator-api' });
});

// Start
app.listen(port, () => {
  console.log(`🚀 GTFS Validator API corriendo en http://localhost:${port}`);
  console.log(`📡 BullMQ encolará trabajos usando tu Redis alojado remotamente.`);
});
