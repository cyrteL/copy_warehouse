// Система управления пользователями

class UserManager {
    constructor() {
        this.users = [];
        this.filteredUsers = [];
        this.currentUser = null;
        this.init();
    }

    init() {
        // Проверяем авторизацию и права доступа
        if (!auth.isUserAuthenticated()) {
            window.location.href = '../login.html';
            return;
        }

        if (!auth.hasRole('admin')) {
            auth.showNotification('У вас нет прав для доступа к этой странице', 'danger');
            window.location.href = '../index.html';
            return;
        }

        this.currentUser = auth.getCurrentUser();
        this.bindEvents();
        this.loadUsers();
        this.loadCategoriesNav();
    }

    bindEvents() {
        // Поиск и фильтрация
        $('#searchInput').on('input', (e) => this.handleSearch(e.target.value));
        $('#roleFilter').on('change', (e) => this.handleRoleFilter(e.target.value));

        // Формы
        $('#addUserForm').on('submit', (e) => this.handleAddUser(e));
        $('#editUserForm').on('submit', (e) => this.handleEditUser(e));

        // Удаление
        $('#confirmDeleteBtn').on('click', () => this.handleDeleteUser());

        // Автоматическое обновление разрешений при изменении ролей
        $('input[type="checkbox"][value^="role"]').on('change', () => this.updatePermissionsFromRoles());
        $('input[type="checkbox"][value^="editRole"]').on('change', () => this.updateEditPermissionsFromRoles());
    }

