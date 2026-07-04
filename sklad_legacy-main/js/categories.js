// JavaScript для управления категориями
class CategoryManager {
    constructor() {
        this.warehouse = new WarehouseManager();
        this.categories = [];
        this.currentCategory = null;
        this.init();
    }

    async init() {
        try {
            // Проверяем авторизацию
            if (!auth.isUserAuthenticated()) {
                console.log('Пользователь не авторизован, перенаправление на login.html');
                window.location.href = '../login.html';
                return;
            }

            // Проверяем права доступа
            if (!auth.hasRole('admin')) {
                console.log('Пользователь не имеет прав администратора');
                auth.showNotification('Недостаточно прав для доступа к этой странице', 'danger');
                window.location.href = '../index.html';
                return;
            }

            console.log('Инициализация управления категориями для администратора:', auth.getCurrentUser()?.name);

            // Загружаем данные
            await this.loadCategories();
            this.updateStatistics();
            this.renderCategoriesTable();
            this.bindEvents();
            
            // Загружаем категории в выпадающее меню
            await this.loadCategoriesDropdown();
            
            this.updateUserInfo();

        } catch (error) {
            console.error('Ошибка инициализации:', error);
            auth.showNotification('Ошибка загрузки данных', 'danger');
        }
    }

    // Загрузка категорий
    async loadCategories() {
        this.categories = await this.warehouse.getCategories();
    }

    // Обновление статистики
    updateStatistics() {
        const totalCategories = this.categories.length;
        const activeCategories = this.categories.filter(cat => cat.active).length;
        const emptyCategories = this.categories.filter(cat => cat.itemCount === 0).length;
        
        // Получаем общее количество позиций
        const allItems = this.warehouse.getAllItemsSync();
        const totalItems = allItems.length;

        $('#totalCategories').text(totalCategories);
        $('#totalItems').text(totalItems);
        $('#activeCategories').text(activeCategories);
        $('#emptyCategories').text(emptyCategories);
    }

    // Рендеринг таблицы категорий
    renderCategoriesTable() {
        const tbody = $('#categoriesTable tbody');
        tbody.empty();

        if (this.categories.length === 0) {
            tbody.append(`
                <tr>
                    <td colspan="7" class="text-center py-4">
                        <div class="empty-state">
                            <i class="fas fa-tags fa-3x text-muted mb-3"></i>
                            <h5>Категории не найдены</h5>
                            <p class="text-muted">Добавьте первую категорию для начала работы</p>
                        </div>
                    </td>
                </tr>
            `);
            return;
        }

        this.categories.forEach(category => {
            const row = this.createCategoryRow(category);
            tbody.append(row);
        });
    }

