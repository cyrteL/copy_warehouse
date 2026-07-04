// JavaScript для страницы профиля пользователя

class ProfileManager {
    constructor() {
        this.warehouse = new WarehouseManager();
        this.currentUser = null;
        this.userOperations = [];
        
        this.init();
    }

    init() {
        $(document).ready(async () => {
            try {
                // Проверяем авторизацию
                if (!auth.isUserAuthenticated()) {
                    console.log('Пользователь не авторизован, перенаправление на login.html');
                    window.location.href = 'login.html';
                    return;
                }

                console.log('Инициализация профиля для пользователя:', auth.getCurrentUser()?.name);

                // Загружаем профиль
                await this.loadProfile();
                
                // Загружаем категории в навигацию
                await this.loadCategoriesNav();
                
                // Загружаем категории в выпадающее меню
                await this.loadCategoriesDropdown();
                
                // Обновляем информацию о пользователе
                this.updateUserInfo();
                
                // Привязываем события
                this.bindEvents();
                
            } catch (error) {
                console.error('Ошибка инициализации:', error);
                auth.showNotification('Ошибка загрузки данных', 'danger');
            }
        });
    }

    bindEvents() {
        // Обработчики для настроек
        $('#saveSettingsBtn').on('click', () => this.saveSettings());
        
        // Обработчики для форм
        $('#changePasswordForm').on('submit', (e) => {
            e.preventDefault();
            this.savePassword();
        });
        
        $('#editProfileForm').on('submit', (e) => {
            e.preventDefault();
            this.saveProfile();
        });

        // Обработчик выхода
        $('#logoutBtn').on('click', (e) => {
            e.preventDefault();
            auth.logout();
            window.location.href = 'login.html';
        });
    }

    // Загрузка профиля
    async loadProfile() {
        try {
            this.currentUser = auth.getCurrentUser();
            if (!this.currentUser) {
                window.location.href = 'login.html';
                return;
            }

            this.displayUserInfo();
            await this.loadUserStatistics();
            await this.loadUserOperations();
            this.loadSettings();
            
        } catch (error) {
            console.error('Ошибка при загрузке профиля:', error);
            auth.showNotification('Ошибка при загрузке профиля', 'danger');
        }
    }

