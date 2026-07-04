// Логика страницы отчетов

(function() {
    // Проверка авторизации
    if (!auth.isUserAuthenticated()) {
        window.location.href = '../login.html';
        return;
    }

    const state = {
        filters: {
            dateFrom: '',
            dateTo: '',
            opType: '',
            categoryId: '',
            itemQuery: '',
            employeeQuery: ''
        },
        data: {
            summary: null,
            operations: [],
            byCategory: [],
            topItems: []
        }
    };

    // Инициализация
    $(document).ready(() => {
        bindEvents();
        loadCategoriesForFilter();
        applyFilters();
        loadCategoriesNav();
    });

    function bindEvents() {
        $('#filtersForm').on('submit', function(e) {
            e.preventDefault();
            state.filters = {
                dateFrom: $('#dateFrom').val(),
                dateTo: $('#dateTo').val(),
                opType: $('#opType').val(),
                categoryId: $('#categoryId').val(),
                itemQuery: $('#itemQuery').val(),
                employeeQuery: $('#employeeQuery').val()
            };
            applyFilters();
        });

        $('#exportCsvBtn').on('click', exportCsv);
        $('#exportJsonBtn').on('click', exportJson);
        $('#resetFiltersBtn').on('click', resetFilters);
    }

    async function applyFilters() {
        try {
            showLoading(true);
            const token = localStorage.getItem('token');
            const params = new URLSearchParams(state.filters);
            const headers = token ? { 'Authorization': `Bearer ${token}` } : {};

            // Загружаем сводные данные и таблицы
            const [summaryResp, opsResp, byCatResp, topItemsResp] = await Promise.all([
                fetch(`/api/reports/summary?${params.toString()}`, { headers }),
                fetch(`/api/reports/operations?${params.toString()}`, { headers }),
                fetch(`/api/reports/by-category?${params.toString()}`, { headers }),
                fetch(`/api/reports/top-items?${params.toString()}`, { headers })
            ]);

            if (!summaryResp.ok || !opsResp.ok || !byCatResp.ok || !topItemsResp.ok) {
                throw new Error('Ошибка загрузки данных отчетов');
            }

            state.data.summary = await summaryResp.json();
            state.data.operations = await opsResp.json();
            state.data.byCategory = await byCatResp.json();
            state.data.topItems = await topItemsResp.json();

            renderSummary();
            renderTables();
        } catch (e) {
            auth.showNotification('Ошибка при загрузке отчетов: ' + e.message, 'danger');
            // Очищаем таблицы при ошибке API
            state.data = { summary: null, operations: [], byCategory: [], topItems: [] };
            renderSummary();
            renderTables();
        } finally {
            showLoading(false);
        }
    }

    function resetFilters() {
        // Сбрасываем значения полей
        $('#dateFrom').val('');
        $('#dateTo').val('');
        $('#opType').val('');
        $('#categoryId').val('');
        $('#itemQuery').val('');
        $('#employeeQuery').val('');
        // Обнуляем состояние фильтров и перезагружаем
        state.filters = { dateFrom: '', dateTo: '', opType: '', categoryId: '', itemQuery: '', employeeQuery: '' };
        applyFilters();
    }

    function renderSummary() {
        const s = state.data.summary || { totalIncoming: 0, totalOutgoing: 0, totalOperations: 0, uniqueItems: 0 };
        $('#totalIncoming').text(s.totalIncoming);
        $('#totalOutgoing').text(s.totalOutgoing);
        $('#totalOps').text(s.totalOperations);
        $('#uniqueItems').text(s.uniqueItems);
    }

    function renderTables() {
        const opsBody = $('#operationsTable tbody');
        opsBody.empty();
        state.data.operations.forEach(op => {
            opsBody.append(`<tr>
                <td>${formatDate(op.date)}</td>
                <td>${op.type === 'incoming' ? 'Приход' : 'Расход'}</td>
                <td>${escapeHtml(op.itemName)}</td>
                <td>${op.quantity}</td>
                <td>${escapeHtml(op.employeeName || op.username || '')}</td>
                <td>${escapeHtml(op.categoryName || '')}</td>
            </tr>`);
        });

        const byCatBody = $('#byCategoryTable tbody');
        byCatBody.empty();
        state.data.byCategory.forEach(row => {
            byCatBody.append(`<tr>
                <td>${escapeHtml(row.categoryName)}</td>
                <td>${row.itemCount}</td>
                <td>${row.totalQuantity}</td>
            </tr>`);
        });

        const topItemsBody = $('#topItemsTable tbody');
        topItemsBody.empty();
        state.data.topItems.forEach(row => {
            topItemsBody.append(`<tr>
                <td>${escapeHtml(row.itemName)}</td>
                <td>${row.totalIncoming}</td>
                <td>${row.totalOutgoing}</td>
                <td>${row.totalIncoming - row.totalOutgoing}</td>
            </tr>`);
        });
    }

    function exportCsv() {
        const rows = [
            ['Дата','Тип','Товар','Количество','Сотрудник','Категория'],
            ...state.data.operations.map(o => [formatDate(o.date), o.type, o.itemName, o.quantity, o.employeeName || '', o.categoryName || ''])
        ];
        const csv = rows.map(r => r.map(v => `"${String(v).replaceAll('"','""')}"`).join(',')).join('\n');
        downloadFile('operations.csv', 'text/csv;charset=utf-8;', csv);
    }

    function exportJson() {
        const blob = new Blob([JSON.stringify(state.data, null, 2)], { type: 'application/json;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'reports.json';
        a.click();
        URL.revokeObjectURL(url);
    }

    async function loadCategoriesForFilter() {
        try {
            const resp = await fetch('/api/categories');
            const cats = await resp.json();
            const select = $('#categoryId');
            cats.forEach(c => select.append(`<option value="${c.id}">${escapeHtml(c.name)}</option>`));
        } catch {}
    }

    function loadCategoriesNav() {
        // На странице отчётов категории в меню не критичны; пропустим загрузку, чтобы не блокировать UI
    }

    function showLoading(show) {
        $('#loadingState').toggle(!!show);
    }



    function formatDate(iso) {
        const d = new Date(iso);
        return d.toLocaleString('ru-RU');
    }

    function escapeHtml(s) {
        return String(s || '').replace(/[&<>"]+/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
    }
})();
