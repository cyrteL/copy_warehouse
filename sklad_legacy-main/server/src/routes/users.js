import express from 'express';
import { pool } from '../config/db.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import { logger } from '../config/logger.js';

const router = express.Router();

// Получить всех пользователей (только для админов)
router.get('/', authenticateToken, requireRole('admin'), async (req, res) => {
    try {
        const [rows] = await pool.execute(`
            SELECT 
                u.id,
                u.username,
                u.name,
                u.email,
                u.department,
                u.position,
                u.active,
                u.created_at,
                u.last_login,
                GROUP_CONCAT(DISTINCT r.name) as roles,
                GROUP_CONCAT(DISTINCT p.name) as permissions
            FROM users u
            LEFT JOIN user_roles ur ON u.id = ur.user_id
            LEFT JOIN roles r ON ur.role_id = r.id
            LEFT JOIN role_permissions rp ON r.id = rp.role_id
            LEFT JOIN permissions p ON rp.permission_id = p.id
            GROUP BY u.id
            ORDER BY u.name
        `);

        // Преобразуем данные в нужный формат
        const users = rows.map(row => ({
            id: row.id,
            username: row.username,
            name: row.name,
            email: row.email,
            department: row.department,
            position: row.position,
            active: Boolean(row.active),
            createdAt: row.created_at,
            lastLogin: row.last_login,
            roles: row.roles ? row.roles.split(',') : [],
            permissions: row.permissions ? row.permissions.split(',') : []
        }));

        res.json(users);
    } catch (error) {
        logger.error('Ошибка при получении пользователей:', error);
        res.status(500).json({ error: 'Внутренняя ошибка сервера' });
    }
});

// Получить пользователя по ID (только для админов)
router.get('/:id', authenticateToken, requireRole('admin'), async (req, res) => {
    try {
        const userId = parseInt(req.params.id);
        
        const [rows] = await pool.execute(`
            SELECT 
                u.id,
                u.username,
                u.name,
                u.email,
                u.department,
                u.position,
                u.active,
                u.created_at,
                u.last_login,
                GROUP_CONCAT(DISTINCT r.name) as roles,
                GROUP_CONCAT(DISTINCT p.name) as permissions
            FROM users u
            LEFT JOIN user_roles ur ON u.id = ur.user_id
            LEFT JOIN roles r ON ur.role_id = r.id
            LEFT JOIN role_permissions rp ON r.id = rp.role_id
            LEFT JOIN permissions p ON rp.permission_id = p.id
            WHERE u.id = ?
            GROUP BY u.id
        `, [userId]);

        if (rows.length === 0) {
            return res.status(404).json({ error: 'Пользователь не найден' });
        }

        const user = rows[0];
        const userData = {
            id: user.id,
            username: user.username,
            name: user.name,
            email: user.email,
            department: user.department,
            position: user.position,
            active: Boolean(user.active),
            createdAt: user.created_at,
            lastLogin: user.last_login,
            roles: user.roles ? user.roles.split(',') : [],
            permissions: user.permissions ? user.permissions.split(',') : []
        };

        res.json(userData);
    } catch (error) {
        logger.error('Ошибка при получении пользователя:', error);
        res.status(500).json({ error: 'Внутренняя ошибка сервера' });
    }
});

