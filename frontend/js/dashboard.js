// dashboard.js - Handle dashboard data display
class Dashboard {
    constructor() {
        this.API_BASE = '/api';
        this.init();
    }

    init() {
        this.loadDashboardData();
        this.bindEvents();
        
        // Auto-refresh every 30 seconds
        setInterval(() => {
            this.loadDashboardData();
        }, 30000);
    }

    bindEvents() {
        const refreshBtn = document.getElementById('refreshDashboard');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => {
                document.getElementById('refreshText').textContent = 'Refreshing...';
                this.loadDashboardData();
            });
        }
    }

    async loadDashboardData() {
        try {
            const response = await fetch(`${this.API_BASE}/dashboard`);
            const result = await response.json();

            if (result.success) {
                this.updateStats(result.stats);
                this.updateTable(result.active_needs, result.fulfilled_needs);
                this.updateTimestamp();
            }
        } catch (error) {
            console.error('Error loading dashboard data:', error);
        }
    }

    updateStats(stats) {
        document.getElementById('activeNeedsCount').textContent = stats.active_needs_count;
        document.getElementById('fulfilledCount').textContent = stats.fulfilled_needs_count;
        document.getElementById('totalDonations').textContent = stats.total_donations;
        document.getElementById('criticalCount').textContent = stats.critical_needs_count;
    }

    updateTable(activeNeeds, fulfilledNeeds) {
        const allNeeds = [...activeNeeds, ...fulfilledNeeds];
        const tbody = document.getElementById('tableBody');
        const emptyState = document.getElementById('tableEmpty');

        if (allNeeds.length === 0) {
            tbody.innerHTML = '';
            emptyState?.classList.remove('hidden');
            return;
        }

        emptyState?.classList.add('hidden');

        tbody.innerHTML = allNeeds.map(need => `
            <tr class="${need.status === 'fulfilled' ? 'fulfilled-row' : 'active-row'}">
                <td>${need.item_name}</td>
                <td>${need.required_quantity}</td>
                <td>${need.donated_quantity}</td>
                <td>${need.remaining_quantity}</td>
                <td>
                    <div class="table-progress">
                        <div class="table-progress-bar">
                            <div class="table-progress-fill" style="width: ${need.progress_percentage || 0}%"></div>
                        </div>
                        <span class="table-progress-text">${need.progress_percentage || 0}%</span>
                    </div>
                </td>
                <td>
                    <span class="status-badge ${need.status}">
                        ${need.status === 'fulfilled' ? '✅ Fulfilled' : '🔄 Active'}
                    </span>
                </td>
                <td>${need.volunteer_name}</td>
                <td>${this.formatDate(need.updated_at)}</td>
            </tr>
        `).join('');
    }

    updateTimestamp() {
        document.getElementById('lastUpdated').textContent = new Date().toLocaleTimeString();
        document.getElementById('refreshText').textContent = 'Refresh';
    }

    formatDate(dateString) {
        if (!dateString) return 'N/A';
        const date = new Date(dateString);
        return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
    }
}

// Initialize when page loads
document.addEventListener('DOMContentLoaded', () => {
    new Dashboard();
});
