import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import pino from 'pino';
import dotenv from 'dotenv';

import authRoutes from './routes/auth.js';
import itemRoutes from './routes/items.js';
import categoryRoutes from './routes/categories.js';
import operationRoutes from './routes/operations.js';
import statsRoutes from './routes/stats.js';
import usersRoutes from './routes/users.js';
import reportsRoutes from './routes/reports.js';
import notificationsRoutes from './routes/notifications.js';

dotenv.config();

const app = express();
const logger = pino({ level: process.env.NODE_ENV === 'production' ? 'info' : 'debug' });

app.use(helmet());
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.use('/api/auth', authRoutes);
app.use('/api/items', itemRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/operations', operationRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/notifications', notificationsRoutes);

// Not found handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not Found' });
});

// Error handler
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  logger.error(err);
  res.status(err.status || 500).json({ error: err.message || 'Internal Server Error' });
});

const port = Number(process.env.PORT || 3001);
app.listen(port, () => {
  logger.info(`API listening on http://localhost:${port}`);
});