// Создать нового пользователя (только для админов)
router.post('/', authenticateToken, requireRole('admin'), async (req, res) => {
    try {
        const { username, name, email, department, position, password, roles } = req.body;

        // Валидация данных
        if (!username || !name || !email || !password || !roles || roles.length === 0) {
            return res.status(400).json({ error: 'Все обязательные поля должны быть заполнены' });
        }

        if (password.length < 6) {
            return res.status(400).json({ error: 'Пароль должен содержать минимум 6 символов' });
        }

        // Проверка уникальности username
        const [existingUsers] = await pool.execute(
            'SELECT id FROM users WHERE username = ?',
            [username]
        );

        if (existingUsers.length > 0) {
            return res.status(400).json({ error: 'Пользователь с таким именем уже существует' });
        }

        // Проверка уникальности email
        const [existingEmails] = await pool.execute(
            'SELECT id FROM users WHERE email = ?',
            [email]
        );

        if (existingEmails.length > 0) {
            return res.status(400).json({ error: 'Пользователь с таким email уже существует' });
        }

        // Начинаем транзакцию
        const connection = await pool.getConnection();
        await connection.beginTransaction();

        try {
            // Создаем пользователя
            const [result] = await connection.execute(`
                INSERT INTO users (username, name, email, department, position, password_hash, active, created_at)
                VALUES (?, ?, ?, ?, ?, ?, 1, NOW())
            `, [username, name, email, department || null, position || null, password]);

            const userId = result.insertId;

            // Добавляем роли пользователю
            for (const roleName of roles) {
                const [roleResult] = await connection.execute(
                    'SELECT id FROM roles WHERE name = ?',
                    [roleName]
                );

                if (roleResult.length > 0) {
                    await connection.execute(
                        'INSERT INTO user_roles (user_id, role_id) VALUES (?, ?)',
                        [userId, roleResult[0].id]
                    );
                }
            }

            await connection.commit();

            // Получаем созданного пользователя
            const [newUser] = await pool.execute(`
                SELECT 
                    u.id,
                    u.username,
                    u.name,
                    u.email,
                    u.department,
                    u.position,
                    u.active,
                    u.created_at,
                    u.last_login,
                    GROUP_CONCAT(DISTINCT r.name) as roles,
                    GROUP_CONCAT(DISTINCT p.name) as permissions
                FROM users u
                LEFT JOIN user_roles ur ON u.id = ur.user_id
                LEFT JOIN roles r ON ur.role_id = r.id
                LEFT JOIN role_permissions rp ON r.id = rp.role_id
                LEFT JOIN permissions p ON rp.permission_id = p.id
                WHERE u.id = ?
                GROUP BY u.id
            `, [userId]);

            const user = newUser[0];
            const userData = {
                id: user.id,
                username: user.username,
                name: user.name,
                email: user.email,
                department: user.department,
                position: user.position,
                active: Boolean(user.active),
                createdAt: user.created_at,
                lastLogin: user.last_login,
                roles: user.roles ? user.roles.split(',') : [],
                permissions: user.permissions ? user.permissions.split(',') : []
            };

            logger.info(`Создан новый пользователь: ${username} (ID: ${userId})`);
            res.status(201).json(userData);

        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }

    } catch (error) {
        logger.error('Ошибка при создании пользователя:', error);
        res.status(500).json({ error: 'Внутренняя ошибка сервера' });
    }
});

