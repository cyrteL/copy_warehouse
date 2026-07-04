import express from 'express';
import emailService from '../services/emailService.js';
import { pool } from '../config/db.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// Отправка уведомления о низком остатке
router.post('/low-stock', authenticateToken, async (req, res) => {
    try {
        const { items } = req.body;
        
        if (!items || !Array.isArray(items)) {
            return res.status(400).json({ error: 'Необходимо указать список товаров' });
        }

        // Получаем пользователей с включенными уведомлениями
        const users = await emailService.getUsersWithNotifications('lowStockAlerts');
        
        const results = [];
        
        for (const user of users) {
            try {
                const result = await emailService.sendLowStockAlert(user, items);
                results.push({
                    userId: user.id,
                    email: user.email,
                    status: 'success',
                    messageId: result.messageId
                });
            } catch (error) {
                results.push({
                    userId: user.id,
                    email: user.email,
                    status: 'error',
                    error: error.message
                });
            }
        }

        res.json({
            message: 'Уведомления о низком остатке отправлены',
            results
        });
    } catch (error) {
        console.error('Ошибка отправки уведомлений о низком остатке:', error);
        res.status(500).json({ error: 'Ошибка отправки уведомлений' });
    }
});

// Отправка уведомления об операции
router.post('/operation', authenticateToken, async (req, res) => {
    try {
        const { operation } = req.body;
        
        if (!operation) {
            return res.status(400).json({ error: 'Необходимо указать данные операции' });
        }

        // Получаем пользователей с включенными уведомлениями
        const users = await emailService.getUsersWithNotifications('emailNotifications');
        
        const results = [];
        
        for (const user of users) {
            try {
                const result = await emailService.sendOperationNotification(user, operation);
                results.push({
                    userId: user.id,
                    email: user.email,
                    status: 'success',
                    messageId: result.messageId
                });
            } catch (error) {
                results.push({
                    userId: user.id,
                    email: user.email,
                    status: 'error',
                    error: error.message
                });
            }
        }

        res.json({
            message: 'Уведомления об операции отправлены',
            results
        });
    } catch (error) {
        console.error('Ошибка отправки уведомлений об операции:', error);
        res.status(500).json({ error: 'Ошибка отправки уведомлений' });
    }
});

// Отправка еженедельного отчета
router.post('/weekly-report', authenticateToken, async (req, res) => {
    try {
        const { report } = req.body;
        
        if (!report) {
            return res.status(400).json({ error: 'Необходимо указать данные отчета' });
        }

        // Получаем пользователей с включенными уведомлениями
        const users = await emailService.getUsersWithNotifications('operationReports');
        
        const results = [];
        
        for (const user of users) {
            try {
                const result = await emailService.sendWeeklyReport(user, report);
                results.push({
                    userId: user.id,
                    email: user.email,
                    status: 'success',
                    messageId: result.messageId
                });
            } catch (error) {
                results.push({
                    userId: user.id,
                    email: user.email,
                    status: 'error',
                    error: error.message
                });
            }
        }

        res.json({
            message: 'Еженедельные отчеты отправлены',
            results
        });
    } catch (error) {
        console.error('Ошибка отправки еженедельных отчетов:', error);
        res.status(500).json({ error: 'Ошибка отправки отчетов' });
    }
});

// Тестовая отправка email
router.post('/test', authenticateToken, async (req, res) => {
    try {
        const { email, subject, message } = req.body;
        
        if (!email || !subject || !message) {
            return res.status(400).json({ error: 'Необходимо указать email, subject и message' });
        }

        const testUser = {
            id: 1,
            name: 'Тестовый пользователь',
            email: email
        };

        const result = await emailService.sendEmail({
            to: email,
            subject: subject,
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2>Тестовое уведомление</h2>
                    <p>${message}</p>
                    <hr>
                    <p style="color: #666; font-size: 12px;">
                        Это тестовое уведомление от системы управления складом.<br>
                        Дата: ${new Date().toLocaleString('ru-RU')}
                    </p>
                </div>
            `
        });

        res.json({
            message: 'Тестовое уведомление отправлено',
            messageId: result.messageId
        });
    } catch (error) {
        console.error('Ошибка отправки тестового уведомления:', error);
        res.status(500).json({ error: 'Ошибка отправки тестового уведомления' });
    }
});

// Получение статуса email-сервиса
router.get('/status', authenticateToken, async (req, res) => {
    try {
        const status = {
            service: 'email',
            status: 'active',
            timestamp: new Date().toISOString(),
            features: {
                lowStockAlerts: true,
                operationNotifications: true,
                weeklyReports: true
            }
        };

        res.json(status);
    } catch (error) {
        console.error('Ошибка получения статуса email-сервиса:', error);
        res.status(500).json({ error: 'Ошибка получения статуса' });
    }
});

export default router;
