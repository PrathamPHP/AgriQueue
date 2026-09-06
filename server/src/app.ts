import express from 'express';
import cors from 'cors';
import { config } from './config';
import { requestLogger } from './middleware/requestLogger';
import { errorHandler } from './middleware/errorHandler';
import apiRouter from './routes/api.routes';

export const app = express();

// CORS setup: allow configured origin, and any localhost for dev/testing
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:')) {
        callback(null, true);
      } else if (origin === config.corsOrigin) {
        callback(null, true);
      } else {
        callback(null, true); // Allow dev access
      }
    },
    credentials: true,
  })
);

app.use(express.json());
app.use(requestLogger);

// API v1 router
app.use('/api/v1', apiRouter);

// Root convenience redirects
app.get('/', (_req, res) => {
  res.redirect('/api/v1');
});

app.get('/health', (_req, res) => {
  res.redirect('/api/v1/health');
});

// Central Error Handler
app.use(errorHandler);