// Обновить пользователя (только для админов)
router.put('/:id', authenticateToken, requireRole('admin'), async (req, res) => {
    try {
        const userId = parseInt(req.params.id);
        const { username, name, email, department, position, password, roles } = req.body;

        // Валидация данных
        if (!username || !name || !email || !roles || roles.length === 0) {
            return res.status(400).json({ error: 'Все обязательные поля должны быть заполнены' });
        }

        if (password && password.length < 6) {
            return res.status(400).json({ error: 'Пароль должен содержать минимум 6 символов' });
        }

        // Проверяем существование пользователя
        const [existingUser] = await pool.execute(
            'SELECT id FROM users WHERE id = ?',
            [userId]
        );

        if (existingUser.length === 0) {
            return res.status(404).json({ error: 'Пользователь не найден' });
        }

        // Проверка уникальности username
        const [existingUsers] = await pool.execute(
            'SELECT id FROM users WHERE username = ? AND id != ?',
            [username, userId]
        );

        if (existingUsers.length > 0) {
            return res.status(400).json({ error: 'Пользователь с таким именем уже существует' });
        }

        // Проверка уникальности email
        const [existingEmails] = await pool.execute(
            'SELECT id FROM users WHERE email = ? AND id != ?',
            [email, userId]
        );

        if (existingEmails.length > 0) {
            return res.status(400).json({ error: 'Пользователь с таким email уже существует' });
        }

        // Начинаем транзакцию
        const connection = await pool.getConnection();
        await connection.beginTransaction();

        try {
            // Обновляем основные данные пользователя
            const updateFields = ['username = ?', 'name = ?', 'email = ?', 'department = ?', 'position = ?'];
            const updateValues = [username, name, email, department || null, position || null];

            if (password) {
                updateFields.push('password_hash = ?');
                updateValues.push(password);
            }

            updateValues.push(userId);

            await connection.execute(`
                UPDATE users 
                SET ${updateFields.join(', ')}
                WHERE id = ?
            `, updateValues);

            // Удаляем старые роли
            await connection.execute(
                'DELETE FROM user_roles WHERE user_id = ?',
                [userId]
            );

            // Добавляем новые роли
            for (const roleName of roles) {
                const [roleResult] = await connection.execute(
                    'SELECT id FROM roles WHERE name = ?',
                    [roleName]
                );

                if (roleResult.length > 0) {
                    await connection.execute(
                        'INSERT INTO user_roles (user_id, role_id) VALUES (?, ?)',
                        [userId, roleResult[0].id]
                    );
                }
            }

            await connection.commit();

            // Получаем обновленного пользователя
            const [updatedUser] = await pool.execute(`
                SELECT 
                    u.id,
                    u.username,
                    u.name,
                    u.email,
                    u.department,
                    u.position,
                    u.active,
                    u.created_at,
                    u.last_login,
                    GROUP_CONCAT(DISTINCT r.name) as roles,
                    GROUP_CONCAT(DISTINCT p.name) as permissions
                FROM users u
                LEFT JOIN user_roles ur ON u.id = ur.user_id
                LEFT JOIN roles r ON ur.role_id = r.id
                LEFT JOIN role_permissions rp ON r.id = rp.role_id
                LEFT JOIN permissions p ON rp.permission_id = p.id
                WHERE u.id = ?
                GROUP BY u.id
            `, [userId]);

            const user = updatedUser[0];
            const userData = {
                id: user.id,
                username: user.username,
                name: user.name,
                email: user.email,
                department: user.department,
                position: user.position,
                active: Boolean(user.active),
                createdAt: user.created_at,
                lastLogin: user.last_login,
                roles: user.roles ? user.roles.split(',') : [],
                permissions: user.permissions ? user.permissions.split(',') : []
            };

            logger.info(`Обновлен пользователь: ${username} (ID: ${userId})`);
            res.json(userData);

        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }

    } catch (error) {
        logger.error('Ошибка при обновлении пользователя:', error);
        res.status(500).json({ error: 'Внутренняя ошибка сервера' });
    }
});

// Удалить пользователя (только для админов)
router.delete('/:id', authenticateToken, requireRole('admin'), async (req, res) => {
    try {
        const userId = parseInt(req.params.id);

        // Проверяем существование пользователя
        const [existingUser] = await pool.execute(
            'SELECT username FROM users WHERE id = ?',
            [userId]
        );

        if (existingUser.length === 0) {
            return res.status(404).json({ error: 'Пользователь не найден' });
        }

        // Начинаем транзакцию
        const connection = await pool.getConnection();
        await connection.beginTransaction();

        try {
            // Удаляем роли пользователя
            await connection.execute(
                'DELETE FROM user_roles WHERE user_id = ?',
                [userId]
            );

            // Удаляем пользователя
            await connection.execute(
                'DELETE FROM users WHERE id = ?',
                [userId]
            );

            await connection.commit();

            logger.info(`Удален пользователь: ${existingUser[0].username} (ID: ${userId})`);
            res.json({ message: 'Пользователь успешно удален' });

        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }

    } catch (error) {
        logger.error('Ошибка при удалении пользователя:', error);
        res.status(500).json({ error: 'Внутренняя ошибка сервера' });
    }
});

