// JavaScript для страницы каталога позиций

class CatalogManager {
    constructor() {
        this.warehouse = new WarehouseManager();
        this.currentItems = [];
        this.filteredItems = [];
        this.currentPage = 1;
        this.itemsPerPage = 12;
        this.currentView = 'grid';
        this.filters = {};
        
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

                console.log('Инициализация каталога для пользователя:', auth.getCurrentUser()?.name);

                // Загружаем каталог
                await this.loadCatalog();
                
                // Загружаем категории в навигацию
                await this.loadCategoriesNav();
                
                // Загружаем категории в выпадающее меню
                await this.loadCategoriesDropdown();
                
                // Обновляем информацию о пользователе
                this.updateUserInfo();
                
                // Привязываем события
                this.bindEvents();
                
                // Инициализируем фильтры
                this.initializeFilters();
                
                // Проверяем параметр категории в URL
                this.handleCategoryFromUrl();
                
                // Обновляем права доступа
                this.updatePermissions();
                
            } catch (error) {
                console.error('Ошибка инициализации:', error);
                auth.showNotification('Ошибка загрузки данных', 'danger');
            }
        });
    }

    bindEvents() {
        // Поиск и фильтры
        $('#searchInput').on('input', (e) => this.handleSearch(e.target.value));
        $('#categoryFilter').on('change', (e) => this.handleCategoryFilter(e.target.value));
        $('#priceMin, #priceMax').on('input', () => this.handlePriceFilter());
        $('#inStockFilter, #lowStockFilter').on('change', () => this.applyFilters());
        $('#clearFiltersBtn').on('click', () => this.clearFilters());

        // Переключение вида
        $('input[name="viewMode"]').on('change', (e) => {
            this.currentView = e.target.id === 'gridView' ? 'grid' : 'list';
            this.renderCatalog();
        });

        // Модальные окна
        $('#saveItemBtn').on('click', () => this.addNewItem());
        $('#updateItemBtn').on('click', () => this.updateItem());

        // Экспорт
        $('#exportBtn').on('click', () => this.exportCatalog());

        // Обработчик выхода
        $('#logoutBtn').on('click', (e) => {
            e.preventDefault();
            auth.logout();
            window.location.href = 'login.html';
        });
    }

    // Загрузка каталога
    async loadCatalog() {
        try {
            this.showLoading();
            
            // Загружаем позиции
            this.currentItems = await this.warehouse.getAllItems();
            
            // Загружаем категории
            const categories = await this.warehouse.getCategories();
            if (categories && categories.length > 0) {
                this.populateCategoryFilters(categories);
            } else {
                console.warn('Категории не найдены');
                auth.showNotification('Категории не загружены', 'warning');
            }
            
            // Применяем фильтры и рендерим
            this.applyFilters();
            this.updateStatistics();
            
            this.hideLoading();
            
        } catch (error) {
            console.error('Ошибка при загрузке каталога:', error);
            auth.showNotification('Ошибка при загрузке каталога', 'danger');
            this.hideLoading();
        } finally {
            // Проверяем уведомления о низком остатке
            await this.warehouse.checkAndSendNotifications();
        }
    }

    // Инициализация фильтров
    initializeFilters() {
        // Устанавливаем значения по умолчанию
        this.filters = {
            search: '',
            category: '',
            minPrice: null,
            maxPrice: null,
            inStock: false,
            lowStock: false
        };
    }

    // Заполнение фильтра категорий
    populateCategoryFilters(categories) {
        const categoryFilter = $('#categoryFilter');
        const addItemCategory = $('#itemCategory');
        const editItemCategory = $('#editItemCategory');
        
        // Очищаем существующие опции (кроме первой)
        categoryFilter.find('option:not(:first)').remove();
        addItemCategory.find('option:not(:first)').remove();
        editItemCategory.find('option:not(:first)').remove();
        
        // Добавляем опцию "Без категории"
        const uncategorizedOption = `<option value="uncategorized">Без категории</option>`;
        categoryFilter.append(uncategorizedOption);
        addItemCategory.append(uncategorizedOption);
        editItemCategory.append(uncategorizedOption);
        
        // Добавляем категории
        if (categories && categories.length > 0) {
            categories.forEach(category => {
                if (category && category.id && category.name) {
                    const option = `<option value="${category.id}">${category.name}</option>`;
                    categoryFilter.append(option);
                    addItemCategory.append(option);
                    editItemCategory.append(option);
                }
            });
        }
    }

    // Обработка поиска
    handleSearch(query) {
        this.filters.search = query;
        this.applyFilters();
    }

    // Обработка фильтра категории
    handleCategoryFilter(category) {
        this.filters.category = category;
        this.applyFilters();
    }

    // Обработка фильтра цены
    handlePriceFilter() {
        this.filters.minPrice = $('#priceMin').val() ? parseFloat($('#priceMin').val()) : null;
        this.filters.maxPrice = $('#priceMax').val() ? parseFloat($('#priceMax').val()) : null;
        this.applyFilters();
    }

    // Применение всех фильтров
    applyFilters() {
        this.filters.inStock = $('#inStockFilter').is(':checked');
        this.filters.lowStock = $('#lowStockFilter').is(':checked');

        // Фильтруем позиции
        this.filteredItems = this.currentItems.filter(item => {
            // Поиск по названию, описанию и штрих-коду
            if (this.filters.search) {
                const searchQuery = this.filters.search.toLowerCase();
                const matchesSearch = 
                    item.name.toLowerCase().includes(searchQuery) ||
                    item.description.toLowerCase().includes(searchQuery) ||
                    item.barcode.includes(searchQuery);
                if (!matchesSearch) return false;
            }

            // Фильтр по категории
            if (this.filters.category && item.category !== this.filters.category) {
                return false;
            }

            // Фильтр по цене
            if (this.filters.minPrice && item.price < this.filters.minPrice) {
                return false;
            }
            if (this.filters.maxPrice && item.price > this.filters.maxPrice) {
                return false;
            }

            // Фильтр по наличию
            if (this.filters.inStock && item.quantity <= 0) {
                return false;
            }

            // Фильтр по низкому запасу
            if (this.filters.lowStock && item.quantity > item.minQuantity) {
                return false;
            }

            return true;
        });

        this.currentPage = 1;
        this.renderCatalog();
        this.updateStatistics();
    }

    // Очистка фильтров
    clearFilters() {
        $('#searchInput').val('');
        $('#categoryFilter').val('');
        $('#priceMin').val('');
        $('#priceMax').val('');
        $('#inStockFilter').prop('checked', false);
        $('#lowStockFilter').prop('checked', false);
        
        this.initializeFilters();
        this.applyFilters();
    }

    // Рендеринг каталога
    renderCatalog() {
        const container = $('#catalogContainer');
        container.empty();

        if (this.filteredItems.length === 0) {
            container.html(`
                <div class="col-12">
                    <div class="empty-state">
                        <i class="fas fa-search"></i>
                        <h4>Позиции не найдены</h4>
                        <p>Попробуйте изменить параметры поиска или фильтры</p>
                    </div>
                </div>
            `);
            return;
        }

        // Пагинация
        const totalPages = Math.ceil(this.filteredItems.length / this.itemsPerPage);
        const startIndex = (this.currentPage - 1) * this.itemsPerPage;
        const endIndex = startIndex + this.itemsPerPage;
        const pageItems = this.filteredItems.slice(startIndex, endIndex);

        // Рендерим позиции
        pageItems.forEach(item => {
            const itemHtml = this.currentView === 'grid' ? 
                this.createGridItem(item) : this.createListItem(item);
            container.append(itemHtml);
        });

        // Рендерим пагинацию
        this.renderPagination(totalPages);
    }

            // Создание карточки позиции (сетка)
    createGridItem(item) {
        const category = this.getCategoryInfo(item.category);
        const stockStatus = this.getStockStatus(item);
        
        return `
            <div class="col-lg-3 col-md-4 col-sm-6 mb-4">
                <div class="card product-card h-100">
                    <div class="product-image">
                        <i class="${category.icon} fa-3x"></i>
                    </div>
                    <div class="card-body">
                        <h6 class="card-title">${item.name}</h6>
                        <p class="card-text text-muted small">${item.description.substring(0, 60)}${item.description.length > 60 ? '...' : ''}</p>
                        <div class="d-flex justify-content-between align-items-center mb-2">
                            <span class="badge bg-secondary">${category.name}</span>
                            <span class="badge ${stockStatus.class}">${stockStatus.text}</span>
                        </div>
                        <div class="row text-center mb-3">
                            <div class="col-6">
                                <small class="text-muted">Цена</small>
                                <div class="fw-bold">${item.price.toLocaleString()} ₽</div>
                            </div>
                            <div class="col-6">
                                <small class="text-muted">Количество</small>
                                <div class="fw-bold">${item.quantity} шт.</div>
                            </div>
                        </div>
                        <div class="d-grid gap-2">
                            <button class="btn btn-outline-primary btn-sm" onclick="catalogManager.viewItem(${item.id})">
                                <i class="fas fa-eye me-1"></i>Просмотр
                            </button>
                            ${(auth.hasRole('admin') || auth.hasRole('manager')) ? `
                                <button class="btn btn-outline-warning btn-sm" onclick="catalogManager.editItem(${item.id})">
                                    <i class="fas fa-edit me-1"></i>Редактировать
                                </button>
                            ` : ''}
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

            // Создание строки позиции (список)
    createListItem(item) {
        const category = this.getCategoryInfo(item.category);
        const stockStatus = this.getStockStatus(item);
        
        return `
            <div class="col-12 mb-3">
                <div class="card">
                    <div class="card-body">
                        <div class="row align-items-center">
                            <div class="col-md-2">
                                <div class="text-center">
                                    <i class="${category.icon} fa-2x text-muted"></i>
                                </div>
                            </div>
                            <div class="col-md-3">
                                <h6 class="mb-1">${item.name}</h6>
                                <small class="text-muted">${item.description.substring(0, 50)}${item.description.length > 50 ? '...' : ''}</small>
                            </div>
                            <div class="col-md-2">
                                <span class="badge bg-secondary">${category.name}</span>
                            </div>
                            <div class="col-md-2">
                                <div class="text-center">
                                    <div class="fw-bold">${item.price.toLocaleString()} ₽</div>
                                    <small class="text-muted">${item.quantity} шт.</small>
                                </div>
                            </div>
                            <div class="col-md-2">
                                <span class="badge ${stockStatus.class}">${stockStatus.text}</span>
                            </div>
                            <div class="col-md-1">
                                <div class="dropdown">
                                    <button class="btn btn-outline-secondary btn-sm dropdown-toggle" type="button" data-bs-toggle="dropdown">
                                        <i class="fas fa-ellipsis-v"></i>
                                    </button>
                                    <ul class="dropdown-menu">
                                        <li><a class="dropdown-item" href="#" onclick="catalogManager.viewItem(${item.id})">
                                            <i class="fas fa-eye me-2"></i>Просмотр
                                        </a></li>
                                        ${(auth.hasRole('admin') || auth.hasRole('manager')) ? `
                                            <li><a class="dropdown-item" href="#" onclick="catalogManager.editItem(${item.id})">
                                                <i class="fas fa-edit me-2"></i>Редактировать
                                            </a></li>
                                        ` : ''}
                                        ${auth.hasRole('admin') ? `
                                            <li><hr class="dropdown-divider"></li>
                                            <li><a class="dropdown-item text-danger" href="#" onclick="catalogManager.deleteItem(${item.id})">
                                                <i class="fas fa-trash me-2"></i>Удалить
                                            </a></li>
                                        ` : ''}
                                    </ul>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    // Рендеринг пагинации
    renderPagination(totalPages) {
        const pagination = $('#pagination');
        pagination.empty();

        if (totalPages <= 1) return;

        // Кнопка "Предыдущая"
        const prevDisabled = this.currentPage === 1 ? 'disabled' : '';
        pagination.append(`
            <li class="page-item ${prevDisabled}">
                <a class="page-link" href="#" onclick="catalogManager.goToPage(${this.currentPage - 1})">
                    <i class="fas fa-chevron-left"></i>
                </a>
            </li>
        `);

        // Номера страниц
        const startPage = Math.max(1, this.currentPage - 2);
        const endPage = Math.min(totalPages, this.currentPage + 2);

        for (let i = startPage; i <= endPage; i++) {
            const active = i === this.currentPage ? 'active' : '';
            pagination.append(`
                <li class="page-item ${active}">
                    <a class="page-link" href="#" onclick="catalogManager.goToPage(${i})">${i}</a>
                </li>
            `);
        }

        // Кнопка "Следующая"
        const nextDisabled = this.currentPage === totalPages ? 'disabled' : '';
        pagination.append(`
            <li class="page-item ${nextDisabled}">
                <a class="page-link" href="#" onclick="catalogManager.goToPage(${this.currentPage + 1})">
                    <i class="fas fa-chevron-right"></i>
                </a>
            </li>
        `);
    }

    // Переход на страницу
    goToPage(page) {
        this.currentPage = page;
        this.renderCatalog();
    }

    // Обновление статистики
    updateStatistics() {
        if (!this.filteredItems) {
            this.filteredItems = [];
        }

        const totalItems = this.filteredItems.length;
        const inStockItems = this.filteredItems.filter(item => item && item.quantity > 0).length;
        const lowStockItems = this.filteredItems.filter(item => item && item.quantity <= (item.minQuantity || 0)).length;
        const categories = [...new Set(this.filteredItems.filter(item => item && item.category).map(item => item.category))].length;

        $('#totalItemsCount').text(totalItems);
        $('#inStockCount').text(inStockItems);
        $('#lowStockCount').text(lowStockItems);
        $('#categoriesCount').text(categories);
    }

    // Получение информации о категории
    getCategoryInfo(categoryId) {
        if (!categoryId || categoryId === 'uncategorized') {
            return { id: 'uncategorized', name: 'Без категории', icon: 'fas fa-box' };
        }

        // Используем категории из warehouse
        const category = this.warehouse.categories.find(cat => cat.id === categoryId);
        if (category) {
            return {
                id: category.id,
                name: category.name,
                icon: category.icon || 'fas fa-box'
            };
        }
        
        return { id: 'unknown', name: 'Неизвестная категория', icon: 'fas fa-box' };
    }

    // Получение статуса запаса
    getStockStatus(item) {
        if (item.quantity === 0) {
            return { class: 'bg-danger', text: 'Нет в наличии' };
        } else if (item.quantity <= item.minQuantity) {
            return { class: 'bg-warning', text: 'Заканчивается' };
        } else {
            return { class: 'bg-success', text: 'В наличии' };
        }
    }

    // Просмотр позиции
    viewItem(itemId) {
        const item = this.currentItems.find(i => i.id === itemId);
        if (!item) return;

        // Здесь можно открыть модальное окно с подробной информацией
        auth.showNotification(`Просмотр позиции: ${item.name}`, 'info');
    }

    // Редактирование позиции
    async editItem(itemId) {
        const item = this.currentItems.find(i => i.id === itemId);
        if (!item) return;

        // Заполняем форму редактирования
        $('#editItemId').val(item.id);
        $('#editItemName').val(item.name);
        $('#editItemCategory').val(item.category);
        $('#editItemPrice').val(item.price);
        $('#editItemQuantity').val(item.quantity);
        $('#editItemDescription').val(item.description);
        $('#editItemBarcode').val(item.barcode);
        $('#editItemLocation').val(item.location);
        $('#editItemSupplier').val(item.supplier);
        $('#editItemMinQuantity').val(item.minQuantity);

        // Открываем модальное окно
        $('#editItemModal').modal('show');
    }

    // Обновление товара
    async updateItem() {
        const formData = this.getFormData('#editItemForm');
        
        if (!this.validateForm(formData)) {
            return;
        }

        try {
            const itemId = parseInt(formData.editItemId);
            const updateData = {
                name: formData.editItemName,
                category: formData.editItemCategory,
                price: parseFloat(formData.editItemPrice),
                quantity: parseInt(formData.editItemQuantity),
                description: formData.editItemDescription || '',
                barcode: formData.editItemBarcode || '',
                location: formData.editItemLocation || '',
                supplier: formData.editItemSupplier || '',
                minQuantity: parseInt(formData.editItemMinQuantity) || 0
            };

            await this.warehouse.updateItem(itemId, updateData);
            
            // Обновляем локальные данные
            const itemIndex = this.currentItems.findIndex(i => i.id === itemId);
            if (itemIndex !== -1) {
                this.currentItems[itemIndex] = { ...this.currentItems[itemIndex], ...updateData };
            }

            auth.showNotification('Позиция успешно обновлена', 'success');
            
            // Закрываем модальное окно и обновляем каталог
            $('#editItemModal').modal('hide');
            this.applyFilters();
            
        } catch (error) {
            console.error('Ошибка при обновлении позиции:', error);
            auth.showNotification('Ошибка при обновлении позиции', 'danger');
        }
    }

            // Добавление новой позиции
    async addNewItem() {
        const formData = this.getFormData('#addItemForm');
        
        if (!this.validateForm(formData)) {
            return;
        }

        try {
            const newItem = await this.warehouse.addItem(formData);
            
            // Добавляем в локальные данные
            this.currentItems.push(newItem);
            
            auth.showNotification('Позиция успешно добавлена', 'success');
            
            // Закрываем модальное окно и обновляем каталог
            $('#addItemModal').modal('hide');
            this.applyFilters();
            
            // Очищаем форму
            $('#addItemForm')[0].reset();
            
        } catch (error) {
            console.error('Ошибка при добавлении позиции:', error);
            auth.showNotification('Ошибка при добавлении позиции', 'danger');
        }
    }

    // Удаление позиции
    async deleteItem(itemId) {
        if (!confirm('Вы уверены, что хотите удалить эту позицию?')) {
            return;
        }

        try {
            await this.warehouse.deleteItem(itemId);
            
            // Удаляем из локальных данных
            this.currentItems = this.currentItems.filter(i => i.id !== itemId);
            
            auth.showNotification('Позиция успешно удалена', 'success');
            this.applyFilters();
            
        } catch (error) {
            console.error('Ошибка при удалении позиции:', error);
            auth.showNotification('Ошибка при удалении позиции', 'danger');
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
            'editItemName': 'Название товара',
            'editItemCategory': 'Категория',
            'editItemPrice': 'Цена',
            'editItemQuantity': 'Количество'
        };
        
        return labels[fieldName] || fieldName;
    }

    // Экспорт каталога
    async exportCatalog() {
        try {
            const exportData = await this.warehouse.exportData('items');
            
            // Создаем CSV
            let csv = exportData.headers.join(',') + '\n';
            exportData.rows.forEach(row => {
                csv += row.map(cell => `"${cell}"`).join(',') + '\n';
            });
            
            // Скачиваем файл
            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');
            const url = URL.createObjectURL(blob);
            link.setAttribute('href', url);
            link.setAttribute('download', `каталог_товаров_${new Date().toISOString().split('T')[0]}.csv`);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            auth.showNotification('Каталог успешно экспортирован', 'success');
            
        } catch (error) {
            console.error('Ошибка при экспорте:', error);
            auth.showNotification('Ошибка при экспорте каталога', 'danger');
        }
    }

    // Показать индикатор загрузки
    showLoading() {
        $('#catalogContainer').html(`
            <div class="col-12 text-center py-5">
                <div class="loading-spinner text-primary mb-3"></div>
                <p class="text-muted">Загрузка каталога...</p>
            </div>
        `);
    }

    // Скрыть индикатор загрузки
    hideLoading() {
        // Загрузка завершается в renderCatalog()
    }

    // Обновление информации о пользователе
    updateUserInfo() {
        const user = auth.getCurrentUser();
        console.log('Обновление информации о пользователе в каталоге:', user);
        
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
                console.log('Показана панель администратора в каталоге');
            } else {
                $('#adminDropdown').hide();
                console.log('Скрыта панель администратора в каталоге');
            }
        } else {
            console.log('Пользователь не авторизован в каталоге');
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

    // Обновление прав доступа
    updatePermissions() {
        // Используем централизованную систему управления правами из auth.js
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

    // Обработка параметра категории из URL
    handleCategoryFromUrl() {
        const urlParams = new URLSearchParams(window.location.search);
        const categoryParam = urlParams.get('category');
        
        if (categoryParam) {
            // Устанавливаем фильтр категории
            $('#categoryFilter').val(categoryParam);
            
            // Применяем фильтры
            this.applyFilters();
            
            // Показываем уведомление о примененном фильтре
            const categoryInfo = this.getCategoryInfo(categoryParam);
            auth.showNotification(`Отфильтровано по категории: ${categoryInfo.name}`, 'info');
        }
    }
}

// Инициализация менеджера каталога
const catalogManager = new CatalogManager(); 