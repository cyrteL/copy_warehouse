// JavaScript для страницы поиска

class SearchManager {
    constructor() {
        this.warehouse = new WarehouseManager();
        this.searchResults = {
            items: [],
            operations: []
        };
        this.currentPage = 1;
        this.resultsPerPage = 12;
        this.currentQuery = '';
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

                console.log('Инициализация поиска для пользователя:', auth.getCurrentUser()?.name);

                // Загружаем категории
                await this.loadCategories();
                
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
                
            } catch (error) {
                console.error('Ошибка инициализации:', error);
                auth.showNotification('Ошибка загрузки данных', 'danger');
            }
        });
    }

    bindEvents() {
        // Поиск
        $('#searchBtn').on('click', () => this.performSearch());
        $('#searchQuery').on('keypress', (e) => {
            if (e.which === 13) {
                this.performSearch();
            }
        });

        // Расширенные фильтры
        $('#toggleAdvancedFilters').on('click', () => this.toggleAdvancedFilters());
        $('#clearFiltersBtn').on('click', () => this.clearFilters());

        // Сортировка и экспорт
        $('#sortResults').on('change', () => this.applySorting());
        $('#exportResultsBtn').on('click', () => this.exportResults());

        // Переключение вкладок
        $('#resultsTabs a').on('click', (e) => {
            e.preventDefault();
            $(e.target).tab('show');
        });

        // Обработчик выхода
        $('#logoutBtn').on('click', (e) => {
            e.preventDefault();
            auth.logout();
            window.location.href = 'login.html';
        });
    }

    // Загрузка категорий для фильтра
    async loadCategories() {
        try {
            const categories = await this.warehouse.getCategories();
            const categoryFilter = $('#categoryFilter');
            
            categories.forEach(category => {
                const option = `<option value="${category.id}">${category.name}</option>`;
                categoryFilter.append(option);
            });
        } catch (error) {
            console.error('Ошибка при загрузке категорий:', error);
        }
    }

    // Инициализация фильтров
    initializeFilters() {
        this.filters = {
            searchType: 'all',
            category: '',
            minPrice: null,
            maxPrice: null,
            startDate: '',
            endDate: ''
        };
    }

    // Выполнение поиска
    async performSearch() {
        const query = $('#searchQuery').val().trim();
        const searchType = $('#searchType').val();

        if (!query) {
            auth.showNotification('Введите поисковый запрос', 'warning');
            return;
        }

        this.currentQuery = query;
        this.filters.searchType = searchType;
        this.collectFilters();

        this.showLoading();
        
        try {
            await this.searchItems(query);
            await this.searchOperations(query);
            
            this.displayResults();
            this.hideLoading();
            
        } catch (error) {
            console.error('Ошибка при поиске:', error);
            auth.showNotification('Ошибка при выполнении поиска', 'danger');
            this.hideLoading();
        }
    }

    // Сбор фильтров
    collectFilters() {
        this.filters.category = $('#categoryFilter').val();
        this.filters.minPrice = $('#minPrice').val() ? parseFloat($('#minPrice').val()) : null;
        this.filters.maxPrice = $('#maxPrice').val() ? parseFloat($('#maxPrice').val()) : null;
        this.filters.startDate = $('#startDate').val();
        this.filters.endDate = $('#endDate').val();
    }

            // Поиск позиций
    async searchItems(query) {
        if (this.filters.searchType === 'operations') {
            this.searchResults.items = [];
            return;
        }

        const searchFilters = {
            category: this.filters.category,
            minPrice: this.filters.minPrice,
            maxPrice: this.filters.maxPrice
        };

        this.searchResults.items = await this.warehouse.searchItems(query, searchFilters);
    }

    // Поиск операций
    async searchOperations(query) {
        if (this.filters.searchType === 'items') {
            this.searchResults.operations = [];
            return;
        }

        const operations = await this.warehouse.getOperations();
        
        // Фильтруем операции по запросу
        this.searchResults.operations = operations.filter(operation => {
            const searchText = query.toLowerCase();
            return (
                operation.itemName.toLowerCase().includes(searchText) ||
                operation.employeeName.toLowerCase().includes(searchText) ||
                operation.notes.toLowerCase().includes(searchText) ||
                operation.supplier.toLowerCase().includes(searchText) ||
                operation.recipient.toLowerCase().includes(searchText)
            );
        });

        // Применяем фильтры по дате
        if (this.filters.startDate) {
            this.searchResults.operations = this.searchResults.operations.filter(op => 
                new Date(op.date) >= new Date(this.filters.startDate)
            );
        }

        if (this.filters.endDate) {
            this.searchResults.operations = this.searchResults.operations.filter(op => 
                new Date(op.date) <= new Date(this.filters.endDate)
            );
        }
    }

    // Отображение результатов
    displayResults() {
        const totalResults = this.searchResults.items.length + this.searchResults.operations.length;
        
        if (totalResults === 0) {
            this.showNoResults();
            return;
        }

        this.showResults();
        this.updateResultsCount();
        this.renderItemsResults();
        this.renderOperationsResults();
        this.renderPagination();
    }

    // Показать результаты
    showResults() {
        $('#emptyState').hide();
        $('#loadingState').hide();
        $('#searchResults').show();
    }

    // Показать отсутствие результатов
    showNoResults() {
        $('#emptyState').hide();
        $('#loadingState').hide();
        $('#searchResults').hide();
        
        $('#emptyState').html(`
            <i class="fas fa-search fa-3x text-muted mb-3"></i>
            <h4>Результаты не найдены</h4>
            <p class="text-muted">По запросу "${this.currentQuery}" ничего не найдено. Попробуйте изменить поисковый запрос или фильтры.</p>
        `).show();
    }

    // Обновление счетчиков результатов
    updateResultsCount() {
        const totalResults = this.searchResults.items.length + this.searchResults.operations.length;
        $('#resultsCount').text(`Найдено результатов: ${totalResults}`);
        $('#itemsCount').text(this.searchResults.items.length);
        $('#operationsCount').text(this.searchResults.operations.length);
    }

    // Рендеринг результатов товаров
    renderItemsResults() {
        const container = $('#itemsResultsContainer');
        container.empty();

        if (this.searchResults.items.length === 0) {
            container.html(`
                <div class="col-12">
                    <div class="empty-state">
                        <i class="fas fa-box-open"></i>
                        <h5>Позиции не найдены</h5>
                        <p>Попробуйте изменить поисковый запрос</p>
                    </div>
                </div>
            `);
            return;
        }

        // Пагинация для позиций
        const totalPages = Math.ceil(this.searchResults.items.length / this.resultsPerPage);
        const startIndex = (this.currentPage - 1) * this.resultsPerPage;
        const endIndex = startIndex + this.resultsPerPage;
        const pageItems = this.searchResults.items.slice(startIndex, endIndex);

        pageItems.forEach(item => {
            const itemHtml = this.createItemCard(item);
            container.append(itemHtml);
        });
    }

            // Создание карточки позиции
    createItemCard(item) {
        const category = this.getCategoryInfo(item.category);
        const stockStatus = this.getStockStatus(item);
        
        return `
            <div class="col-lg-4 col-md-6 mb-4">
                <div class="card product-card h-100">
                    <div class="product-image">
                        <i class="${category.icon} fa-3x"></i>
                    </div>
                    <div class="card-body">
                        <h6 class="card-title">${this.highlightQuery(item.name)}</h6>
                        <p class="card-text text-muted small">${this.highlightQuery(item.description.substring(0, 80))}${item.description.length > 80 ? '...' : ''}</p>
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
                        <div class="d-grid">
                            <button class="btn btn-outline-primary btn-sm" onclick="searchManager.viewItemDetails(${item.id})">
                                <i class="fas fa-eye me-1"></i>Просмотр
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    // Рендеринг результатов операций
    renderOperationsResults() {
        const tbody = $('#operationsResultsTable tbody');
        tbody.empty();

        if (this.searchResults.operations.length === 0) {
            tbody.html(`
                <tr>
                    <td colspan="6" class="text-center text-muted py-4">
                        <i class="fas fa-history fa-2x mb-3"></i>
                        <br>Операции не найдены
                    </td>
                </tr>
            `);
            return;
        }

        // Пагинация для операций
        const totalPages = Math.ceil(this.searchResults.operations.length / this.resultsPerPage);
        const startIndex = (this.currentPage - 1) * this.resultsPerPage;
        const endIndex = startIndex + this.resultsPerPage;
        const pageOperations = this.searchResults.operations.slice(startIndex, endIndex);

        pageOperations.forEach(operation => {
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
                <td>${this.highlightQuery(operation.itemName)}</td>
                <td>${operation.quantity}</td>
                <td>${this.highlightQuery(operation.employeeName)}</td>
                <td>
                    <span class="status-badge ${statusClass}">${statusText}</span>
                </td>
            </tr>
        `;
    }

    // Подсветка поискового запроса
    highlightQuery(text) {
        if (!this.currentQuery) return text;
        
        const regex = new RegExp(`(${this.escapeRegex(this.currentQuery)})`, 'gi');
        return text.replace(regex, '<mark>$1</mark>');
    }

    // Экранирование специальных символов для regex
    escapeRegex(string) {
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    // Рендеринг пагинации
    renderPagination() {
        const pagination = $('#resultsPagination');
        pagination.empty();

        const totalResults = this.searchResults.items.length + this.searchResults.operations.length;
        const totalPages = Math.ceil(totalResults / this.resultsPerPage);

        if (totalPages <= 1) return;

        // Кнопка "Предыдущая"
        const prevDisabled = this.currentPage === 1 ? 'disabled' : '';
        pagination.append(`
            <li class="page-item ${prevDisabled}">
                <a class="page-link" href="#" onclick="searchManager.goToPage(${this.currentPage - 1})">
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
                    <a class="page-link" href="#" onclick="searchManager.goToPage(${i})">${i}</a>
                </li>
            `);
        }

        // Кнопка "Следующая"
        const nextDisabled = this.currentPage === totalPages ? 'disabled' : '';
        pagination.append(`
            <li class="page-item ${nextDisabled}">
                <a class="page-link" href="#" onclick="searchManager.goToPage(${this.currentPage + 1})">
                    <i class="fas fa-chevron-right"></i>
                </a>
            </li>
        `);
    }

    // Переход на страницу
    goToPage(page) {
        this.currentPage = page;
        this.renderItemsResults();
        this.renderOperationsResults();
        this.renderPagination();
    }

    // Применение сортировки
    applySorting() {
        const sortBy = $('#sortResults').val();
        
        if (sortBy === 'relevance') {
            // Сортировка по релевантности (по умолчанию)
            return;
        }

        // Сортировка позиций
        this.searchResults.items.sort((a, b) => {
            let aValue = a[sortBy];
            let bValue = b[sortBy];

            if (sortBy === 'date') {
                aValue = new Date(aValue);
                bValue = new Date(bValue);
            }

            return aValue > bValue ? 1 : -1;
        });

        // Сортировка операций
        this.searchResults.operations.sort((a, b) => {
            let aValue = a[sortBy];
            let bValue = b[sortBy];

            if (sortBy === 'date') {
                aValue = new Date(aValue);
                bValue = new Date(bValue);
            }

            return aValue > bValue ? 1 : -1;
        });

        this.currentPage = 1;
        this.renderItemsResults();
        this.renderOperationsResults();
        this.renderPagination();
    }

    // Переключение расширенных фильтров
    toggleAdvancedFilters() {
        const advancedFilters = $('#advancedFilters');
        const toggleBtn = $('#toggleAdvancedFilters');
        
        if (advancedFilters.is(':visible')) {
            advancedFilters.slideUp();
            toggleBtn.html('<i class="fas fa-filter me-1"></i>Расширенные фильтры');
        } else {
            advancedFilters.slideDown();
            toggleBtn.html('<i class="fas fa-times me-1"></i>Скрыть фильтры');
        }
    }

    // Очистка фильтров
    clearFilters() {
        $('#categoryFilter').val('');
        $('#minPrice').val('');
        $('#maxPrice').val('');
        $('#startDate').val('');
        $('#endDate').val('');
        
        this.initializeFilters();
    }

    // Экспорт результатов
    async exportResults() {
        try {
            const totalResults = this.searchResults.items.length + this.searchResults.operations.length;
            
            if (totalResults === 0) {
                auth.showNotification('Нет результатов для экспорта', 'warning');
                return;
            }

            let csv = 'Результаты поиска\n';
            csv += `Запрос: ${this.currentQuery}\n`;
            csv += `Дата поиска: ${new Date().toLocaleDateString('ru-RU')}\n\n`;

            // Экспорт позиций
            if (this.searchResults.items.length > 0) {
                csv += 'ТОВАРЫ\n';
                csv += 'ID,Название,Категория,Цена,Количество,Описание\n';
                this.searchResults.items.forEach(item => {
                    csv += `${item.id},"${item.name}","${this.getCategoryInfo(item.category).name}",${item.price},${item.quantity},"${item.description}"\n`;
                });
                csv += '\n';
            }

            // Экспорт операций
            if (this.searchResults.operations.length > 0) {
                csv += 'ОПЕРАЦИИ\n';
                csv += 'Дата,Тип,Товар,Количество,Сотрудник,Статус\n';
                this.searchResults.operations.forEach(op => {
                    csv += `${this.formatDate(op.date)},"${op.type === 'incoming' ? 'Приход' : 'Расход'}","${op.itemName}",${op.quantity},"${op.employeeName}","${this.getStatusText(op.status)}"\n`;
                });
            }

            // Скачиваем файл
            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');
            const url = URL.createObjectURL(blob);
            link.setAttribute('href', url);
            link.setAttribute('download', `поиск_${this.currentQuery}_${new Date().toISOString().split('T')[0]}.csv`);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            auth.showNotification('Результаты поиска экспортированы', 'success');
            
        } catch (error) {
            console.error('Ошибка при экспорте:', error);
            auth.showNotification('Ошибка при экспорте результатов', 'danger');
        }
    }

            // Просмотр деталей позиции
    async viewItemDetails(itemId) {
        try {
            const item = await this.warehouse.getItemById(itemId);
            if (!item) return;

            const category = this.getCategoryInfo(item.category);
            const stockStatus = this.getStockStatus(item);

            const detailsHtml = `
                <div class="row">
                    <div class="col-md-6">
                        <h6>Основная информация</h6>
                        <table class="table table-sm">
                            <tr>
                                <td><strong>ID:</strong></td>
                                <td>${item.id}</td>
                            </tr>
                            <tr>
                                <td><strong>Название:</strong></td>
                                <td>${item.name}</td>
                            </tr>
                            <tr>
                                <td><strong>Категория:</strong></td>
                                <td>${category.name}</td>
                            </tr>
                            <tr>
                                <td><strong>Цена:</strong></td>
                                <td>${item.price.toLocaleString()} ₽</td>
                            </tr>
                        </table>
                    </div>
                    <div class="col-md-6">
                        <h6>Складская информация</h6>
                        <table class="table table-sm">
                            <tr>
                                <td><strong>Количество:</strong></td>
                                <td>${item.quantity} шт.</td>
                            </tr>
                            <tr>
                                <td><strong>Статус:</strong></td>
                                <td><span class="badge ${stockStatus.class}">${stockStatus.text}</span></td>
                            </tr>
                            <tr>
                                <td><strong>Местоположение:</strong></td>
                                <td>${item.location}</td>
                            </tr>
                            <tr>
                                <td><strong>Поставщик:</strong></td>
                                <td>${item.supplier || 'Не указан'}</td>
                            </tr>
                        </table>
                    </div>
                </div>
                <div class="row mt-3">
                    <div class="col-12">
                        <h6>Описание</h6>
                        <p>${item.description || 'Описание отсутствует'}</p>
                    </div>
                </div>
                ${item.barcode ? `
                    <div class="row mt-3">
                        <div class="col-12">
                            <h6>Штрих-код</h6>
                            <p class="font-monospace">${item.barcode}</p>
                        </div>
                    </div>
                ` : ''}
            `;

            $('#itemDetailsContent').html(detailsHtml);
            $('#itemDetailsModal').modal('show');
            
        } catch (error) {
            console.error('Ошибка при загрузке деталей позиции:', error);
            auth.showNotification('Ошибка при загрузке деталей позиции', 'danger');
        }
    }

    // Получение информации о категории
    getCategoryInfo(categoryId) {
        const categories = [
            { id: 'electronics', name: 'Электроника', icon: 'fas fa-laptop' },
            { id: 'clothing', name: 'Одежда', icon: 'fas fa-tshirt' },
            { id: 'tools', name: 'Инструменты', icon: 'fas fa-tools' },
            { id: 'office', name: 'Офисные принадлежности', icon: 'fas fa-briefcase' },
            { id: 'furniture', name: 'Мебель', icon: 'fas fa-couch' },
            { id: 'books', name: 'Книги', icon: 'fas fa-book' }
        ];
        
        return categories.find(cat => cat.id === categoryId) || 
               { id: 'unknown', name: 'Неизвестная категория', icon: 'fas fa-box' };
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

    // Показать индикатор загрузки
    showLoading() {
        $('#emptyState').hide();
        $('#searchResults').hide();
        $('#loadingState').show();
    }

    // Скрыть индикатор загрузки
    hideLoading() {
        $('#loadingState').hide();
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

// Инициализация менеджера поиска
const searchManager = new SearchManager(); 