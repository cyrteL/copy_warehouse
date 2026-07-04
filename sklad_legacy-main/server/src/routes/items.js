import { Router } from 'express';
import pool from '../config/db.js';

const router = Router();

router.get('/', async (req, res, next) => {
  try {
    const [rows] = await pool.query('SELECT * FROM items');
    res.json(rows);
  } catch (e) { next(e); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const [rows] = await pool.query('SELECT * FROM items WHERE id = ?', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Not Found' });
    res.json(rows[0]);
  } catch (e) { next(e); }
});

router.post('/', async (req, res, next) => {
  try {
    const { name, category_id, price, quantity, description, barcode, min_quantity, location, supplier } = req.body;
    const [result] = await pool.query(
      `INSERT INTO items (name, category_id, price, quantity, description, barcode, min_quantity, location, supplier)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [name, category_id || null, price || 0, quantity || 0, description || '', barcode || '', min_quantity || 0, location || '', supplier || '']
    );
    const [rows] = await pool.query('SELECT * FROM items WHERE id = ?', [result.insertId]);
    res.status(201).json(rows[0]);
  } catch (e) { next(e); }
});

router.put('/:id', async (req, res, next) => {
  try {
    const { name, category_id, price, quantity, description, barcode, min_quantity, location, supplier } = req.body;
    await pool.query(
      `UPDATE items SET name=?, category_id=?, price=?, quantity=?, description=?, barcode=?, min_quantity=?, location=?, supplier=?, updated_at=NOW() WHERE id=?`,
      [name, category_id || null, price || 0, quantity || 0, description || '', barcode || '', min_quantity || 0, location || '', supplier || '', req.params.id]
    );
    const [rows] = await pool.query('SELECT * FROM items WHERE id = ?', [req.params.id]);
    res.json(rows[0]);
  } catch (e) { next(e); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    await pool.query('DELETE FROM items WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (e) { next(e); }
});

export default router;

