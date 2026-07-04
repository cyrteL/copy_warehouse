// Основной JavaScript файл для главной страницы

class MainApp {
    constructor() {
        this.warehouse = new WarehouseManager();
        this.init();
    }

    init() {
        // Инициализация после загрузки DOM
        $(document).ready(async () => {
            try {
                // Проверяем авторизацию
                if (!auth.isUserAuthenticated()) {
                    // Пользователь не авторизован, перенаправление на login.html
                    window.location.href = 'login.html';
                    return;
                }

                // Инициализация главной страницы

                // Загружаем данные дашборда
                await this.loadDashboardData();
                
                // Загружаем категории в навигацию
                await this.loadCategoriesNav();
                
                // Загружаем категории в выпадающее меню
                await this.loadCategoriesDropdown();
                
                // Обновляем информацию о пользователе
                this.updateUserInfo();
                
                // Принудительно обновляем еще раз через небольшую задержку
                setTimeout(() => {
                    this.updateUserInfo();
                }, 500);
                
                // Привязываем события
                this.bindEvents();
                
                // Инициализируем модальные окна
                this.initializeModals();
                
            } catch (error) {
                // Ошибка инициализации
                auth.showNotification('Ошибка загрузки данных', 'danger');
            }
        });
    }

    bindEvents() {
        // Обработчики для модальных окон
        $('#saveItemBtn').on('click', () => this.addNewItem());
        $('#saveIncomingBtn').on('click', () => this.processIncoming());
        $('#saveOutgoingBtn').on('click', () => this.processOutgoing());

        // Обработчики для фильтров и поиска
        $('#searchInput').on('input', (e) => this.handleSearch(e.target.value));
        
        // Обработчики для сортировки
        $('.sortable').on('click', (e) => this.handleSort(e));

        // Обработчики для экспорта
        $('#exportBtn').on('click', () => this.exportData());

        // Обработчик выхода
        $('#logoutBtn').on('click', (e) => {
            e.preventDefault();
            auth.logout();
            window.location.href = 'login.html';
        });
    }

    // Загрузка данных для дашборда
    async loadDashboardData() {
        try {
            // Показываем индикатор загрузки
            this.showLoading();

            // Загружаем статистику
            const stats = this.warehouse.getStatistics();
            this.updateStatistics(stats);

            // Загружаем последние операции
            const operations = await this.warehouse.getRecentOperations(10);
            this.updateOperationsTable(operations);

            // Загружаем позиции для модальных окон
            const items = await this.warehouse.getAllItems();
            this.populateItemSelects(items);

            // Скрываем индикатор загрузки
            this.hideLoading();

            // Проверяем уведомления о низком остатке
            await this.warehouse.checkAndSendNotifications();

        } catch (error) {
            console.error('Ошибка при загрузке данных:', error);
            auth.showNotification('Ошибка при загрузке данных', 'danger');
            this.hideLoading();
        }
    }

    // Обновление статистики
    updateStatistics(stats) {
        $('#totalItems').text(stats.totalItems.toLocaleString());
        $('#totalValue').text(stats.totalValue.toLocaleString() + ' ₽');
        $('#lowStock').text(stats.lowStockItems);
        $('#todayOperations').text(stats.todayOperations);
    }

    // Обновление таблицы операций
    updateOperationsTable(operations) {
        const tbody = $('#recentOperationsTable tbody');
        tbody.empty();

        if (operations.length === 0) {
            tbody.append(`
                <tr>
                    <td colspan="6" class="text-center text-muted">
                        <i class="fas fa-inbox fa-2x mb-2"></i>
                        <br>Нет операций для отображения
                    </td>
                </tr>
            `);
            return;
        }

        operations.forEach(operation => {
            const row = this.createOperationRow(operation);
            tbody.append(row);
        });
    }

    // Создание строки операции
    createOperationRow(operation) {
        const typeIcon = operation.type === 'incoming' ? 'fa-box-open text-success' : 'fa-truck text-warning';
        const typeText = operation.type === 'incoming' ? 'Приход' : 'Расход';
        const statusClass = this.getStatusClass(operation.status);
        const statusText = this.getStatusText(operation.status);

        return `
            <tr>
                <td>${this.formatDate(operation.date)}</td>
                <td>
                    <i class="fas ${typeIcon} me-1"></i>
                    ${typeText}
                </td>
                <td>${operation.itemName}</td>
                <td>${operation.quantity}</td>
                <td>${operation.employeeName}</td>
                <td>
                    <span class="status-badge ${statusClass}">${statusText}</span>
                </td>
            </tr>
        `;
    }

