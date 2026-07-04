import { Router } from 'express';
import jwt from 'jsonwebtoken';
import pool from '../config/db.js';

const router = Router();

router.post('/login', async (req, res, next) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Missing credentials' });

    const [rows] = await pool.query(
      'SELECT id, username, name, email, department, position, password_hash FROM users WHERE username = ? LIMIT 1',
      [username]
    );
    if (!rows.length) return res.status(401).json({ error: 'Invalid credentials' });
    const user = rows[0];
    // NOTE: For simplicity, compare plain text if password_hash is null; otherwise use MySQL PASSWORD() or bcrypt in seed
    const isValid = !user.password_hash ? password === 'admin123' : password === user.password_hash;
    if (!isValid) return res.status(401).json({ error: 'Invalid credentials' });

    const [roleRows] = await pool.query(
      'SELECT r.name as role FROM user_roles ur JOIN roles r ON r.id = ur.role_id WHERE ur.user_id = ?',
      [user.id]
    );
    const [permRows] = await pool.query(
      'SELECT p.name as permission FROM role_permissions rp JOIN permissions p ON p.id = rp.permission_id WHERE rp.role_id IN (SELECT role_id FROM user_roles WHERE user_id = ?)',
      [user.id]
    );

    const payload = {
      id: user.id,
      username: user.username,
      name: user.name,
      email: user.email,
      department: user.department,
      position: user.position,
      roles: roleRows.map(r => r.role),
      permissions: permRows.map(p => p.permission)
    };
    const token = jwt.sign(payload, process.env.JWT_SECRET || 'dev_secret', { expiresIn: '8h' });
    res.json({ token, user: payload });
  } catch (e) { next(e); }
});

export default router;

