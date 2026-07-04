import { Router } from 'express';
import pool from '../config/db.js';

const router = Router();

router.get('/', async (req, res, next) => {
  try {
    const [[{ totalItems }]] = await pool.query('SELECT COALESCE(SUM(quantity),0) as totalItems FROM items');
    const [[{ totalValue }]] = await pool.query('SELECT COALESCE(SUM(price*quantity),0) as totalValue FROM items');
    const [[{ lowStockItems }]] = await pool.query('SELECT COUNT(*) as lowStockItems FROM items WHERE quantity <= min_quantity');
    const [[{ todayOperations }]] = await pool.query('SELECT COUNT(*) as todayOperations FROM operations WHERE DATE(date) = CURDATE()');
    const [[{ totalCategories }]] = await pool.query('SELECT COUNT(*) as totalCategories FROM categories');
    const [[{ totalOperations }]] = await pool.query('SELECT COUNT(*) as totalOperations FROM operations');
    res.json({ totalItems, totalValue, lowStockItems, todayOperations, totalCategories, totalOperations });
  } catch (e) { next(e); }
});

export default router;

