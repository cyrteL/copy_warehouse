import nodemailer from 'nodemailer';
import { pool } from '../config/db.js';

class EmailService {
    constructor() {
        this.transporter = null;
        this.init();
    }

    async init() {
        try {
            // Создаем транспортер для отправки email
            this.transporter = nodemailer.createTransporter({
                host: process.env.SMTP_HOST || 'smtp.gmail.com',
                port: process.env.SMTP_PORT || 587,
                secure: false, // true для 465, false для других портов
                auth: {
                    user: process.env.SMTP_USER,
                    pass: process.env.SMTP_PASS
                }
            });

            // Проверяем соединение
            await this.transporter.verify();
            console.log('Email сервис инициализирован успешно');
        } catch (error) {
            console.error('Ошибка инициализации email сервиса:', error);
            // Создаем мок-транспортер для демо-режима
            this.transporter = {
                sendMail: async (options) => {
                    console.log('📧 ДЕМО-РЕЖИМ: Email отправлен:', {
                        to: options.to,
                        subject: options.subject,
                        text: options.text
                    });
                    return { messageId: 'demo-' + Date.now() };
                }
            };
        }
    }

    // Отправка уведомления о низком остатке
    async sendLowStockAlert(user, items) {
        try {
            const itemList = items.map(item => 
                `- ${item.name}: ${item.quantity} шт. (мин. ${item.minQuantity} шт.)`
            ).join('\n');

            const emailContent = {
                to: user.email,
                subject: '⚠️ Внимание! Товары с низким запасом',
                html: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                        <h2 style="color: #dc3545;">⚠️ Внимание! Товары с низким запасом</h2>
                        <p>Здравствуйте, ${user.name}!</p>
                        <p>Система обнаружила товары с низким запасом на складе:</p>
                        <div style="background-color: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 5px; margin: 20px 0;">
                            <pre style="margin: 0; font-family: monospace;">${itemList}</pre>
                        </div>
                        <p><strong>Рекомендуется:</strong></p>
                        <ul>
                            <li>Проверить остатки на складе</li>
                            <li>Оформить заказ на пополнение</li>
                            <li>Связаться с поставщиками</li>
                        </ul>
                        <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
                        <p style="color: #666; font-size: 12px;">
                            Это автоматическое уведомление от системы управления складом.<br>
                            Дата: ${new Date().toLocaleString('ru-RU')}
                        </p>
                    </div>
                `
            };

            return await this.sendEmail(emailContent);
        } catch (error) {
            console.error('Ошибка отправки уведомления о низком остатке:', error);
            throw error;
        }
    }

    // Отправка уведомления об операции
    async sendOperationNotification(user, operation) {
        try {
            const operationType = operation.type === 'incoming' ? 'Приход' : 'Расход';
            const typeColor = operation.type === 'incoming' ? '#28a745' : '#ffc107';

            const emailContent = {
                to: user.email,
                subject: `📦 Операция: ${operationType} - ${operation.itemName}`,
                html: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                        <h2 style="color: ${typeColor};">📦 Операция: ${operationType}</h2>
                        <p>Здравствуйте, ${user.name}!</p>
                        <p>Была выполнена операция на складе:</p>
                        
                        <div style="background-color: #f8f9fa; border: 1px solid #dee2e6; padding: 20px; border-radius: 5px; margin: 20px 0;">
                            <table style="width: 100%; border-collapse: collapse;">
                                <tr>
                                    <td style="padding: 8px 0; font-weight: bold;">Товар:</td>
                                    <td style="padding: 8px 0;">${operation.itemName}</td>
                                </tr>
                                <tr>
                                    <td style="padding: 8px 0; font-weight: bold;">Количество:</td>
                                    <td style="padding: 8px 0;">${operation.quantity} шт.</td>
                                </tr>
                                <tr>
                                    <td style="padding: 8px 0; font-weight: bold;">Тип операции:</td>
                                    <td style="padding: 8px 0; color: ${typeColor}; font-weight: bold;">${operationType}</td>
                                </tr>
                                <tr>
                                    <td style="padding: 8px 0; font-weight: bold;">Дата:</td>
                                    <td style="padding: 8px 0;">${new Date(operation.date).toLocaleString('ru-RU')}</td>
                                </tr>
                                <tr>
                                    <td style="padding: 8px 0; font-weight: bold;">Сотрудник:</td>
                                    <td style="padding: 8px 0;">${operation.employeeName}</td>
                                </tr>
                            </table>
                        </div>
                        
                        <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
                        <p style="color: #666; font-size: 12px;">
                            Это автоматическое уведомление от системы управления складом.<br>
                            Дата: ${new Date().toLocaleString('ru-RU')}
                        </p>
                    </div>
                `
            };

            return await this.sendEmail(emailContent);
        } catch (error) {
            console.error('Ошибка отправки уведомления об операции:', error);
            throw error;
        }
    }

