// JavaScript для страницы истории операций

class HistoryManager {
    constructor() {
        this.warehouse = new WarehouseManager();
        this.operations = [];
        this.filteredOperations = [];
        this.currentPage = 1;
        this.operationsPerPage = 20;
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

                console.log('Инициализация истории для пользователя:', auth.getCurrentUser()?.name);

                // Загружаем историю операций
                await this.loadHistory();
                
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
        // Фильтры
        $('#applyFiltersBtn').on('click', () => this.applyFilters());
        $('#clearFiltersBtn').on('click', () => this.clearFilters());
        
        // Сортировка
        $('#sortBy, #sortOrder').on('change', () => this.applySorting());
        
        // Экспорт и отчеты
        $('#exportBtn').on('click', () => this.exportOperations());
        $('#generateReportBtn').on('click', () => this.generateReport());
        
        // Обработчик выхода
        $('#logoutBtn').on('click', (e) => {
            e.preventDefault();
            auth.logout();
            window.location.href = 'login.html';
        });
        
        // Установка дат по умолчанию
        this.setDefaultDates();
    }

    // Загрузка истории операций
    async loadHistory() {
        try {
            this.showLoading();
            
            // Загружаем операции
            this.operations = await this.warehouse.getOperations();
            
            // Загружаем позиции для фильтра
            const items = await this.warehouse.getAllItems();
            this.populateItemFilter(items);
            
            // Загружаем сотрудников для фильтра
            this.populateEmployeeFilter();
            
            // Применяем фильтры и рендерим
            this.applyFilters();
            this.updateStatistics();
            
            this.hideLoading();
            
        } catch (error) {
            console.error('Ошибка при загрузке истории:', error);
            auth.showNotification('Ошибка при загрузке истории операций', 'danger');
            this.hideLoading();
        }
    }

    // Инициализация фильтров
    initializeFilters() {
        this.filters = {
            type: '',
            startDate: '',
            endDate: '',
            itemId: '',
            employeeId: '',
            status: ''
        };
    }

    // Установка дат по умолчанию
    setDefaultDates() {
        const today = new Date();
        const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, today.getDate());
        
        $('#startDate').val(lastMonth.toISOString().split('T')[0]);
        $('#endDate').val(today.toISOString().split('T')[0]);
        
