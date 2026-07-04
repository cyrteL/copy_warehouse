// Модуль управления складом

class WarehouseManager {
    constructor() {
        this.apiBase = (window && window.API_BASE) ? window.API_BASE : 'http://localhost:3001/api';
        this.items = this.loadItems();
        this.operations = this.loadOperations();
        this.categories = this.loadCategories();
    }

    // Универсальный вызов API с таймаутом и graceful fallback
    async apiRequest(path, options = {}) {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), options.timeoutMs || 5000);
        try {
            const res = await fetch(`${this.apiBase}${path}`, {
                method: options.method || 'GET',
                headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
                body: options.body ? JSON.stringify(options.body) : undefined,
                signal: controller.signal,
                credentials: 'omit'
            });
            if (!res.ok) throw new Error(`API ${res.status}`);
            return await res.json();
        } finally {
            clearTimeout(timeout);
        }
    }

    // Отправка уведомления о низком остатке через API
    async sendLowStockEmailNotification(items) {
        try {
            const response = await this.apiRequest('/notifications/low-stock', {
                method: 'POST',
                body: { items }
            });
            
            console.log('Уведомления о низком остатке отправлены:', response);
            return response;
        } catch (error) {
            console.error('Ошибка отправки уведомлений о низком остатке:', error);
            throw error;
        }
    }

    // Отправка уведомления об операции через API
    async sendOperationEmailNotificationAPI(operation) {
        try {
            const response = await this.apiRequest('/notifications/operation', {
                method: 'POST',
                body: { operation }
            });
            
            console.log('Уведомления об операции отправлены:', response);
            return response;
        } catch (error) {
            console.error('Ошибка отправки уведомлений об операции:', error);
            throw error;
        }
    }

    // Отправка еженедельного отчета через API
    async sendWeeklyReportEmailNotification(report) {
        try {
            const response = await this.apiRequest('/notifications/weekly-report', {
                method: 'POST',
                body: { report }
            });
            
            console.log('Еженедельные отчеты отправлены:', response);
            return response;
        } catch (error) {
            console.error('Ошибка отправки еженедельных отчетов:', error);
            throw error;
        }
    }

    // Тестовая отправка email
    async sendTestEmail(email, subject, message) {
        try {
            const response = await this.apiRequest('/notifications/test', {
                method: 'POST',
                body: { email, subject, message }
            });
            
            console.log('Тестовое уведомление отправлено:', response);
            return response;
        } catch (error) {
            console.error('Ошибка отправки тестового уведомления:', error);
            throw error;
        }
    }

            // Загрузка позиций из localStorage
    loadItems() {
        const items = localStorage.getItem('warehouse_items');
        return items ? JSON.parse(items) : this.getDefaultItems();
    }

    // Загрузка операций из localStorage
    loadOperations() {
        const operations = localStorage.getItem('warehouse_operations');
        return operations ? JSON.parse(operations) : [];
    }

    // Загрузка категорий
    loadCategories() {
        const categories = localStorage.getItem('warehouse_categories');
        if (categories) {
            this.categories = JSON.parse(categories);
        } else {
            // Загружаем категории по умолчанию
            this.categories = this.getDefaultCategories();
            this.saveCategories();
        }
        
        // Обновляем количество позиций в каждой категории
        this.updateCategoryItemCounts();
    }

    // Получение категорий по умолчанию
    getDefaultCategories() {
        return [];
    }

    // Сохранение категорий
    saveCategories() {
        localStorage.setItem('warehouse_categories', JSON.stringify(this.categories));
    }

    // Обновление количества позиций в категориях
    updateCategoryItemCounts() {
        this.categories.forEach(category => {
            const itemsInCategory = this.items.filter(item => item.category === category.id);
            category.itemCount = itemsInCategory.length;
            category.totalQuantity = itemsInCategory.reduce((sum, item) => sum + (item.quantity || 0), 0);
        });
        this.saveCategories();
    }

    // Сохранение данных в localStorage
    saveItems() {
        localStorage.setItem('warehouse_items', JSON.stringify(this.items));
    }

    saveOperations() {
        localStorage.setItem('warehouse_operations', JSON.stringify(this.operations));
    }

            // Получение позиций по умолчанию
    getDefaultItems() {
        return [];
    }

    // Получение статистики
    getStatistics() {
        const today = new Date().toISOString().split('T')[0];
        
        const totalItems = this.items.reduce((sum, item) => sum + item.quantity, 0);
        const totalValue = this.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        const lowStockItems = this.items.filter(item => item.quantity <= item.minQuantity).length;
        const todayOperations = this.operations.filter(op => 
            op.date.startsWith(today)
        ).length;

        return {
            totalItems,
            totalValue,
            lowStockItems,
            todayOperations,
            totalCategories: this.categories.length,
            totalOperations: this.operations.length
        };
    }

                // Получение всех позиций
    async getAllItems() {
        try {
            const data = await this.apiRequest('/items');
            this.items = (data || []).map(row => ({
                id: row.id,
                name: row.name,
                category: row.category_id || 'uncategorized',
                price: Number(row.price || 0),
                quantity: Number(row.quantity || 0),
                description: row.description || '',
                barcode: row.barcode || '',
                minQuantity: Number(row.min_quantity || 0),
                location: row.location || '',
                supplier: row.supplier || '',
                createdAt: row.created_at,
                updatedAt: row.updated_at
            }));
            this.saveItems();
            this.updateCategoryItemCounts();
            return this.items;
        } catch (e) {
            return this.items;
        }
    }

    // Синхронное получение всех позиций
    getAllItemsSync() {
        return this.items;
    }

    // Получение позиции по ID
    async getItemById(id) {
        try {
            const row = await this.apiRequest(`/items/${id}`);
            return {
                id: row.id,
                name: row.name,
                category: row.category_id || 'uncategorized',
                price: Number(row.price || 0),
                quantity: Number(row.quantity || 0),
                description: row.description || '',
                barcode: row.barcode || '',
                minQuantity: Number(row.min_quantity || 0),
                location: row.location || '',
                supplier: row.supplier || '',
                createdAt: row.created_at,
                updatedAt: row.updated_at
            };
        } catch (e) {
            return this.items.find(item => item.id === parseInt(id));
        }
    }

    // Добавление новой позиции
    async addItem(itemData) {
        const newItem = {
            id: this.getNextItemId(),
            name: itemData.itemName,
            category: itemData.itemCategory || 'uncategorized',
            price: parseFloat(itemData.itemPrice),
            quantity: parseInt(itemData.itemQuantity),
            description: itemData.itemDescription || '',
            barcode: itemData.itemBarcode || '',
            minQuantity: parseInt(itemData.itemQuantity) * 0.2, // 20% от начального количества
            location: itemData.itemLocation || 'Новый стеллаж',
            supplier: itemData.itemSupplier || '',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        // Попытка создать через API
        try {
            const created = await this.apiRequest('/items', {
                method: 'POST',
                body: {
                    name: newItem.name,
                    category_id: newItem.category === 'uncategorized' ? null : newItem.category,
                    price: newItem.price,
                    quantity: newItem.quantity,
                    description: newItem.description,
                    barcode: newItem.barcode,
                    min_quantity: newItem.minQuantity,
                    location: newItem.location,
                    supplier: newItem.supplier
                }
            });
            if (created && created.id) newItem.id = created.id;
        } catch (e) {}

        this.items.push(newItem);
        this.saveItems();
        this.updateCategoryItemCounts();

        await this.createOperation({
            type: 'incoming',
            itemId: newItem.id,
            quantity: newItem.quantity,
            notes: 'Добавление новой позиции'
        });

        return newItem;
    }

    // Обновление позиции
    async updateItem(id, itemData) {
        const itemIndex = this.items.findIndex(item => item.id === parseInt(id));
        if (itemIndex === -1) {
            throw new Error('Позиция не найдена');
        }

        try {
            await this.apiRequest(`/items/${id}`, {
                method: 'PUT',
                body: {
                    name: itemData.name,
                    category_id: itemData.category === 'uncategorized' ? null : itemData.category,
                    price: itemData.price,
                    quantity: itemData.quantity,
                    description: itemData.description,
                    barcode: itemData.barcode,
                    min_quantity: itemData.minQuantity,
                    location: itemData.location,
                    supplier: itemData.supplier
                }
            });
        } catch (e) {}

        this.items[itemIndex] = {
            ...this.items[itemIndex],
            ...itemData,
            updatedAt: new Date().toISOString()
        };

        this.saveItems();
        
        // Обновляем количество товаров в категории
        this.updateCategoryItemCounts();
        
        return this.items[itemIndex];
    }

    // Удаление позиции
    async deleteItem(id) {
        const itemIndex = this.items.findIndex(item => item.id === parseInt(id));
        if (itemIndex === -1) {
            throw new Error('Позиция не найдена');
        }

        try { await this.apiRequest(`/items/${id}`, { method: 'DELETE' }); } catch (e) {}

        this.items.splice(itemIndex, 1);
        this.saveItems();
        
        // Обновляем количество товаров в категории
        this.updateCategoryItemCounts();
        
        return true;
    }

    // Обработка прихода
    async processIncoming(operationData) {
        const itemId = parseInt(operationData.incomingItem);
        const quantity = parseInt(operationData.incomingQuantity);
        
        const item = await this.getItemById(itemId);
        if (!item) {
            throw new Error('Позиция не найдена');
        }

        // Обновляем количество позиции
        item.quantity += quantity;
        item.updatedAt = new Date().toISOString();
        this.saveItems();
        
        // Обновляем количество товаров в категории
        this.updateCategoryItemCounts();

        // Создаем операцию
        try {
            await this.apiRequest('/operations/incoming', {
                method: 'POST',
                body: { itemId, quantity, supplier: operationData.incomingSupplier || '', notes: operationData.incomingNotes || '', employeeId: auth.getCurrentUser()?.id }
            });
        } catch (e) {}

        const operation = await this.createOperation({
            type: 'incoming',
            itemId: itemId,
            quantity: quantity,
            supplier: operationData.incomingSupplier || '',
            notes: operationData.incomingNotes || ''
        });

        return operation;
    }

    // Обработка расхода
    async processOutgoing(operationData) {
        const itemId = parseInt(operationData.outgoingItem);
        const quantity = parseInt(operationData.outgoingQuantity);
        
        const item = await this.getItemById(itemId);
        if (!item) {
            throw new Error('Позиция не найдена');
        }

        // Проверяем достаточность позиции
        if (item.quantity < quantity) {
            throw new Error(`Недостаточно позиций. Доступно: ${item.quantity} шт.`);
        }

        // Обновляем количество позиции
        item.quantity -= quantity;
        item.updatedAt = new Date().toISOString();
        this.saveItems();
        
        // Обновляем количество товаров в категории
        this.updateCategoryItemCounts();

        // Создаем операцию
        try {
            await this.apiRequest('/operations/outgoing', {
                method: 'POST',
                body: { itemId, quantity, recipient: operationData.outgoingRecipient || '', notes: operationData.outgoingNotes || '', employeeId: auth.getCurrentUser()?.id }
            });
        } catch (e) {}

        const operation = await this.createOperation({
            type: 'outgoing',
            itemId: itemId,
            quantity: quantity,
            recipient: operationData.outgoingRecipient || '',
            notes: operationData.outgoingNotes || ''
        });

        return operation;
    }

    // Создание операции
    async createOperation(operationData) {
        const item = await this.getItemById(operationData.itemId);
        const currentUser = auth.getCurrentUser();

        const operation = {
            id: this.getNextOperationId(),
            type: operationData.type,
            itemId: operationData.itemId,
            itemName: item.name,
            quantity: operationData.quantity,
            employeeId: currentUser.id,
            employeeName: currentUser.name,
            date: new Date().toISOString(),
            status: 'completed',
            supplier: operationData.supplier || '',
            recipient: operationData.recipient || '',
            notes: operationData.notes || ''
        };

        this.operations.push(operation);
        this.saveOperations();

        // Проверяем и отправляем уведомления
        await this.checkAndSendNotifications(operation);

        return operation;
    }

    // Получение последних операций
    async getRecentOperations(limit = 10) {
        try {
            const ops = await this.apiRequest(`/operations?sortBy=date&sortOrder=desc`);
            this.syncOperationsFromApi(ops);
            return this.operations.slice(0, limit);
        } catch (e) {
            return this.operations
                .sort((a, b) => new Date(b.date) - new Date(a.date))
                .slice(0, limit);
        }
    }

    // Получение операций по фильтрам
    async getOperations(filters = {}) {
        try {
            const q = new URLSearchParams();
            if (filters.type) q.set('type', filters.type);
            if (filters.startDate) q.set('startDate', filters.startDate);
            if (filters.endDate) q.set('endDate', filters.endDate);
            if (filters.itemId) q.set('itemId', filters.itemId);
            if (filters.sortBy) q.set('sortBy', filters.sortBy);
            if (filters.sortOrder) q.set('sortOrder', filters.sortOrder);
            const ops = await this.apiRequest(`/operations?${q.toString()}`);
            this.syncOperationsFromApi(ops);
            return this.operations;
        } catch (e) {}

        let filteredOperations = [...this.operations];

        // Фильтр по типу
        if (filters.type) {
            filteredOperations = filteredOperations.filter(op => op.type === filters.type);
        }

        // Фильтр по дате
        if (filters.startDate) {
            filteredOperations = filteredOperations.filter(op => 
                new Date(op.date) >= new Date(filters.startDate)
            );
        }

        if (filters.endDate) {
            filteredOperations = filteredOperations.filter(op => 
                new Date(op.date) <= new Date(filters.endDate)
            );
        }

        // Фильтр по товару
        if (filters.itemId) {
            filteredOperations = filteredOperations.filter(op => 
                op.itemId === parseInt(filters.itemId)
            );
        }

        // Сортировка
        const sortField = filters.sortBy || 'date';
        const sortOrder = filters.sortOrder || 'desc';

        filteredOperations.sort((a, b) => {
            let aValue = a[sortField];
            let bValue = b[sortField];

            if (sortField === 'date') {
                aValue = new Date(aValue);
                bValue = new Date(bValue);
            }

            if (sortOrder === 'asc') {
                return aValue > bValue ? 1 : -1;
            } else {
                return aValue < bValue ? 1 : -1;
            }
        });

        return filteredOperations;
    }

    // Приведение формата операций из API и сохранение в localStorage
    syncOperationsFromApi(apiOps) {
        this.operations = (apiOps || []).map(op => ({
            id: op.id,
            type: op.type,
            itemId: op.itemId || op.item_id,
            itemName: op.itemName || op.item_name || op.itemName,
            quantity: Number(op.quantity || 0),
            employeeId: op.employeeId || op.employee_id,
            employeeName: op.employeeName || op.employee_name,
            date: op.date,
            status: op.status || 'completed',
            supplier: op.supplier || '',
            recipient: op.recipient || '',
            notes: op.notes || ''
        })).sort((a, b) => new Date(b.date) - new Date(a.date));
        this.saveOperations();
    }

    // Поиск товаров
    async searchItems(query, filters = {}) {
        let results = [...this.items];

        // Поиск по названию и описанию
        if (query) {
            const searchQuery = query.toLowerCase();
            results = results.filter(item => 
                item.name.toLowerCase().includes(searchQuery) ||
                item.description.toLowerCase().includes(searchQuery) ||
                item.barcode.includes(searchQuery)
            );
        }

        // Фильтр по категории
        if (filters.category) {
            results = results.filter(item => item.category === filters.category);
        }

        // Фильтр по цене
        if (filters.minPrice) {
            results = results.filter(item => item.price >= filters.minPrice);
        }

        if (filters.maxPrice) {
            results = results.filter(item => item.price <= filters.maxPrice);
        }

        // Фильтр по наличию
        if (filters.inStock) {
            results = results.filter(item => item.quantity > 0);
        }

        if (filters.lowStock) {
            results = results.filter(item => item.quantity <= item.minQuantity);
        }

        return results;
    }

    // Получение товаров с низким запасом
    async getLowStockItems() {
        return this.items.filter(item => item.quantity <= item.minQuantity);
    }

    // Проверка и отправка уведомлений
    async checkAndSendNotifications(operation = null) {
        try {
            const settings = JSON.parse(localStorage.getItem('user_settings') || '{}');
            const currentUser = JSON.parse(localStorage.getItem('warehouse_user') || '{}');
            
            // Проверяем оповещения о низком остатке
            if (settings.lowStockAlerts) {
                await this.checkLowStockAlerts(currentUser);
            }
            
            // Проверяем email уведомления об операциях
            if (settings.emailNotifications && operation) {
                await this.sendOperationEmailNotification(operation, currentUser);
            }
            
        } catch (error) {
            console.error('Ошибка при отправке уведомлений:', error);
        }
    }

    // Проверка товаров с низким запасом
    async checkLowStockAlerts(user) {
        try {
            const lowStockItems = await this.getLowStockItems();
            
            if (lowStockItems.length > 0) {
                // Показываем уведомление в интерфейсе
                const itemNames = lowStockItems.map(item => item.name).join(', ');
                auth.showNotification(
                    `Внимание! Товары с низким запасом: ${itemNames}`, 
                    'warning'
                );
                
                // Отправляем email уведомление через API
                await this.sendLowStockEmailNotification(lowStockItems);
            }
        } catch (error) {
            console.error('Ошибка при проверке низкого остатка:', error);
        }
    }

    // Отправка уведомления об операции
    async sendOperationEmailNotification(operation, user) {
        try {
            const operationType = operation.type === 'incoming' ? 'Приход' : 'Расход';
            const message = `Операция ${operationType}: ${operation.itemName} - ${operation.quantity} шт.`;
            
            // Отправляем email уведомление через API
            await this.sendOperationEmailNotificationAPI(operation);
            
            // Показываем уведомление в интерфейсе
            auth.showNotification(`Уведомление об операции отправлено на ${user.email}`, 'info');
        } catch (error) {
            console.error('Ошибка при отправке уведомления об операции:', error);
        }
    }

    // Генерация и отправка еженедельных отчетов
    async generateWeeklyReports() {
        try {
            const settings = JSON.parse(localStorage.getItem('user_settings') || '{}');
            const currentUser = JSON.parse(localStorage.getItem('warehouse_user') || '{}');
            
            if (settings.operationReports) {
                const weekAgo = new Date();
                weekAgo.setDate(weekAgo.getDate() - 7);
                
                const weeklyOperations = this.operations.filter(op => 
                    new Date(op.date) >= weekAgo
                );
                
                if (weeklyOperations.length > 0) {
                    const report = {
                        period: 'За последнюю неделю',
                        totalOperations: weeklyOperations.length,
                        incoming: weeklyOperations.filter(op => op.type === 'incoming').length,
                        outgoing: weeklyOperations.filter(op => op.type === 'outgoing').length,
                        operations: weeklyOperations
                    };
                    
                    // Отправляем еженедельный отчет через API
                    await this.sendWeeklyReportEmailNotification(report);
                    
                    auth.showNotification('Еженедельный отчет отправлен на email', 'success');
                }
            }
        } catch (error) {
            console.error('Ошибка при генерации еженедельного отчета:', error);
        }
    }

    // Получение категорий
    async getCategories() {
        try {
            const rows = await this.apiRequest('/categories');
            this.categories = (rows || []).map(r => ({
                id: r.id,
                name: r.name,
                description: r.description || '',
                icon: r.icon || 'fas fa-tag',
                color: r.color || '#2c5aa0',
                active: !!(r.active ?? 1),
                itemCount: Number(r.itemCount || 0)
            }));
            this.saveCategories();
            return this.categories;
        } catch (e) {
            return this.categories;
        }
    }

    // Получение категории по ID
    async getCategoryById(id) {
        return this.categories.find(cat => cat.id === id);
    }

    // Добавление категории
    async addCategory(categoryData) {
        const newCategory = {
            id: this.generateCategoryId(),
            ...categoryData,
            itemCount: 0,
            createdAt: new Date().toISOString()
        };

        try {
            const created = await this.apiRequest('/categories', { method: 'POST', body: newCategory });
            if (created && created.id) newCategory.id = created.id;
        } catch (e) {}

        this.categories.push(newCategory);
        this.saveCategories();
        return newCategory;
    }

    // Обновление категории
    async updateCategory(id, categoryData) {
        const categoryIndex = this.categories.findIndex(cat => cat.id === id);
        if (categoryIndex === -1) {
            throw new Error('Категория не найдена');
        }

        try { await this.apiRequest(`/categories/${id}`, { method: 'PUT', body: categoryData }); } catch (e) {}

        this.categories[categoryIndex] = {
            ...this.categories[categoryIndex],
            ...categoryData,
            updatedAt: new Date().toISOString()
        };

        this.saveCategories();
        return this.categories[categoryIndex];
    }

    // Удаление категории
    async deleteCategory(id) {
        const categoryIndex = this.categories.findIndex(cat => cat.id === id);
        if (categoryIndex === -1) {
            throw new Error('Категория не найдена');
        }

        try { await this.apiRequest(`/categories/${id}`, { method: 'DELETE' }); } catch (e) {}

        // Удаляем все позиции этой категории
        this.items = this.items.filter(item => item.category !== id);
        this.saveItems();

        // Удаляем категорию
        this.categories.splice(categoryIndex, 1);
        this.saveCategories();

        // Обновляем количество позиций в остальных категориях
        this.updateCategoryItemCounts();

        return true;
    }

    // Генерация следующего ID для товара
    getNextItemId() {
        const maxId = Math.max(...this.items.map(item => item.id), 0);
        return maxId + 1;
    }

    // Генерация следующего ID для операции
    getNextOperationId() {
        const maxId = Math.max(...this.operations.map(op => op.id), 0);
        return maxId + 1;
    }

    // Генерация ID для категории
    generateCategoryId() {
        return 'category_' + Date.now();
    }

    // Экспорт данных
    async exportData(type = 'items') {
        switch (type) {
            case 'items':
                return this.exportItems();
            case 'operations':
                return this.exportOperations();
            case 'statistics':
                return this.exportStatistics();
            default:
                throw new Error('Неизвестный тип экспорта');
        }
    }

    // Экспорт товаров
    exportItems() {
        const headers = ['ID', 'Название', 'Категория', 'Цена', 'Количество', 'Описание', 'Штрих-код', 'Местоположение'];
        const rows = this.items.map(item => [
            item.id,
            item.name,
            this.getCategoryName(item.category),
            item.price,
            item.quantity,
            item.description,
            item.barcode,
            item.location
        ]);

        return { headers, rows };
    }

    // Экспорт операций
    exportOperations() {
        const headers = ['ID', 'Дата', 'Тип', 'Товар', 'Количество', 'Сотрудник', 'Статус', 'Примечания'];
        const rows = this.operations.map(op => [
            op.id,
            new Date(op.date).toLocaleDateString('ru-RU'),
            op.type === 'incoming' ? 'Приход' : 'Расход',
            op.itemName,
            op.quantity,
            op.employeeName,
            op.status === 'completed' ? 'Завершено' : 'В обработке',
            op.notes
        ]);

        return { headers, rows };
    }

    // Экспорт статистики
    exportStatistics() {
        const stats = this.getStatistics();
        return {
            headers: ['Показатель', 'Значение'],
            rows: [
                ['Всего товаров', stats.totalItems],
                ['Общая стоимость', stats.totalValue + ' ₽'],
                ['Товары с низким запасом', stats.lowStockItems],
                ['Операций сегодня', stats.todayOperations],
                ['Всего категорий', stats.totalCategories],
                ['Всего операций', stats.totalOperations]
            ]
        };
    }

    // Получение названия категории
    getCategoryName(categoryId) {
        const category = this.categories.find(cat => cat.id === categoryId);
        return category ? category.name : 'Неизвестная категория';
    }

    // Получение отчета по движению товаров
    async getMovementReport(startDate, endDate, itemId = null) {
        let operations = this.operations.filter(op => {
            const opDate = new Date(op.date);
            return opDate >= new Date(startDate) && opDate <= new Date(endDate);
        });

        if (itemId) {
            operations = operations.filter(op => op.itemId === parseInt(itemId));
        }

        const report = {
            period: { startDate, endDate },
            totalIncoming: operations.filter(op => op.type === 'incoming').length,
            totalOutgoing: operations.filter(op => op.type === 'outgoing').length,
            totalIncomingQuantity: operations
                .filter(op => op.type === 'incoming')
                .reduce((sum, op) => sum + op.quantity, 0),
            totalOutgoingQuantity: operations
                .filter(op => op.type === 'outgoing')
                .reduce((sum, op) => sum + op.quantity, 0),
            operations: operations
        };

        return report;
    }
}

// Экспорт для использования в других модулях
window.WarehouseManager = WarehouseManager; 