    // Отправка еженедельного отчета
    async sendWeeklyReport(user, report) {
        try {
            const emailContent = {
                to: user.email,
                subject: '📊 Еженедельный отчет по операциям склада',
                html: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                        <h2 style="color: #007bff;">📊 Еженедельный отчет</h2>
                        <p>Здравствуйте, ${user.name}!</p>
                        <p>Представляем вашему вниманию еженедельный отчет по операциям склада:</p>
                        
                        <div style="background-color: #f8f9fa; border: 1px solid #dee2e6; padding: 20px; border-radius: 5px; margin: 20px 0;">
                            <h3 style="margin-top: 0;">Статистика за неделю:</h3>
                            <table style="width: 100%; border-collapse: collapse;">
                                <tr style="background-color: #e9ecef;">
                                    <td style="padding: 12px; border: 1px solid #dee2e6; font-weight: bold;">Показатель</td>
                                    <td style="padding: 12px; border: 1px solid #dee2e6; font-weight: bold;">Значение</td>
                                </tr>
                                <tr>
                                    <td style="padding: 12px; border: 1px solid #dee2e6;">Всего операций</td>
                                    <td style="padding: 12px; border: 1px solid #dee2e6;">${report.totalOperations}</td>
                                </tr>
                                <tr>
                                    <td style="padding: 12px; border: 1px solid #dee2e6;">Приходы</td>
                                    <td style="padding: 12px; border: 1px solid #dee2e6; color: #28a745;">${report.incoming}</td>
                                </tr>
                                <tr>
                                    <td style="padding: 12px; border: 1px solid #dee2e6;">Расходы</td>
                                    <td style="padding: 12px; border: 1px solid #dee2e6; color: #ffc107;">${report.outgoing}</td>
                                </tr>
                            </table>
                        </div>
                        
                        ${report.operations.length > 0 ? `
                        <div style="background-color: #f8f9fa; border: 1px solid #dee2e6; padding: 20px; border-radius: 5px; margin: 20px 0;">
                            <h3 style="margin-top: 0;">Последние операции:</h3>
                            <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
                                <tr style="background-color: #e9ecef;">
                                    <td style="padding: 8px; border: 1px solid #dee2e6; font-weight: bold;">Дата</td>
                                    <td style="padding: 8px; border: 1px solid #dee2e6; font-weight: bold;">Тип</td>
                                    <td style="padding: 8px; border: 1px solid #dee2e6; font-weight: bold;">Товар</td>
                                    <td style="padding: 8px; border: 1px solid #dee2e6; font-weight: bold;">Кол-во</td>
                                </tr>
                                ${report.operations.slice(0, 10).map(op => `
                                    <tr>
                                        <td style="padding: 8px; border: 1px solid #dee2e6;">${new Date(op.date).toLocaleDateString('ru-RU')}</td>
                                        <td style="padding: 8px; border: 1px solid #dee2e6; color: ${op.type === 'incoming' ? '#28a745' : '#ffc107'};">${op.type === 'incoming' ? 'Приход' : 'Расход'}</td>
                                        <td style="padding: 8px; border: 1px solid #dee2e6;">${op.itemName}</td>
                                        <td style="padding: 8px; border: 1px solid #dee2e6;">${op.quantity}</td>
                                    </tr>
                                `).join('')}
                            </table>
                        </div>
                        ` : ''}
                        
                        <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
                        <p style="color: #666; font-size: 12px;">
                            Это автоматический еженедельный отчет от системы управления складом.<br>
                            Дата формирования: ${new Date().toLocaleString('ru-RU')}
                        </p>
                    </div>
                `
            };

            return await this.sendEmail(emailContent);
        } catch (error) {
            console.error('Ошибка отправки еженедельного отчета:', error);
            throw error;
        }
    }

    // Общая функция отправки email
    async sendEmail(emailContent) {
        try {
            const mailOptions = {
                from: process.env.SMTP_FROM || process.env.SMTP_USER,
                to: emailContent.to,
                subject: emailContent.subject,
                html: emailContent.html
            };

            const result = await this.transporter.sendMail(mailOptions);
            console.log('Email отправлен успешно:', result.messageId);
            return result;
        } catch (error) {
            console.error('Ошибка отправки email:', error);
            throw error;
        }
    }

    // Получение пользователей с включенными уведомлениями
    async getUsersWithNotifications(notificationType) {
        try {
            const [rows] = await pool.execute(`
                SELECT u.id, u.name, u.email, u.department, u.position
                FROM users u
                WHERE u.active = 1
            `);

            // В реальном приложении здесь была бы проверка настроек пользователей
            // Пока возвращаем всех активных пользователей
            return rows;
        } catch (error) {
            console.error('Ошибка получения пользователей:', error);
            return [];
        }
    }
}

export default new EmailService();