// Переключить статус пользователя (активен/неактивен)
router.patch('/:id/toggle-status', authenticateToken, requireRole('admin'), async (req, res) => {
    try {
        const userId = parseInt(req.params.id);

        // Проверяем существование пользователя
        const [existingUser] = await pool.execute(
            'SELECT username, active FROM users WHERE id = ?',
            [userId]
        );

        if (existingUser.length === 0) {
            return res.status(404).json({ error: 'Пользователь не найден' });
        }

        const newStatus = !existingUser[0].active;

        // Обновляем статус
        await pool.execute(
            'UPDATE users SET active = ? WHERE id = ?',
            [newStatus, userId]
        );

        logger.info(`Изменен статус пользователя: ${existingUser[0].username} (ID: ${userId}) на ${newStatus ? 'активен' : 'неактивен'}`);
        res.json({ 
            message: `Пользователь ${newStatus ? 'активирован' : 'деактивирован'}`,
            active: newStatus
        });

    } catch (error) {
        logger.error('Ошибка при изменении статуса пользователя:', error);
        res.status(500).json({ error: 'Внутренняя ошибка сервера' });
    }
});

// Получить статистику пользователей (только для админов)
router.get('/stats/overview', authenticateToken, requireRole('admin'), async (req, res) => {
    try {
        const [stats] = await pool.execute(`
            SELECT 
                COUNT(*) as total_users,
                SUM(active) as active_users,
                SUM(CASE WHEN EXISTS(SELECT 1 FROM user_roles ur JOIN roles r ON ur.role_id = r.id WHERE ur.user_id = users.id AND r.name = 'admin') THEN 1 ELSE 0 END) as admin_users,
                SUM(CASE WHEN EXISTS(SELECT 1 FROM user_roles ur JOIN roles r ON ur.role_id = r.id WHERE ur.user_id = users.id AND r.name = 'manager') THEN 1 ELSE 0 END) as manager_users,
                SUM(CASE WHEN EXISTS(SELECT 1 FROM user_roles ur JOIN roles r ON ur.role_id = r.id WHERE ur.user_id = users.id AND r.name = 'operator') THEN 1 ELSE 0 END) as operator_users,
                SUM(CASE WHEN EXISTS(SELECT 1 FROM user_roles ur JOIN roles r ON ur.role_id = r.id WHERE ur.user_id = users.id AND r.name = 'viewer') THEN 1 ELSE 0 END) as viewer_users
            FROM users
        `);

        res.json(stats[0]);
    } catch (error) {
        logger.error('Ошибка при получении статистики пользователей:', error);
        res.status(500).json({ error: 'Внутренняя ошибка сервера' });
    }
});

// Получить роли для выбора
router.get('/roles/available', authenticateToken, requireRole('admin'), async (req, res) => {
    try {
        const [roles] = await pool.execute(`
            SELECT 
                r.id,
                r.name,
                r.description,
                GROUP_CONCAT(p.name) as permissions
            FROM roles r
            LEFT JOIN role_permissions rp ON r.id = rp.role_id
            LEFT JOIN permissions p ON rp.permission_id = p.id
            GROUP BY r.id
            ORDER BY r.name
        `);

        const rolesData = roles.map(role => ({
            id: role.id,
            name: role.name,
            description: role.description,
            permissions: role.permissions ? role.permissions.split(',') : []
        }));

        res.json(rolesData);
    } catch (error) {
        logger.error('Ошибка при получении ролей:', error);
        res.status(500).json({ error: 'Внутренняя ошибка сервера' });
    }
});

// Получить разрешения для выбора
router.get('/permissions/available', authenticateToken, requireRole('admin'), async (req, res) => {
    try {
        const [permissions] = await pool.execute(`
            SELECT id, name, description
            FROM permissions
            ORDER BY name
        `);

        res.json(permissions);
    } catch (error) {
        logger.error('Ошибка при получении разрешений:', error);
        res.status(500).json({ error: 'Внутренняя ошибка сервера' });
    }
});

export default router;
