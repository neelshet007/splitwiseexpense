import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { env } from './config/env';
import { requestLogger } from './middleware/requestLogger.middleware';
import { errorHandler } from './middleware/errorHandler.middleware';

// Routes
import authRouter from './modules/auth/auth.routes';
import usersRouter from './modules/users/users.routes';
import groupsRouter from './modules/groups/groups.routes';
import { groupExpensesRouter, directExpensesRouter } from './modules/expenses/expenses.routes';
import { groupBalancesRouter, dashboardRouter } from './modules/balances/balances.routes';
import telegramRouter from './modules/telegram/telegram.routes';
import friendsRouter from './modules/friends/friends.routes';

export const app = express();

// 1. Core Middlewares
app.use(
  cors({
    origin: [env.APP_URL, 'http://localhost:3000', 'http://127.0.0.1:3000'],
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Telegram-Bot-Api-Secret-Token']
  })
);

app.use(express.json());
app.use(cookieParser());
app.use(requestLogger);

// 2. Health Check
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 3. API Routes
app.use('/api/auth', authRouter);
app.use('/api/users', usersRouter);
app.use('/api/friends', friendsRouter);
app.use('/api/groups', groupsRouter);
app.use('/api/groups/:groupId/expenses', groupExpensesRouter);
app.use('/api/groups/:groupId', groupBalancesRouter);
app.use('/api/expenses', directExpensesRouter);
app.use('/api/dashboard', dashboardRouter);
app.use('/api/telegram', telegramRouter);

// 4. Centralized Error Handler
app.use(errorHandler);