    // Загрузка пользователей
    async loadUsers() {
        try {
            this.showLoading();
            
            const token = localStorage.getItem('token');
            if (!token) {
                throw new Error('Токен не найден');
            }

            const response = await fetch('/api/users', {
                headers: { 
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            this.users = await response.json();
            this.filteredUsers = [...this.users];
            
            this.renderUsers();
            this.updateStatistics();
            this.hideLoading();
            
        } catch (error) {
            // Если API недоступен, используем имитацию данных
            this.users = this.getMockUsers();
            this.filteredUsers = [...this.users];
            
            this.renderUsers();
            this.updateStatistics();
            this.hideLoading();
            
            // Показываем уведомление только если это не демо-режим
            if (!error.message.includes('Failed to fetch')) {
                auth.showNotification('Ошибка при загрузке пользователей', 'danger');
            }
        }
    }

    // Получение имитационных данных пользователей
    getMockUsers() {
        return [
            {
                id: 1,
                username: 'admin',
                name: 'Администратор',
                email: 'admin@company.com',
                department: 'IT',
                position: 'Системный администратор',
                roles: ['admin'],
                permissions: ['read', 'write', 'delete', 'admin'],
                active: true,
                createdAt: '2025-01-01T00:00:00Z',
                lastLogin: '2025-08-15T10:30:00Z'
            },
            {
                id: 2,
                username: 'manager',
                name: 'Менеджер склада',
                email: 'manager@company.com',
                department: 'Склад',
                position: 'Менеджер склада',
                roles: ['manager'],
                permissions: ['read', 'write'],
                active: true,
                createdAt: '2025-01-15T00:00:00Z',
                lastLogin: '2025-08-15T09:15:00Z'
            },
            {
                id: 3,
                username: 'operator',
                name: 'Оператор',
                email: 'operator@company.com',
                department: 'Склад',
                position: 'Оператор склада',
                roles: ['operator'],
                permissions: ['read'],
                active: true,
                createdAt: '2025-02-01T00:00:00Z',
                lastLogin: '2025-08-14T16:45:00Z'
            },
            {
                id: 4,
                username: 'viewer',
                name: 'Наблюдатель',
                email: 'viewer@company.com',
                department: 'Бухгалтерия',
                position: 'Бухгалтер',
                roles: ['viewer'],
                permissions: ['read'],
                active: false,
                createdAt: '2025-02-15T00:00:00Z',
                lastLogin: '2025-08-10T14:20:00Z'
            }
        ];
    }

    // Отрисовка пользователей
    renderUsers() {
        const grid = $('#usersGrid');
        grid.empty();

        if (this.filteredUsers.length === 0) {
            $('#emptyState').show();
            return;
        }

        $('#emptyState').hide();

        this.filteredUsers.forEach(user => {
            const userCard = this.createUserCard(user);
            grid.append(userCard);
        });
    }

    // Создание карточки пользователя
    createUserCard(user) {
        const roleBadges = user.roles.map(role => {
            const roleConfig = this.getRoleConfig(role);
            return `<span class="badge ${roleConfig.class} role-badge">${roleConfig.icon} ${roleConfig.name}</span>`;
        }).join('');

        const permissionChips = user.permissions.map(perm => {
            const permConfig = this.getPermissionConfig(perm);
            return `<span class="permission-chip">${permConfig.icon} ${permConfig.name}</span>`;
        }).join('');

        const statusClass = user.active ? 'status-active' : 'status-inactive';
        const statusIcon = user.active ? 'fa-user-check' : 'fa-user-times';
        const statusText = user.active ? 'Активен' : 'Неактивен';

        return `
            <div class="col-lg-4 col-md-6 mb-4">
                <div class="card user-card h-100">
                    <div class="card-header d-flex justify-content-between align-items-center">
                        <div>
                            <h6 class="mb-0">
                                <i class="fas fa-user me-2"></i>
                                ${this.highlightSearch(user.name)}
                            </h6>
                            <small class="text-muted">@${user.username}</small>
                        </div>
                        <div class="dropdown">
                            <button class="btn btn-sm btn-outline-secondary dropdown-toggle" type="button" data-bs-toggle="dropdown">
                                <i class="fas fa-ellipsis-v"></i>
                            </button>
                            <ul class="dropdown-menu">
                                <li><a class="dropdown-item" href="#" onclick="userManager.editUser(${user.id})">
                                    <i class="fas fa-edit me-2"></i>Редактировать
                                </a></li>
                                <li><a class="dropdown-item" href="#" onclick="userManager.toggleUserStatus(${user.id})">
                                    <i class="fas fa-toggle-on me-2"></i>${user.active ? 'Деактивировать' : 'Активировать'}
                                </a></li>
                                <li><hr class="dropdown-divider"></li>
                                <li><a class="dropdown-item text-danger" href="#" onclick="userManager.deleteUser(${user.id})">
                                    <i class="fas fa-trash me-2"></i>Удалить
                                </a></li>
                            </ul>
                        </div>
                    </div>
                    <div class="card-body">
                        <div class="mb-3">
                            <div class="d-flex align-items-center mb-2">
                                <i class="fas fa-envelope me-2 text-muted"></i>
                                <small>${this.highlightSearch(user.email)}</small>
                            </div>
                            <div class="d-flex align-items-center mb-2">
                                <i class="fas fa-building me-2 text-muted"></i>
                                <small>${user.department || 'Не указан'}</small>
                            </div>
                            <div class="d-flex align-items-center mb-2">
                                <i class="fas fa-briefcase me-2 text-muted"></i>
                                <small>${user.position || 'Не указана'}</small>
                            </div>
                            <div class="d-flex align-items-center">
                                <i class="fas ${statusIcon} me-2 ${statusClass}"></i>
                                <small class="${statusClass}">${statusText}</small>
                            </div>
                        </div>
                        
                        <div class="mb-3">
                            <label class="form-label small text-muted">Роли:</label>
                            <div>${roleBadges}</div>
                        </div>
                        
                        <div class="mb-3">
                            <label class="form-label small text-muted">Разрешения:</label>
                            <div>${permissionChips}</div>
                        </div>
                        
                        <div class="small text-muted">
                            <div>Создан: ${this.formatDate(user.createdAt)}</div>
                            <div>Последний вход: ${this.formatDate(user.lastLogin)}</div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    // Конфигурация ролей
    getRoleConfig(role) {
        const configs = {
            admin: { name: 'Администратор', class: 'bg-danger', icon: 'fas fa-user-shield' },
            manager: { name: 'Менеджер', class: 'bg-warning', icon: 'fas fa-user-tie' },
            operator: { name: 'Оператор', class: 'bg-info', icon: 'fas fa-user-cog' },
            viewer: { name: 'Наблюдатель', class: 'bg-secondary', icon: 'fas fa-user' }
        };
        return configs[role] || { name: role, class: 'bg-secondary', icon: 'fas fa-user' };
    }

    // Конфигурация разрешений
    getPermissionConfig(permission) {
        const configs = {
            read: { name: 'Чтение', icon: 'fas fa-eye' },
            write: { name: 'Запись', icon: 'fas fa-edit' },
            delete: { name: 'Удаление', icon: 'fas fa-trash' },
            admin: { name: 'Администрирование', icon: 'fas fa-cogs' }
        };
        return configs[permission] || { name: permission, icon: 'fas fa-check' };
    }

    // Подсветка поиска
    highlightSearch(text) {
        const searchTerm = $('#searchInput').val().toLowerCase();
        if (!searchTerm || !text) return text;
        
        const regex = new RegExp(`(${searchTerm})`, 'gi');
        return text.toString().replace(regex, '<span class="search-highlight">$1</span>');
    }

    // Обработка поиска
    handleSearch(query) {
        const searchTerm = query.toLowerCase();
        const roleFilter = $('#roleFilter').val();
        
        this.filteredUsers = this.users.filter(user => {
            const matchesSearch = !searchTerm || 
                user.name.toLowerCase().includes(searchTerm) ||
                user.username.toLowerCase().includes(searchTerm) ||
                user.email.toLowerCase().includes(searchTerm) ||
                (user.department && user.department.toLowerCase().includes(searchTerm));
            
            const matchesRole = !roleFilter || user.roles.includes(roleFilter);
            
            return matchesSearch && matchesRole;
        });
        
        this.renderUsers();
    }

    // Обработка фильтра по ролям
    handleRoleFilter(role) {
        this.handleSearch($('#searchInput').val());
    }

    // Обновление статистики
    updateStatistics() {
        const totalUsers = this.users.length;
        const activeUsers = this.users.filter(u => u.active).length;
        const adminUsers = this.users.filter(u => u.roles.includes('admin')).length;
        const managerUsers = this.users.filter(u => u.roles.includes('manager')).length;

        $('#totalUsers').text(totalUsers);
        $('#activeUsers').text(activeUsers);
        $('#adminUsers').text(adminUsers);
        $('#managerUsers').text(managerUsers);
    }

    // Добавление пользователя
    async handleAddUser(event) {
        event.preventDefault();
        
        const formData = this.getFormData('#addUserForm');
        
        if (!this.validateUserData(formData)) {
            return;
        }

        try {
            const token = localStorage.getItem('token');
            if (!token) {
                throw new Error('Токен не найден');
            }

            const response = await fetch('/api/users', {
                method: 'POST',
                headers: { 
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json' 
                },
                body: JSON.stringify(formData)
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Ошибка создания пользователя');
            }

            const newUser = await response.json();
            this.users.push(newUser);
            this.filteredUsers = [...this.users];
            
            this.renderUsers();
            this.updateStatistics();
            
            $('#addUserModal').modal('hide');
            $('#addUserForm')[0].reset();
            
            auth.showNotification('Пользователь успешно создан', 'success');
            
        } catch (error) {
            // Если API недоступен, используем имитацию
            if (error.message.includes('Failed to fetch')) {
                const newUser = {
                    id: this.users.length + 1,
                    ...formData,
                    active: true,
                    createdAt: new Date().toISOString(),
                    lastLogin: null
                };

                this.users.push(newUser);
                this.filteredUsers = [...this.users];
                
                this.renderUsers();
                this.updateStatistics();
                
                $('#addUserModal').modal('hide');
                $('#addUserForm')[0].reset();
                
                auth.showNotification('Пользователь успешно создан (демо-режим)', 'success');
            } else {
                auth.showNotification(error.message || 'Ошибка при создании пользователя', 'danger');
            }
        }
    }

    // Редактирование пользователя
    async handleEditUser(event) {
        event.preventDefault();
        
        const formData = this.getFormData('#editUserForm');
        const userId = parseInt($('#editUserId').val());
        
        if (!this.validateUserData(formData)) {
            return;
        }

        try {
            const token = localStorage.getItem('token');
            if (!token) {
                throw new Error('Токен не найден');
            }

            const response = await fetch(`/api/users/${userId}`, {
                method: 'PUT',
                headers: { 
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json' 
                },
                body: JSON.stringify(formData)
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Ошибка обновления пользователя');
            }

            const updatedUser = await response.json();
            const userIndex = this.users.findIndex(u => u.id === userId);
            if (userIndex !== -1) {
                this.users[userIndex] = updatedUser;
                this.filteredUsers = [...this.users];
                
                this.renderUsers();
                this.updateStatistics();
                
                $('#editUserModal').modal('hide');
                
                auth.showNotification('Пользователь успешно обновлен', 'success');
            }
            
        } catch (error) {
            // Если API недоступен, используем имитацию
            if (error.message.includes('Failed to fetch')) {
                const userIndex = this.users.findIndex(u => u.id === userId);
                if (userIndex !== -1) {
                    this.users[userIndex] = { ...this.users[userIndex], ...formData };
                    this.filteredUsers = [...this.users];
                    
                    this.renderUsers();
                    this.updateStatistics();
                    
                    $('#editUserModal').modal('hide');
                    
                    auth.showNotification('Пользователь успешно обновлен (демо-режим)', 'success');
                }
            } else {
                auth.showNotification(error.message || 'Ошибка при обновлении пользователя', 'danger');
            }
        }
    }

    // Удаление пользователя
    deleteUser(userId) {
        const user = this.users.find(u => u.id === userId);
        if (!user) return;

        $('#deleteUserName').text(user.name);
        $('#deleteUserModal').modal('show');
        
        // Сохраняем ID для подтверждения
        $('#deleteUserModal').data('userId', userId);
    }

    // Подтверждение удаления
    async handleDeleteUser() {
        const userId = $('#deleteUserModal').data('userId');
        
        try {
            const token = localStorage.getItem('token');
            if (!token) {
                throw new Error('Токен не найден');
            }

            const response = await fetch(`/api/users/${userId}`, { 
                method: 'DELETE',
                headers: { 
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json' 
                }
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Ошибка удаления пользователя');
            }

            this.users = this.users.filter(u => u.id !== userId);
            this.filteredUsers = this.filteredUsers.filter(u => u.id !== userId);
            
            this.renderUsers();
            this.updateStatistics();
            
            $('#deleteUserModal').modal('hide');
            
            auth.showNotification('Пользователь успешно удален', 'success');
            
        } catch (error) {
            // Если API недоступен, используем имитацию
            if (error.message.includes('Failed to fetch')) {
                this.users = this.users.filter(u => u.id !== userId);
                this.filteredUsers = this.filteredUsers.filter(u => u.id !== userId);
                
                this.renderUsers();
                this.updateStatistics();
                
                $('#deleteUserModal').modal('hide');
                
                auth.showNotification('Пользователь успешно удален (демо-режим)', 'success');
            } else {
                auth.showNotification(error.message || 'Ошибка при удалении пользователя', 'danger');
            }
        }
    }

    // Переключение статуса пользователя
    async toggleUserStatus(userId) {
        const user = this.users.find(u => u.id === userId);
        if (!user) return;

        try {
            const token = localStorage.getItem('token');
            if (!token) {
                throw new Error('Токен не найден');
            }

            const response = await fetch(`/api/users/${userId}/toggle-status`, { 
                method: 'PATCH',
                headers: { 
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json' 
                }
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Ошибка изменения статуса');
            }

            const result = await response.json();
            user.active = result.active;
            this.filteredUsers = [...this.users];
            
            this.renderUsers();
            this.updateStatistics();
            
            auth.showNotification(result.message, 'success');
            
        } catch (error) {
            // Если API недоступен, используем имитацию
            if (error.message.includes('Failed to fetch')) {
                user.active = !user.active;
                this.filteredUsers = [...this.users];
                
                this.renderUsers();
                this.updateStatistics();
                
                const status = user.active ? 'активирован' : 'деактивирован';
                auth.showNotification(`Пользователь ${status} (демо-режим)`, 'success');
            } else {
                auth.showNotification(error.message || 'Ошибка при изменении статуса', 'danger');
            }
        }
    }

    // Открытие формы редактирования
    editUser(userId) {
        const user = this.users.find(u => u.id === userId);
        if (!user) return;

        // Заполняем форму данными пользователя
        $('#editUserId').val(user.id);
        $('#editUsername').val(user.username);
        $('#editEmail').val(user.email);
        $('#editFullName').val(user.name);
        $('#editDepartment').val(user.department || '');
        $('#editPosition').val(user.position || '');
        $('#editPassword').val('');

        // Устанавливаем роли
        $('#editRoleAdmin').prop('checked', user.roles.includes('admin'));
        $('#editRoleManager').prop('checked', user.roles.includes('manager'));
        $('#editRoleOperator').prop('checked', user.roles.includes('operator'));
        $('#editRoleViewer').prop('checked', user.roles.includes('viewer'));

        // Устанавливаем разрешения
        $('#editPermRead').prop('checked', user.permissions.includes('read'));
        $('#editPermWrite').prop('checked', user.permissions.includes('write'));
        $('#editPermDelete').prop('checked', user.permissions.includes('delete'));
        $('#editPermAdmin').prop('checked', user.permissions.includes('admin'));

        $('#editUserModal').modal('show');
    }

    // Получение данных формы
    getFormData(formSelector) {
        const form = $(formSelector);
        const formData = {};
        
        // Основные поля
        form.find('input[type="text"], input[type="email"], input[type="password"]').each(function() {
            const field = $(this);
            const name = field.attr('id');
            const value = field.val();
            
            if (name) {
                formData[name] = value;
            }
        });

        // Роли
        const roles = [];
        form.find('input[type="checkbox"][value^="admin"], input[type="checkbox"][value^="manager"], input[type="checkbox"][value^="operator"], input[type="checkbox"][value^="viewer"]').each(function() {
            if ($(this).is(':checked')) {
                roles.push($(this).val());
            }
        });
        formData.roles = roles;

        // Разрешения
        const permissions = [];
        form.find('input[type="checkbox"][value^="read"], input[type="checkbox"][value^="write"], input[type="checkbox"][value^="delete"], input[type="checkbox"][value^="admin"]').each(function() {
            if ($(this).is(':checked')) {
                permissions.push($(this).val());
            }
        });
        formData.permissions = permissions;
        
        return formData;
    }

    // Валидация данных пользователя
    validateUserData(formData) {
        if (!formData.username || formData.username.trim().length < 3) {
            auth.showNotification('Имя пользователя должно содержать минимум 3 символа', 'warning');
            return false;
        }

        if (!formData.fullName || formData.fullName.trim().length < 2) {
            auth.showNotification('Полное имя должно содержать минимум 2 символа', 'warning');
            return false;
        }

        if (!formData.email || !this.isValidEmail(formData.email)) {
            auth.showNotification('Введите корректный email адрес', 'warning');
            return false;
        }

        if (formData.roles.length === 0) {
            auth.showNotification('Выберите хотя бы одну роль', 'warning');
            return false;
        }

        if (formData.permissions.length === 0) {
            auth.showNotification('Выберите хотя бы одно разрешение', 'warning');
            return false;
        }

        // Проверка уникальности username
        const existingUser = this.users.find(u => u.username === formData.username);
        if (existingUser && existingUser.id !== parseInt($('#editUserId').val() || 0)) {
            auth.showNotification('Пользователь с таким именем уже существует', 'warning');
            return false;
        }

        return true;
    }

    // Проверка email
    isValidEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }

    // Автоматическое обновление разрешений при изменении ролей
    updatePermissionsFromRoles() {
        const roles = [];
        $('input[type="checkbox"][value^="admin"], input[type="checkbox"][value^="manager"], input[type="checkbox"][value^="operator"], input[type="checkbox"][value^="viewer"]').each(function() {
            if ($(this).is(':checked')) {
                roles.push($(this).val());
            }
        });

        // Сбрасываем все разрешения
        $('input[type="checkbox"][value^="read"], input[type="checkbox"][value^="write"], input[type="checkbox"][value^="delete"], input[type="checkbox"][value^="admin"]').prop('checked', false);

        // Устанавливаем разрешения в зависимости от ролей
        if (roles.includes('admin')) {
            $('#permRead, #permWrite, #permDelete, #permAdmin').prop('checked', true);
        } else if (roles.includes('manager')) {
            $('#permRead, #permWrite').prop('checked', true);
        } else if (roles.includes('operator')) {
            $('#permRead').prop('checked', true);
        } else if (roles.includes('viewer')) {
            $('#permRead').prop('checked', true);
        }
    }

    // Автоматическое обновление разрешений при изменении ролей (для редактирования)
    updateEditPermissionsFromRoles() {
        const roles = [];
        $('input[type="checkbox"][value^="editRole"]').each(function() {
            if ($(this).is(':checked')) {
                roles.push($(this).val().replace('editRole', ''));
            }
        });

        // Сбрасываем все разрешения
        $('input[type="checkbox"][value^="editPerm"]').prop('checked', false);

        // Устанавливаем разрешения в зависимости от ролей
        if (roles.includes('admin')) {
            $('#editPermRead, #editPermWrite, #editPermDelete, #editPermAdmin').prop('checked', true);
        } else if (roles.includes('manager')) {
            $('#editPermRead, #editPermWrite').prop('checked', true);
        } else if (roles.includes('operator')) {
            $('#editPermRead').prop('checked', true);
        } else if (roles.includes('viewer')) {
            $('#editPermRead').prop('checked', true);
        }
    }

    // Форматирование даты
    formatDate(dateString) {
        if (!dateString) return 'Никогда';
        
        const date = new Date(dateString);
        return date.toLocaleDateString('ru-RU', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    // Показать загрузку
    showLoading() {
        $('#loadingState').show();
        $('#usersGrid').hide();
        $('#emptyState').hide();
    }

    // Скрыть загрузку
    hideLoading() {
        $('#loadingState').hide();
        $('#usersGrid').show();
    }

    // Загрузка категорий в навигацию
    async loadCategoriesNav() {
        try {
            // В реальном приложении здесь был бы запрос к API
            const categories = [
                { id: 1, name: 'Электроника', icon: 'fas fa-laptop', color: '#2c5aa0', active: true },
                { id: 2, name: 'Инструменты', icon: 'fas fa-tools', color: '#1a7f37', active: true },
                { id: 3, name: 'Офис', icon: 'fas fa-briefcase', color: '#8a2be2', active: true }
            ];
            
            const dropdown = $('#catalogCategoriesDropdown');
            
            // Очищаем существующие категории (кроме "Все позиции" и разделителя)
            dropdown.find('li:not(:first-child):not(:nth-child(2))').remove();
            
            // Добавляем активные категории
            categories.forEach(category => {
                if (category.active) {
                    const categoryLink = `
                        <li>
                            <a class="dropdown-item" href="../catalog.html?category=${category.id}" title="">
                                <div class="category-info">
                                    <i class="${category.icon}" style="color: ${category.color || '#2c5aa0'}"></i>
                                    <span>${category.name}</span>
                                </div>
                            </a>
                        </li>
                    `;
                    dropdown.append(categoryLink);
                }
            });
        } catch (error) {
            // Ошибка загрузки категорий не критична для этой страницы
        }
    }
}

// Инициализация менеджера пользователей
const userManager = new UserManager();