    // Получение класса статуса
    getStatusClass(status) {
        switch (status) {
            case 'completed': return 'status-completed';
            case 'pending': return 'status-pending';
            case 'cancelled': return 'status-cancelled';
            default: return 'status-pending';
        }
    }

    // Получение текста статуса
    getStatusText(status) {
        switch (status) {
            case 'completed': return 'Завершено';
            case 'pending': return 'В обработке';
            case 'cancelled': return 'Отменено';
            default: return 'Неизвестно';
        }
    }

    // Форматирование даты
    formatDate(dateString) {
        const date = new Date(dateString);
        return date.toLocaleDateString('ru-RU', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

            // Заполнение селектов позиций
    populateItemSelects(items) {
        const selects = ['#incomingItem', '#outgoingItem'];
        
        selects.forEach(selectId => {
            const select = $(selectId);
            select.find('option:not(:first)').remove();
            
            items.forEach(item => {
                select.append(`<option value="${item.id}">${item.name} (${item.quantity} шт.)</option>`);
            });
        });
    }

            // Добавление новой позиции
    async addNewItem() {
        const formData = this.getFormData('#addItemForm');
        
        if (!this.validateForm(formData)) {
            return;
        }

        try {
            const newItem = await this.warehouse.addItem(formData);
            auth.showNotification('Позиция успешно добавлена', 'success');
            
            // Закрываем модальное окно
            $('#addItemModal').modal('hide');
            
            // Обновляем данные
            this.loadDashboardData();
            
            // Очищаем форму
            $('#addItemForm')[0].reset();
            
        } catch (error) {
            console.error('Ошибка при добавлении позиции:', error);
            auth.showNotification('Ошибка при добавлении позиции', 'danger');
        }
    }

    // Обработка прихода
    async processIncoming() {
        const formData = this.getFormData('#incomingForm');
        
        if (!this.validateForm(formData)) {
            return;
        }

        try {
            const operation = await this.warehouse.processIncoming(formData);
            auth.showNotification('Приход успешно оформлен', 'success');
            
            // Закрываем модальное окно
            $('#incomingModal').modal('hide');
            
            // Обновляем данные
            this.loadDashboardData();
            
            // Очищаем форму
            $('#incomingForm')[0].reset();
            
        } catch (error) {
            console.error('Ошибка при оформлении прихода:', error);
            auth.showNotification('Ошибка при оформлении прихода', 'danger');
        }
    }

    // Обработка расхода
    async processOutgoing() {
        const formData = this.getFormData('#outgoingForm');
        
        if (!this.validateForm(formData)) {
            return;
        }

        try {
            const operation = await this.warehouse.processOutgoing(formData);
            auth.showNotification('Расход успешно оформлен', 'success');
            
            // Закрываем модальное окно
            $('#outgoingModal').modal('hide');
            
            // Обновляем данные
            this.loadDashboardData();
            
            // Очищаем форму
            $('#outgoingForm')[0].reset();
            
        } catch (error) {
            console.error('Ошибка при оформлении расхода:', error);
            auth.showNotification('Ошибка при оформлении расхода', 'danger');
        }
    }

    // Получение данных формы
    getFormData(formSelector) {
        const form = $(formSelector);
        const formData = {};
        
        form.find('input, select, textarea').each(function() {
            const field = $(this);
            const name = field.attr('id');
            const value = field.val();
            
            if (name) {
                formData[name] = value;
            }
        });
        
        return formData;
    }

    // Валидация формы
    validateForm(formData) {
        const requiredFields = ['itemName', 'itemCategory', 'itemPrice', 'itemQuantity'];
        
        for (const field of requiredFields) {
            if (!formData[field] || formData[field].trim() === '') {
                auth.showNotification(`Поле "${this.getFieldLabel(field)}" обязательно для заполнения`, 'warning');
                return false;
            }
        }
        
        // Проверка числовых значений
        if (formData.itemPrice && parseFloat(formData.itemPrice) < 0) {
            auth.showNotification('Цена не может быть отрицательной', 'warning');
            return false;
        }
        
        if (formData.itemQuantity && parseInt(formData.itemQuantity) < 0) {
            auth.showNotification('Количество не может быть отрицательным', 'warning');
            return false;
        }
        
        return true;
    }

    // Получение метки поля
    getFieldLabel(fieldName) {
        const labels = {
            'itemName': 'Название товара',
            'itemCategory': 'Категория',
            'itemPrice': 'Цена',
            'itemQuantity': 'Количество',
            'incomingItem': 'Товар',
            'incomingQuantity': 'Количество',
            'outgoingItem': 'Товар',
            'outgoingQuantity': 'Количество'
        };
        
        return labels[fieldName] || fieldName;
    }

    // Инициализация модальных окон
    initializeModals() {
        // Очистка форм при закрытии модальных окон
        $('.modal').on('hidden.bs.modal', function() {
            $(this).find('form')[0].reset();
        });

        // Валидация в реальном времени
        $('.form-control, .form-select').on('input change', function() {
            const field = $(this);
            const value = field.val();
            
            if (field.prop('required') && (!value || value.trim() === '')) {
                field.addClass('is-invalid');
            } else {
                field.removeClass('is-invalid');
            }
        });
    }

    // Обработка поиска
    handleSearch(query) {
        // Реализация поиска по таблице
        const table = $('#recentOperationsTable');
        const rows = table.find('tbody tr');
        
        rows.each(function() {
            const row = $(this);
            const text = row.text().toLowerCase();
            const matches = text.includes(query.toLowerCase());
            
            if (matches || query === '') {
                row.show();
            } else {
                row.hide();
            }
        });
    }

    // Обработка сортировки
    handleSort(event) {
        const column = $(event.target);
        const table = column.closest('table');
        const tbody = table.find('tbody');
        const rows = tbody.find('tr').toArray();
        
        // Определяем направление сортировки
        const isAscending = !column.hasClass('sort-asc');
        
        // Убираем классы сортировки со всех заголовков
        table.find('th').removeClass('sort-asc sort-desc');
        
        // Добавляем класс сортировки к текущему заголовку
        column.addClass(isAscending ? 'sort-asc' : 'sort-desc');
        
        // Сортируем строки
        rows.sort((a, b) => {
            const aText = $(a).find('td').eq(column.index()).text();
            const bText = $(b).find('td').eq(column.index()).text();
            
            if (isAscending) {
                return aText.localeCompare(bText, 'ru');
            } else {
                return bText.localeCompare(aText, 'ru');
            }
        });
        
        // Перестраиваем таблицу
        tbody.empty().append(rows);
    }

    // Экспорт данных
    exportData() {
        try {
            const table = $('#recentOperationsTable');
            const rows = table.find('tbody tr');
            let csv = 'Дата,Тип,Товар,Количество,Сотрудник,Статус\n';
            
            rows.each(function() {
                const cells = $(this).find('td');
                if (cells.length > 1) { // Пропускаем пустые строки
                    const row = [];
                    cells.each(function() {
                        row.push(`"${$(this).text().trim()}"`);
                    });
                    csv += row.join(',') + '\n';
                }
            });
            
            // Создаем и скачиваем файл
            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');
            const url = URL.createObjectURL(blob);
            link.setAttribute('href', url);
            link.setAttribute('download', `операции_${new Date().toISOString().split('T')[0]}.csv`);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            auth.showNotification('Данные успешно экспортированы', 'success');
            
        } catch (error) {
            console.error('Ошибка при экспорте:', error);
            auth.showNotification('Ошибка при экспорте данных', 'danger');
        }
    }

    // Показать индикатор загрузки
    showLoading() {
        $('main').append(`
            <div id="loadingOverlay" class="position-fixed top-0 start-0 w-100 h-100 d-flex justify-content-center align-items-center" style="background: rgba(255,255,255,0.8); z-index: 9999;">
                <div class="text-center">
                    <div class="loading-spinner text-primary mb-2"></div>
                    <p class="text-muted">Загрузка данных...</p>
                </div>
            </div>
        `);
    }

    // Скрыть индикатор загрузки
    hideLoading() {
        $('#loadingOverlay').remove();
    }

    // Обновление информации о пользователе
    updateUserInfo() {
        const user = auth.getCurrentUser();
        console.log('Обновление информации о пользователе:', user);
        
        if (user) {
            // Обновляем имя пользователя в профиле
            const profileToggle = $('#profileDropdown .dropdown-toggle');
            if (profileToggle.length) {
                profileToggle.html(`<i class="fas fa-user me-1"></i>${user.name}`);
            }
            
            // Показываем профиль для всех авторизованных пользователей
            $('#profileDropdown').show();
            
            // Показываем админ панель только для администраторов
            if (auth.hasRole('admin')) {
                $('#adminDropdown').show();
                console.log('Показана панель администратора');
            } else {
                $('#adminDropdown').hide();
                console.log('Скрыта панель администратора');
            }
        } else {
            console.log('Пользователь не авторизован');
            $('#profileDropdown').hide();
            $('#adminDropdown').hide();
        }
        
        // Обновляем права доступа для элементов интерфейса
        auth.updateButtonPermissions();
    }

    // Загрузка категорий в навигацию
    async loadCategoriesNav() {
        try {
            const categories = await this.warehouse.getCategories();
            const categoriesNav = $('#categoriesNav');
            
            // Очищаем существующие категории (кроме "Главная")
            categoriesNav.find('li:not(:first-child)').remove();
            
            // Добавляем активные категории
            categories.forEach(category => {
                if (category.active) {
                    const categoryLink = `
                        <li class="nav-item">
                            <a class="nav-link" href="catalog.html?category=${category.id}" title="${category.description || ''}">
                                <i class="${category.icon}" style="color: ${category.color || '#2c5aa0'}"></i>
                                ${category.name}
                            </a>
                        </li>
                    `;
                    categoriesNav.append(categoryLink);
                }
            });
        } catch (error) {
            console.error('Ошибка загрузки категорий:', error);
        }
    }

    // Загрузка категорий в выпадающее меню
    async loadCategoriesDropdown() {
        try {
            const categories = await this.warehouse.getCategories();
            const dropdown = $('#catalogCategoriesDropdown');
            
            // Очищаем существующие категории (кроме "Все позиции" и разделителя)
            dropdown.find('li:not(:first-child):not(:nth-child(2))').remove();
            
            // Добавляем активные категории
            categories.forEach(category => {
                if (category.active) {
                    const isEmpty = category.itemCount === 0;
                    const categoryLink = `
                        <li>
                            <a class="dropdown-item ${isEmpty ? 'empty-category' : ''}" href="catalog.html?category=${category.id}" title="${category.description || ''}">
                                <div class="category-info">
                                    <i class="${category.icon}" style="color: ${category.color || '#2c5aa0'}"></i>
                                    <span>${category.name}</span>
                                </div>
                                <span class="category-count">${category.itemCount || 0}</span>
                            </a>
                        </li>
                    `;
                    dropdown.append(categoryLink);
                }
            });
            
            // Инициализируем hover-функциональность
            this.initHoverDropdown();
        } catch (error) {
            console.error('Ошибка загрузки категорий в выпадающее меню:', error);
        }
    }
    
    // Инициализация hover-функциональности для выпадающего меню
    initHoverDropdown() {
        const $dropdown = $('.nav-item.dropdown');
        const $dropdownMenu = $dropdown.find('.dropdown-menu');
        let hoverTimeout;
        
        // Показываем меню при наведении
        $dropdown.on('mouseenter', function() {
            clearTimeout(hoverTimeout);
            $(this).find('.dropdown-menu').addClass('show');
        });
        
        // Скрываем меню при уходе мыши
        $dropdown.on('mouseleave', function() {
            const $menu = $(this).find('.dropdown-menu');
            hoverTimeout = setTimeout(() => {
                $menu.removeClass('show');
            }, 150); // Небольшая задержка для плавности
        });
        
        // Предотвращаем скрытие при наведении на само меню
        $dropdownMenu.on('mouseenter', function() {
            clearTimeout(hoverTimeout);
        });
        
        $dropdownMenu.on('mouseleave', function() {
            hoverTimeout = setTimeout(() => {
                $(this).removeClass('show');
            }, 150);
        });
    }
}

// Инициализация приложения
const mainApp = new MainApp(); 