    // Создание строки категории
    createCategoryRow(category) {
        const statusBadge = category.active ? 
            '<span class="badge bg-success">Активна</span>' : 
            '<span class="badge bg-secondary">Неактивна</span>';

        const iconPreview = category.icon ? 
            `<i class="${category.icon}" style="color: ${category.color || '#2c5aa0'}"></i>` : 
            '<i class="fas fa-tag text-muted"></i>';

        return `
            <tr data-category-id="${category.id}">
                <td>${category.id}</td>
                <td>
                    <div class="d-flex align-items-center">
                        <span class="me-2">${iconPreview}</span>
                        <strong>${category.name}</strong>
                    </div>
                </td>
                <td>${category.description || '-'}</td>
                <td>
                    <code>${category.icon || 'fas fa-tag'}</code>
                </td>
                <td>
                    <span class="badge bg-info">${category.itemCount || 0}</span>
                </td>
                <td>${statusBadge}</td>
                <td>
                    <div class="btn-group btn-group-sm">
                        <button class="btn btn-outline-primary" onclick="categoryManager.editCategory('${category.id}')" title="Редактировать">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn btn-outline-danger" onclick="categoryManager.deleteCategory('${category.id}')" title="Удалить">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }

    // Привязка событий
    bindEvents() {
        // Добавление категории
        $('#saveCategoryBtn').on('click', () => this.addCategory());
        
        // Редактирование категории
        $('#updateCategoryBtn').on('click', () => this.updateCategory());
        
        // Очистка формы при закрытии модального окна
        $('#addCategoryModal').on('hidden.bs.modal', () => this.clearAddForm());
        $('#editCategoryModal').on('hidden.bs.modal', () => this.clearEditForm());
        
        // Валидация формы
        $('#addCategoryForm').on('submit', (e) => {
            e.preventDefault();
            this.addCategory();
        });
        
        $('#editCategoryForm').on('submit', (e) => {
            e.preventDefault();
            this.updateCategory();
        });
    }

    // Добавление категории
    async addCategory() {
        try {
            const formData = this.getAddFormData();
            
            if (!formData.name.trim()) {
                auth.showNotification('Введите название категории', 'warning');
                return;
            }

            // Проверяем уникальность названия
            const existingCategory = this.categories.find(cat => 
                cat.name.toLowerCase() === formData.name.toLowerCase()
            );
            
            if (existingCategory) {
                auth.showNotification('Категория с таким названием уже существует', 'warning');
                return;
            }

            const newCategory = await this.warehouse.addCategory(formData);
            this.categories.push(newCategory);
            
            this.updateStatistics();
            this.renderCategoriesTable();
            
            $('#addCategoryModal').modal('hide');
            auth.showNotification('Категория успешно добавлена', 'success');
            
        } catch (error) {
            console.error('Ошибка при добавлении категории:', error);
            auth.showNotification('Ошибка при добавлении категории', 'danger');
        }
    }

    // Редактирование категории
    async editCategory(categoryId) {
        try {
            const category = this.categories.find(cat => cat.id === categoryId);
            if (!category) {
                auth.showNotification('Категория не найдена', 'danger');
                return;
            }

            this.currentCategory = category;
            this.fillEditForm(category);
            $('#editCategoryModal').modal('show');
            
        } catch (error) {
            console.error('Ошибка при редактировании категории:', error);
            auth.showNotification('Ошибка при загрузке категории', 'danger');
        }
    }

    // Обновление категории
    async updateCategory() {
        try {
            if (!this.currentCategory) {
                auth.showNotification('Категория не выбрана', 'warning');
                return;
            }

            const formData = this.getEditFormData();
            
            if (!formData.name.trim()) {
                auth.showNotification('Введите название категории', 'warning');
                return;
            }

            // Проверяем уникальность названия (исключая текущую категорию)
            const existingCategory = this.categories.find(cat => 
                cat.id !== this.currentCategory.id && 
                cat.name.toLowerCase() === formData.name.toLowerCase()
            );
            
            if (existingCategory) {
                auth.showNotification('Категория с таким названием уже существует', 'warning');
                return;
            }

            const updatedCategory = await this.warehouse.updateCategory(this.currentCategory.id, formData);
            
            // Обновляем категорию в списке
            const index = this.categories.findIndex(cat => cat.id === this.currentCategory.id);
            if (index !== -1) {
                this.categories[index] = updatedCategory;
            }
            
            this.updateStatistics();
            this.renderCategoriesTable();
            
            $('#editCategoryModal').modal('hide');
            auth.showNotification('Категория успешно обновлена', 'success');
            
        } catch (error) {
            console.error('Ошибка при обновлении категории:', error);
            auth.showNotification('Ошибка при обновлении категории', 'danger');
        }
    }

    // Удаление категории
    async deleteCategory(categoryId) {
        try {
            const category = this.categories.find(cat => cat.id === categoryId);
            if (!category) {
                auth.showNotification('Категория не найдена', 'danger');
                return;
            }

            // Проверяем, есть ли позиции в этой категории
            if (category.itemCount > 0) {
                const confirmDelete = confirm(
                    `В категории "${category.name}" есть ${category.itemCount} позиций. ` +
                    'Удаление категории приведет к удалению всех позиций. Продолжить?'
                );
                
                if (!confirmDelete) {
                    return;
                }
            } else {
                const confirmDelete = confirm(`Вы уверены, что хотите удалить категорию "${category.name}"?`);
                if (!confirmDelete) {
                    return;
                }
            }

            await this.warehouse.deleteCategory(categoryId);
            
            // Удаляем категорию из списка
            this.categories = this.categories.filter(cat => cat.id !== categoryId);
            
            this.updateStatistics();
            this.renderCategoriesTable();
            
            auth.showNotification('Категория успешно удалена', 'success');
            
        } catch (error) {
            console.error('Ошибка при удалении категории:', error);
            auth.showNotification('Ошибка при удалении категории', 'danger');
        }
    }

    // Получение данных формы добавления
    getAddFormData() {
        return {
            name: $('#categoryName').val().trim(),
            description: $('#categoryDescription').val().trim(),
            icon: $('#categoryIcon').val().trim() || 'fas fa-tag',
            color: $('#categoryColor').val(),
            active: $('#categoryActive').is(':checked')
        };
    }

    // Получение данных формы редактирования
    getEditFormData() {
        return {
            name: $('#editCategoryName').val().trim(),
            description: $('#editCategoryDescription').val().trim(),
            icon: $('#editCategoryIcon').val().trim() || 'fas fa-tag',
            color: $('#editCategoryColor').val(),
            active: $('#editCategoryActive').is(':checked')
        };
    }

    // Заполнение формы редактирования
    fillEditForm(category) {
        $('#editCategoryId').val(category.id);
        $('#editCategoryName').val(category.name);
        $('#editCategoryDescription').val(category.description || '');
        $('#editCategoryIcon').val(category.icon || 'fas fa-tag');
        $('#editCategoryColor').val(category.color || '#2c5aa0');
        $('#editCategoryActive').prop('checked', category.active);
    }

    // Очистка формы добавления
    clearAddForm() {
        $('#addCategoryForm')[0].reset();
        $('#categoryColor').val('#2c5aa0');
        $('#categoryActive').prop('checked', true);
    }

    // Очистка формы редактирования
    clearEditForm() {
        $('#editCategoryForm')[0].reset();
        $('#editCategoryColor').val('#2c5aa0');
        this.currentCategory = null;
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
                            <a class="dropdown-item ${isEmpty ? 'empty-category' : ''}" href="../catalog.html?category=${category.id}" title="${category.description || ''}">
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

// Инициализация при загрузке страницы
let categoryManager;

$(document).ready(() => {
    categoryManager = new CategoryManager();
    
    // Обработка выхода
    $('#logoutBtn').on('click', (e) => {
        e.preventDefault();
        auth.logout();
        window.location.href = '../login.html';
    });
}); 