import { Router } from 'express';
import pool from '../config/db.js';

const router = Router();

router.get('/', async (req, res, next) => {
  try {
    const { type, startDate, endDate, itemId, sortBy = 'date', sortOrder = 'desc' } = req.query;
    const where = [];
    const params = [];
    if (type) { where.push('o.type = ?'); params.push(type); }
    if (startDate) { where.push('o.date >= ?'); params.push(startDate); }
    if (endDate) { where.push('o.date <= ?'); params.push(endDate); }
    if (itemId) { where.push('o.item_id = ?'); params.push(itemId); }
    const whereSql = where.length ? 'WHERE ' + where.join(' AND ') : '';
    const orderSql = `ORDER BY o.${sortBy === 'quantity' ? 'quantity' : 'date'} ${sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC'}`;
    const [rows] = await pool.query(
      `SELECT o.id, o.date, o.type, o.quantity, o.status, o.notes, o.supplier, o.recipient,
              i.name as itemName, i.id as itemId,
              u.name as employeeName, u.id as employeeId
         FROM operations o
         JOIN items i ON i.id = o.item_id
         JOIN users u ON u.id = o.employee_id
         ${whereSql}
         ${orderSql}`,
      params
    );
    res.json(rows);
  } catch (e) { next(e); }
});

router.post('/incoming', async (req, res, next) => {
  const conn = await pool.getConnection();
  try {
    const { itemId, quantity, supplier, notes, employeeId } = req.body;
    await conn.beginTransaction();
    await conn.query('UPDATE items SET quantity = quantity + ?, updated_at=NOW() WHERE id = ?', [quantity, itemId]);
    const [result] = await conn.query(
      'INSERT INTO operations (type, item_id, quantity, employee_id, status, notes, supplier) VALUES ("incoming", ?, ?, ?, "completed", ?, ?)',
      [itemId, quantity, employeeId || 1, notes || '', supplier || '']
    );
    await conn.commit();
    const [rows] = await conn.query('SELECT * FROM operations WHERE id = ?', [result.insertId]);
    res.status(201).json(rows[0]);
  } catch (e) {
    await conn.rollback();
    next(e);
  } finally {
    conn.release();
  }
});

router.post('/outgoing', async (req, res, next) => {
  const conn = await pool.getConnection();
  try {
    const { itemId, quantity, recipient, notes, employeeId } = req.body;
    await conn.beginTransaction();
    const [itemRows] = await conn.query('SELECT quantity FROM items WHERE id = ?', [itemId]);
    if (!itemRows.length) throw new Error('Item not found');
    if (itemRows[0].quantity < quantity) {
      return res.status(400).json({ error: 'Insufficient quantity' });
    }
    await conn.query('UPDATE items SET quantity = quantity - ?, updated_at=NOW() WHERE id = ?', [quantity, itemId]);
    const [result] = await conn.query(
      'INSERT INTO operations (type, item_id, quantity, employee_id, status, notes, recipient) VALUES ("outgoing", ?, ?, ?, "completed", ?, ?)',
      [itemId, quantity, employeeId || 1, notes || '', recipient || '']
    );
    await conn.commit();
    const [rows] = await conn.query('SELECT * FROM operations WHERE id = ?', [result.insertId]);
    res.status(201).json(rows[0]);
  } catch (e) {
    await conn.rollback();
    next(e);
  } finally {
    conn.release();
  }
});

export default router;

