import express from 'express';
import { pool } from '../config/db.js';
import { authenticateToken } from '../middleware/auth.js';
import { logger } from '../config/logger.js';

const router = express.Router();

// Хелпер: построить условия фильтра
function buildFilters(query) {
    const where = [];
    const params = [];

    if (query.dateFrom) {
        where.push('op.date >= ?');
        params.push(query.dateFrom);
    }
    if (query.dateTo) {
        where.push('op.date <= ?');
        params.push(query.dateTo + ' 23:59:59');
    }
    if (query.opType) {
        where.push('op.type = ?');
        params.push(query.opType);
    }
    if (query.categoryId) {
        where.push('it.category_id = ?');
        params.push(query.categoryId);
    }
    if (query.itemQuery) {
        where.push('(it.name LIKE ? OR it.barcode LIKE ?)');
        params.push(`%${query.itemQuery}%`, `%${query.itemQuery}%`);
    }
    if (query.employeeQuery) {
        where.push('(u.username LIKE ? OR u.name LIKE ?)');
        params.push(`%${query.employeeQuery}%`, `%${query.employeeQuery}%`);
    }

    const whereSql = where.length ? 'WHERE ' + where.join(' AND ') : '';
    return { whereSql, params };
}

// Сводные показатели
router.get('/summary', authenticateToken, async (req, res) => {
    try {
        const { whereSql, params } = buildFilters(req.query);
        const [rows] = await pool.execute(`
            SELECT 
                SUM(CASE WHEN op.type = 'incoming' THEN op.quantity ELSE 0 END) AS totalIncoming,
                SUM(CASE WHEN op.type = 'outgoing' THEN op.quantity ELSE 0 END) AS totalOutgoing,
                COUNT(*) AS totalOperations,
                COUNT(DISTINCT op.item_id) AS uniqueItems
            FROM operations op
            JOIN items it ON it.id = op.item_id
            LEFT JOIN users u ON u.id = op.employee_id
            ${whereSql}
        `, params);

        res.json(rows[0] || { totalIncoming: 0, totalOutgoing: 0, totalOperations: 0, uniqueItems: 0 });
    } catch (e) {
        logger.error(e);
        res.status(500).json({ error: 'Внутренняя ошибка сервера' });
    }
});

// Операции (подробный список)
router.get('/operations', authenticateToken, async (req, res) => {
    try {
        const { whereSql, params } = buildFilters(req.query);
        const [rows] = await pool.execute(`
            SELECT 
                op.id,
                op.date,
                op.type,
                op.quantity,
                it.name AS itemName,
                cat.name AS categoryName,
                u.username AS username,
                u.name AS employeeName
            FROM operations op
            JOIN items it ON it.id = op.item_id
            LEFT JOIN categories cat ON cat.id = it.category_id
            LEFT JOIN users u ON u.id = op.employee_id
            ${whereSql}
            ORDER BY op.date DESC
            LIMIT 1000
        `, params);

        res.json(rows);
    } catch (e) {
        logger.error(e);
        res.status(500).json({ error: 'Внутренняя ошибка сервера' });
    }
});

// Остатки по категориям
router.get('/by-category', authenticateToken, async (req, res) => {
    try {
        // Для by-category учитываем только фильтры по категории/дате не критично; считаем текущие остатки
        const [rows] = await pool.execute(`
            SELECT 
                cat.name AS categoryName,
                COUNT(it.id) AS itemCount,
                COALESCE(SUM(it.quantity), 0) AS totalQuantity
            FROM categories cat
            LEFT JOIN items it ON it.category_id = cat.id
            GROUP BY cat.id
            ORDER BY cat.name
        `);
        res.json(rows);
    } catch (e) {
        logger.error(e);
        res.status(500).json({ error: 'Внутренняя ошибка сервера' });
    }
});

// Топ товаров по движению
router.get('/top-items', authenticateToken, async (req, res) => {
    try {
        const { whereSql, params } = buildFilters(req.query);
        const [rows] = await pool.execute(`
            SELECT 
                it.name AS itemName,
                SUM(CASE WHEN op.type = 'incoming' THEN op.quantity ELSE 0 END) AS totalIncoming,
                SUM(CASE WHEN op.type = 'outgoing' THEN op.quantity ELSE 0 END) AS totalOutgoing
            FROM operations op
            JOIN items it ON it.id = op.item_id
            LEFT JOIN users u ON u.id = op.employee_id
            ${whereSql}
            GROUP BY it.id
            ORDER BY (SUM(CASE WHEN op.type = 'incoming' THEN op.quantity ELSE 0 END) +
                      SUM(CASE WHEN op.type = 'outgoing' THEN op.quantity ELSE 0 END)) DESC
            LIMIT 20
        `, params);

        res.json(rows);
    } catch (e) {
        logger.error(e);
        res.status(500).json({ error: 'Внутренняя ошибка сервера' });
    }
});

export default router;