    // Отображение информации о пользователе
    displayUserInfo() {
        // Основная информация
        $('#userName').text(this.currentUser.name);
        $('#userPosition').text(this.currentUser.position);
        $('#userDepartment').text(this.currentUser.department);
        $('#userEmail').text(this.currentUser.email);

        // Роли
        const roles = this.currentUser.roles.map(role => this.getRoleDisplayName(role)).join(', ');
        $('#userRoles').html(`<span class="badge bg-primary me-1">${roles}</span>`);

        // Разрешения
        const permissions = this.currentUser.permissions.map(perm => this.getPermissionDisplayName(perm)).join(', ');
        $('#userPermissions').html(`<span class="badge bg-secondary me-1">${permissions}</span>`);

        // Дата регистрации (имитация)
        const registrationDate = new Date();
        registrationDate.setMonth(registrationDate.getMonth() - 3); // 3 месяца назад
        $('#userRegistrationDate').text(registrationDate.toLocaleDateString('ru-RU'));

        // Последний вход
        const lastLogin = new Date();
        lastLogin.setHours(lastLogin.getHours() - 2); // 2 часа назад
        $('#lastLogin').text(lastLogin.toLocaleDateString('ru-RU') + ' ' + lastLogin.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }));
    }

    // Получение отображаемого названия роли
    getRoleDisplayName(role) {
        const roleNames = {
            'admin': 'Администратор',
            'manager': 'Менеджер',
            'operator': 'Оператор',
            'viewer': 'Наблюдатель'
        };
        return roleNames[role] || role;
    }

    // Получение отображаемого названия разрешения
    getPermissionDisplayName(permission) {
        const permissionNames = {
            'read': 'Чтение',
            'write': 'Запись',
            'delete': 'Удаление',
            'admin': 'Администрирование'
        };
        return permissionNames[permission] || permission;
    }

    // Загрузка статистики пользователя
    async loadUserStatistics() {
        try {
            const operations = await this.warehouse.getOperations();
            const userOperations = operations.filter(op => op.employeeId === this.currentUser.id);
            
            // Общее количество операций
            $('#totalOperations').text(userOperations.length);
            
            // Операции в этом месяце
            const thisMonth = new Date().getMonth();
            const thisYear = new Date().getFullYear();
            const thisMonthOperations = userOperations.filter(op => {
                const opDate = new Date(op.date);
                return opDate.getMonth() === thisMonth && opDate.getFullYear() === thisYear;
            });
            $('#thisMonthOperations').text(thisMonthOperations.length);
            
            // Операции сегодня
            const today = new Date().toISOString().split('T')[0];
            const todayOperations = userOperations.filter(op => op.date.startsWith(today));
            $('#todayOperations').text(todayOperations.length);
            
        } catch (error) {
            console.error('Ошибка при загрузке статистики:', error);
        }
    }

    // Загрузка операций пользователя
    async loadUserOperations() {
        try {
            const operations = await this.warehouse.getOperations();
            this.userOperations = operations
                .filter(op => op.employeeId === this.currentUser.id)
                .sort((a, b) => new Date(b.date) - new Date(a.date))
                .slice(0, 10); // Последние 10 операций

            this.renderUserOperations();
            
        } catch (error) {
            console.error('Ошибка при загрузке операций:', error);
        }
    }

    // Рендеринг операций пользователя
    renderUserOperations() {
        const tbody = $('#userOperationsTable tbody');
        tbody.empty();

        if (this.userOperations.length === 0) {
            tbody.html(`
                <tr>
                    <td colspan="5" class="text-center text-muted py-4">
                        <i class="fas fa-inbox fa-2x mb-3"></i>
                        <br>У вас пока нет операций
                    </td>
                </tr>
            `);
            return;
        }

        this.userOperations.forEach(operation => {
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

    // Загрузка настроек
    loadSettings() {
        // Загружаем настройки из localStorage
        const settings = JSON.parse(localStorage.getItem('user_settings') || '{}');
        
        $('#emailNotifications').prop('checked', settings.emailNotifications !== false);
        $('#lowStockAlerts').prop('checked', settings.lowStockAlerts !== false);
        $('#operationReports').prop('checked', settings.operationReports || false);
    }

    // Сохранение настроек
    saveSettings() {
        const settings = {
            emailNotifications: $('#emailNotifications').is(':checked'),
            lowStockAlerts: $('#lowStockAlerts').is(':checked'),
            operationReports: $('#operationReports').is(':checked')
        };

        localStorage.setItem('user_settings', JSON.stringify(settings));
        auth.showNotification('Настройки сохранены', 'success');
    }

    // Смена пароля
    changePassword() {
        $('#changePasswordForm')[0].reset();
        $('#changePasswordModal').modal('show');
    }

    // Сохранение пароля
    savePassword() {
        const currentPassword = $('#currentPassword').val();
        const newPassword = $('#newPassword').val();
        const confirmPassword = $('#confirmPassword').val();

        // Валидация
        if (!currentPassword || !newPassword || !confirmPassword) {
            auth.showNotification('Пожалуйста, заполните все поля', 'warning');
            return;
        }

        if (newPassword !== confirmPassword) {
            auth.showNotification('Новые пароли не совпадают', 'warning');
            return;
        }

        if (newPassword.length < 6) {
            auth.showNotification('Новый пароль должен содержать минимум 6 символов', 'warning');
            return;
        }

        // В реальном приложении здесь был бы запрос к серверу
        // Для демонстрации просто показываем уведомление
        auth.showNotification('Пароль успешно изменен', 'success');
        $('#changePasswordModal').modal('hide');
        $('#changePasswordForm')[0].reset();
    }

    // Редактирование профиля
    editProfile() {
        // Заполняем форму текущими данными
        $('#editName').val(this.currentUser.name);
        $('#editEmail').val(this.currentUser.email);
        $('#editDepartment').val(this.currentUser.department);
        $('#editPosition').val(this.currentUser.position);
        $('#editPhone').val(this.currentUser.phone || '');
        
        $('#editProfileModal').modal('show');
    }

    // Сохранение профиля
    saveProfile() {
        const formData = {
            name: $('#editName').val(),
            email: $('#editEmail').val(),
            department: $('#editDepartment').val(),
            position: $('#editPosition').val(),
            phone: $('#editPhone').val()
        };

        // Валидация
        if (!formData.name || !formData.email) {
            auth.showNotification('Пожалуйста, заполните обязательные поля', 'warning');
            return;
        }

        if (!this.isValidEmail(formData.email)) {
            auth.showNotification('Пожалуйста, введите корректный email', 'warning');
            return;
        }

        // В реальном приложении здесь был бы запрос к серверу
        // Для демонстрации обновляем локальные данные
        Object.assign(this.currentUser, formData);
        localStorage.setItem('warehouse_user', JSON.stringify(this.currentUser));
        
        // Обновляем отображение
        this.displayUserInfo();
        
        auth.showNotification('Профиль успешно обновлен', 'success');
        $('#editProfileModal').modal('hide');
    }

    // Просмотр активности
    viewActivity() {
        // В реальном приложении здесь можно открыть страницу с детальной статистикой
        auth.showNotification('Функция просмотра активности находится в разработке', 'info');
    }

    // Генерация еженедельного отчета
    generateWeeklyReport() {
        this.warehouse.generateWeeklyReports();
    }

    // Валидация email
    isValidEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }

    // Получение статистики активности
    getActivityStats() {
        const now = new Date();
        const stats = {
            today: 0,
            thisWeek: 0,
            thisMonth: 0,
            total: this.userOperations.length
        };

        this.userOperations.forEach(operation => {
            const opDate = new Date(operation.date);
            const diffTime = now - opDate;
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

            if (diffDays === 0) stats.today++;
            if (diffDays <= 7) stats.thisWeek++;
            if (diffDays <= 30) stats.thisMonth++;
        });

        return stats;
    }

    // Экспорт данных пользователя
    exportUserData() {
        try {
            const userData = {
                profile: this.currentUser,
                operations: this.userOperations,
                statistics: this.getActivityStats(),
                settings: JSON.parse(localStorage.getItem('user_settings') || '{}')
            };

            const dataStr = JSON.stringify(userData, null, 2);
            const blob = new Blob([dataStr], { type: 'application/json' });
            const link = document.createElement('a');
            const url = URL.createObjectURL(blob);
            link.setAttribute('href', url);
            link.setAttribute('download', `profile_${this.currentUser.username}_${new Date().toISOString().split('T')[0]}.json`);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            auth.showNotification('Данные профиля экспортированы', 'success');
            
        } catch (error) {
            console.error('Ошибка при экспорте:', error);
            auth.showNotification('Ошибка при экспорте данных', 'danger');
        }
    }

    // Получение рекомендаций
    getRecommendations() {
        const recommendations = [];

        // Рекомендации на основе роли
        if (this.currentUser.roles.includes('admin')) {
            recommendations.push({
                type: 'info',
                title: 'Административные функции',
                message: 'У вас есть доступ ко всем функциям системы. Не забудьте регулярно проверять отчеты и управлять пользователями.'
            });
        }

        if (this.currentUser.roles.includes('manager')) {
            recommendations.push({
                type: 'warning',
                title: 'Управление складом',
                message: 'Следите за товарами с низким запасом и контролируйте операции операторов.'
            });
        }

        // Рекомендации на основе активности
        const stats = this.getActivityStats();
        if (stats.today === 0) {
            recommendations.push({
                type: 'success',
                title: 'Добро пожаловать!',
                message: 'Сегодня у вас пока нет операций. Начните работу с добавления товаров или оформления операций.'
            });
        }

        return recommendations;
    }

    // Обновление информации о пользователе
    updateUserInfo() {
        const user = auth.getCurrentUser();
        if (user) {
            $('#currentUserInfo').text(user.name);
            $('#loginLink').hide();
            $('#profileDropdown').show();
            
            // Показываем админ панель только для администраторов
            if (auth.hasRole('admin')) {
                $('#adminDropdown').show();
            } else {
                $('#adminDropdown').hide();
            }
        } else {
            $('#currentUserInfo').text('Гость');
            $('#loginLink').show();
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

// Инициализация менеджера профиля
const profileManager = new ProfileManager(); 