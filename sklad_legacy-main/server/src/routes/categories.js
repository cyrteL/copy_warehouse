import { Router } from 'express';
import pool from '../config/db.js';

const router = Router();

router.get('/', async (req, res, next) => {
  try {
    const [rows] = await pool.query('SELECT c.*, (SELECT COUNT(*) FROM items i WHERE i.category_id = c.id) AS itemCount FROM categories c');
    res.json(rows);
  } catch (e) { next(e); }
});

router.post('/', async (req, res, next) => {
  try {
    const { name, description, icon, color, active } = req.body;
    const [result] = await pool.query(
      'INSERT INTO categories (name, description, icon, color, active) VALUES (?, ?, ?, ?, ?)',
      [name, description || '', icon || 'fas fa-tag', color || '#2c5aa0', active ? 1 : 0]
    );
    const [rows] = await pool.query('SELECT * FROM categories WHERE id = ?', [result.insertId]);
    res.status(201).json(rows[0]);
  } catch (e) { next(e); }
});

router.put('/:id', async (req, res, next) => {
  try {
    const { name, description, icon, color, active } = req.body;
    await pool.query(
      'UPDATE categories SET name=?, description=?, icon=?, color=?, active=?, updated_at=NOW() WHERE id = ?',
      [name, description || '', icon || 'fas fa-tag', color || '#2c5aa0', active ? 1 : 0, req.params.id]
    );
    const [rows] = await pool.query('SELECT * FROM categories WHERE id = ?', [req.params.id]);
    res.json(rows[0]);
  } catch (e) { next(e); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    await pool.query('DELETE FROM items WHERE category_id = ?', [req.params.id]);
    await pool.query('DELETE FROM categories WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (e) { next(e); }
});

export default router;