        // Устанавливаем даты для отчета
        $('#reportStartDate').val(lastMonth.toISOString().split('T')[0]);
        $('#reportEndDate').val(today.toISOString().split('T')[0]);
    }

            // Заполнение фильтра позиций
    populateItemFilter(items) {
        const itemFilter = $('#itemFilter');
        const reportItem = $('#reportItem');
        
        items.forEach(item => {
            const option = `<option value="${item.id}">${item.name}</option>`;
            itemFilter.append(option);
            reportItem.append(option);
        });
    }

    // Заполнение фильтра сотрудников
    populateEmployeeFilter() {
        const employeeFilter = $('#employeeFilter');
        const employees = auth.getUsers();
        
        employees.forEach(employee => {
            const option = `<option value="${employee.id}">${employee.name}</option>`;
            employeeFilter.append(option);
        });
    }

    // Применение фильтров
    applyFilters() {
        // Собираем значения фильтров
        this.filters.type = $('#operationType').val();
        this.filters.startDate = $('#startDate').val();
        this.filters.endDate = $('#endDate').val();
        this.filters.itemId = $('#itemFilter').val();
        this.filters.employeeId = $('#employeeFilter').val();
        this.filters.status = $('#statusFilter').val();

        // Фильтруем операции
        this.filteredOperations = this.operations.filter(operation => {
            // Фильтр по типу
            if (this.filters.type && operation.type !== this.filters.type) {
                return false;
            }

            // Фильтр по дате
            if (this.filters.startDate) {
                const operationDate = new Date(operation.date);
                const startDate = new Date(this.filters.startDate);
                if (operationDate < startDate) {
                    return false;
                }
            }

            if (this.filters.endDate) {
                const operationDate = new Date(operation.date);
                const endDate = new Date(this.filters.endDate);
                endDate.setHours(23, 59, 59); // Конец дня
                if (operationDate > endDate) {
                    return false;
                }
            }

            // Фильтр по позиции
            if (this.filters.itemId && operation.itemId !== parseInt(this.filters.itemId)) {
                return false;
            }

            // Фильтр по сотруднику
            if (this.filters.employeeId && operation.employeeId !== parseInt(this.filters.employeeId)) {
                return false;
            }

            // Фильтр по статусу
            if (this.filters.status && operation.status !== this.filters.status) {
                return false;
            }

            return true;
        });

        this.currentPage = 1;
        this.applySorting();
        this.renderOperations();
        this.updateStatistics();
    }

    // Применение сортировки
    applySorting() {
        const sortBy = $('#sortBy').val();
        const sortOrder = $('#sortOrder').val();

        this.filteredOperations.sort((a, b) => {
            let aValue = a[sortBy];
            let bValue = b[sortBy];

            // Специальная обработка для дат
            if (sortBy === 'date') {
                aValue = new Date(aValue);
                bValue = new Date(bValue);
            }

            // Специальная обработка для количества
            if (sortBy === 'quantity') {
                aValue = parseInt(aValue);
                bValue = parseInt(bValue);
            }

            if (sortOrder === 'asc') {
                return aValue > bValue ? 1 : -1;
            } else {
                return aValue < bValue ? 1 : -1;
            }
        });

        this.renderOperations();
    }

    // Очистка фильтров
    clearFilters() {
        $('#operationType').val('');
        $('#startDate').val('');
        $('#endDate').val('');
        $('#itemFilter').val('');
        $('#employeeFilter').val('');
        $('#statusFilter').val('');
        
        this.initializeFilters();
        this.applyFilters();
    }

    // Рендеринг операций
    renderOperations() {
        const tbody = $('#operationsTable tbody');
        tbody.empty();

        if (this.filteredOperations.length === 0) {
            tbody.html(`
                <tr>
                    <td colspan="7" class="text-center text-muted py-4">
                        <i class="fas fa-search fa-2x mb-3"></i>
                        <br>Операции не найдены
                    </td>
                </tr>
            `);
            return;
        }

        // Пагинация
        const totalPages = Math.ceil(this.filteredOperations.length / this.operationsPerPage);
        const startIndex = (this.currentPage - 1) * this.operationsPerPage;
        const endIndex = startIndex + this.operationsPerPage;
        const pageOperations = this.filteredOperations.slice(startIndex, endIndex);

        // Рендерим операции
        pageOperations.forEach(operation => {
            const row = this.createOperationRow(operation);
            tbody.append(row);
        });

        // Рендерим пагинацию
        this.renderPagination(totalPages);
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
                <td>
                    <button class="btn btn-outline-primary btn-sm" onclick="historyManager.viewOperationDetails(${operation.id})">
                        <i class="fas fa-eye"></i>
                    </button>
                </td>
            </tr>
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
                <a class="page-link" href="#" onclick="historyManager.goToPage(${this.currentPage - 1})">
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
                    <a class="page-link" href="#" onclick="historyManager.goToPage(${i})">${i}</a>
                </li>
            `);
        }

        // Кнопка "Следующая"
        const nextDisabled = this.currentPage === totalPages ? 'disabled' : '';
        pagination.append(`
            <li class="page-item ${nextDisabled}">
                <a class="page-link" href="#" onclick="historyManager.goToPage(${this.currentPage + 1})">
                    <i class="fas fa-chevron-right"></i>
                </a>
            </li>
        `);
    }

    // Переход на страницу
    goToPage(page) {
        this.currentPage = page;
        this.renderOperations();
    }

    // Обновление статистики
    updateStatistics() {
        const totalOperations = this.filteredOperations.length;
        const incomingOperations = this.filteredOperations.filter(op => op.type === 'incoming').length;
        const outgoingOperations = this.filteredOperations.filter(op => op.type === 'outgoing').length;
        const totalQuantity = this.filteredOperations.reduce((sum, op) => sum + op.quantity, 0);

        $('#totalOperations').text(totalOperations);
        $('#incomingOperations').text(incomingOperations);
        $('#outgoingOperations').text(outgoingOperations);
        $('#totalQuantity').text(totalQuantity);
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

    // Просмотр деталей операции
    viewOperationDetails(operationId) {
        const operation = this.operations.find(op => op.id === operationId);
        if (!operation) return;

        const typeText = operation.type === 'incoming' ? 'Приход' : 'Расход';
        const statusText = this.getStatusText(operation.status);
        const statusClass = this.getStatusClass(operation.status);

        const detailsHtml = `
            <div class="row">
                <div class="col-md-6">
                    <h6>Основная информация</h6>
                    <table class="table table-sm">
                        <tr>
                            <td><strong>ID операции:</strong></td>
                            <td>${operation.id}</td>
                        </tr>
                        <tr>
                            <td><strong>Тип:</strong></td>
                            <td>
                                <i class="fas ${operation.type === 'incoming' ? 'fa-box-open text-success' : 'fa-truck text-warning'} me-1"></i>
                                ${typeText}
                            </td>
                        </tr>
                        <tr>
                            <td><strong>Дата:</strong></td>
                            <td>${this.formatDate(operation.date)}</td>
                        </tr>
                        <tr>
                            <td><strong>Статус:</strong></td>
                            <td><span class="status-badge ${statusClass}">${statusText}</span></td>
                        </tr>
                    </table>
                </div>
                <div class="col-md-6">
                                            <h6>Детали позиции</h6>
                    <table class="table table-sm">
                        <tr>
                                                          <td><strong>Позиция:</strong></td>
                            <td>${operation.itemName}</td>
                        </tr>
                        <tr>
                            <td><strong>Количество:</strong></td>
                            <td>${operation.quantity} шт.</td>
                        </tr>
                        <tr>
                            <td><strong>Сотрудник:</strong></td>
                            <td>${operation.employeeName}</td>
                        </tr>
                    </table>
                </div>
            </div>
            ${operation.supplier ? `
                <div class="row mt-3">
                    <div class="col-12">
                        <h6>Дополнительная информация</h6>
                        <table class="table table-sm">
                            ${operation.supplier ? `<tr><td><strong>Поставщик:</strong></td><td>${operation.supplier}</td></tr>` : ''}
                            ${operation.recipient ? `<tr><td><strong>Получатель:</strong></td><td>${operation.recipient}</td></tr>` : ''}
                            ${operation.notes ? `<tr><td><strong>Примечания:</strong></td><td>${operation.notes}</td></tr>` : ''}
                        </table>
                    </div>
                </div>
            ` : ''}
        `;

        $('#operationDetailsContent').html(detailsHtml);
        $('#operationDetailsModal').modal('show');
    }

    // Экспорт операций
    async exportOperations() {
        try {
            const exportData = await this.warehouse.exportData('operations');
            
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
            link.setAttribute('download', `операции_${new Date().toISOString().split('T')[0]}.csv`);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            auth.showNotification('Операции успешно экспортированы', 'success');
            
        } catch (error) {
            console.error('Ошибка при экспорте:', error);
            auth.showNotification('Ошибка при экспорте операций', 'danger');
        }
    }

    // Создание отчета
    async generateReport() {
        const startDate = $('#reportStartDate').val();
        const endDate = $('#reportEndDate').val();
        const reportType = $('#reportType').val();
        const reportItem = $('#reportItem').val();
        const reportFormat = $('input[name="reportFormat"]:checked').val();

        if (!startDate || !endDate) {
            auth.showNotification('Пожалуйста, укажите период для отчета', 'warning');
            return;
        }

        try {
            let reportData;
            
            switch (reportType) {
                case 'movement':
                    reportData = await this.warehouse.getMovementReport(startDate, endDate, reportItem || null);
                    break;
                case 'detailed':
                    reportData = await this.warehouse.getOperations({
                        startDate,
                        endDate,
                        itemId: reportItem || null
                    });
                    break;
                default:
                    reportData = await this.warehouse.getStatistics();
            }

            if (reportFormat === 'csv') {
                this.downloadCsvReport(reportData, reportType);
            } else {
                this.downloadPdfReport(reportData, reportType);
            }

            auth.showNotification('Отчет успешно создан', 'success');
            $('#reportModal').modal('hide');
            
        } catch (error) {
            console.error('Ошибка при создании отчета:', error);
            auth.showNotification('Ошибка при создании отчета', 'danger');
        }
    }

    // Скачивание CSV отчета
    downloadCsvReport(reportData, reportType) {
        let csv = '';
        let filename = '';

        switch (reportType) {
            case 'movement':
                csv = this.generateMovementCsv(reportData);
                filename = `отчет_движения_${new Date().toISOString().split('T')[0]}.csv`;
                break;
            case 'detailed':
                csv = this.generateDetailedCsv(reportData);
                filename = `детальный_отчет_${new Date().toISOString().split('T')[0]}.csv`;
                break;
            default:
                csv = this.generateSummaryCsv(reportData);
                filename = `сводный_отчет_${new Date().toISOString().split('T')[0]}.csv`;
        }

        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', filename);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    // Скачивание PDF отчета (заглушка)
    downloadPdfReport(reportData, reportType) {
        // В реальном приложении здесь была бы генерация PDF
        auth.showNotification('Функция PDF отчета находится в разработке', 'info');
    }

    // Генерация CSV для отчета движения
    generateMovementCsv(reportData) {
        let csv = 'Отчет по движению товаров\n';
        csv += `Период: ${reportData.period.startDate} - ${reportData.period.endDate}\n\n`;
        csv += 'Показатель,Значение\n';
        csv += `Всего приходов,${reportData.totalIncoming}\n`;
        csv += `Всего расходов,${reportData.totalOutgoing}\n`;
        csv += `Количество прихода,${reportData.totalIncomingQuantity}\n`;
        csv += `Количество расхода,${reportData.totalOutgoingQuantity}\n\n`;
        
        csv += 'Детали операций\n';
        csv += 'Дата,Тип,Товар,Количество,Сотрудник\n';
        
        reportData.operations.forEach(op => {
            csv += `${this.formatDate(op.date)},${op.type === 'incoming' ? 'Приход' : 'Расход'},${op.itemName},${op.quantity},${op.employeeName}\n`;
        });

        return csv;
    }

    // Генерация CSV для детального отчета
    generateDetailedCsv(reportData) {
        let csv = 'Детальный отчет по операциям\n\n';
        csv += 'Дата,Тип,Товар,Количество,Сотрудник,Статус,Примечания\n';
        
        reportData.forEach(op => {
            csv += `${this.formatDate(op.date)},${op.type === 'incoming' ? 'Приход' : 'Расход'},${op.itemName},${op.quantity},${op.employeeName},${this.getStatusText(op.status)},${op.notes || ''}\n`;
        });

        return csv;
    }

    // Генерация CSV для сводного отчета
    generateSummaryCsv(reportData) {
        let csv = 'Сводный отчет по складу\n\n';
        csv += 'Показатель,Значение\n';
        csv += `Всего товаров,${reportData.totalItems}\n`;
        csv += `Общая стоимость,${reportData.totalValue} ₽\n`;
        csv += `Товары с низким запасом,${reportData.lowStockItems}\n`;
        csv += `Операций сегодня,${reportData.todayOperations}\n`;
        csv += `Всего категорий,${reportData.totalCategories}\n`;
        csv += `Всего операций,${reportData.totalOperations}\n`;

        return csv;
    }

    // Показать индикатор загрузки
    showLoading() {
        $('#operationsTable tbody').html(`
            <tr>
                <td colspan="7" class="text-center py-5">
                    <div class="loading-spinner text-primary mb-3"></div>
                    <p class="text-muted">Загрузка истории операций...</p>
                </td>
            </tr>
        `);
    }

    // Скрыть индикатор загрузки
    hideLoading() {
        // Загрузка завершается в renderOperations()
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

// Инициализация менеджера истории
const historyManager = new HistoryManager(); 