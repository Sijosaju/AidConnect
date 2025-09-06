// volunteer.js - Complete updated file with debugging and enhanced features
class VolunteerPortal {
    constructor() {
        this.API_BASE = '/api/volunteer';
        this.currentNeeds = [];
        this.init();
    }

    init() {
        console.log('🎯 Initializing VolunteerPortal');
        this.bindEvents();
        this.loadActiveNeeds();
        
        // Auto-refresh every 30 seconds
        setInterval(() => {
            console.log('⏰ Auto-refreshing volunteer needs...');
            this.loadActiveNeeds();
        }, 30000);
    }

    bindEvents() {
        // Form submission
        const form = document.getElementById('needForm');
        if (form) {
            form.addEventListener('submit', (e) => this.handleFormSubmit(e));
        }

        // Refresh button
        const refreshBtn = document.getElementById('refreshNeeds');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => {
                console.log('🔄 Manual refresh clicked');
                refreshBtn.innerHTML = '<i class="fas fa-sync fa-spin"></i> Refreshing...';
                this.loadActiveNeeds().finally(() => {
                    refreshBtn.innerHTML = '<i class="fas fa-sync"></i> Refresh';
                });
            });
        }

        // Quick action buttons
        const exportBtn = document.getElementById('exportData');
        if (exportBtn) {
            exportBtn.addEventListener('click', () => this.exportData());
        }

        const shareBtn = document.getElementById('shareNeeds');
        if (shareBtn) {
            shareBtn.addEventListener('click', () => this.shareNeeds());
        }
    }
async handleFormSubmit(event) {
    event.preventDefault();
    console.log('📝 Form submitted');
    
    // **PREVENT DOUBLE SUBMISSION**
    const submitButton = event.target.querySelector('button[type="submit"]');
    if (submitButton.disabled) {
        console.log('⚠️ Form already being submitted, ignoring...');
        return;
    }
    
    // Disable submit button immediately
    const originalButtonText = submitButton.innerHTML;
    submitButton.disabled = true;
    submitButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Submitting...';
    
    const formData = {
        volunteerName: document.getElementById('volunteerName')?.value?.trim() || '',
        volunteerPhone: document.getElementById('volunteerPhone')?.value?.trim() || '',
        volunteerEmail: document.getElementById('volunteerEmail')?.value?.trim() || '',
        volunteerLocation: document.getElementById('volunteerLocation')?.value?.trim() || '',
        itemName: document.getElementById('itemName')?.value?.trim() || '',
        quantity: parseInt(document.getElementById('quantity')?.value) || 0,
        urgency: document.getElementById('urgency')?.value || '',
        description: document.getElementById('description')?.value?.trim() || ''
    };

    console.log('📋 Form data:', formData);

    // Enhanced validation
    const validation = this.validateForm(formData);
    if (!validation.isValid) {
        alert(`❌ ${validation.error}`);
        // Re-enable button on validation error
        submitButton.disabled = false;
        submitButton.innerHTML = originalButtonText;
        return;
    }

    try {
        this.showLoading(true);
        
        const response = await fetch(`${this.API_BASE}/needs`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(formData)
        });

        const result = await response.json();
        console.log('✅ API Response:', result);

        if (result.success) {
            this.showSuccess('✅ Relief need posted successfully! Donors can now see your request.');
            this.clearForm();
            this.loadActiveNeeds();
            
            // Scroll to needs list to show the new need
            setTimeout(() => {
                const needsList = document.getElementById('needsList');
                if (needsList) {
                    needsList.scrollIntoView({ behavior: 'smooth' });
                }
            }, 500);
            
        } else {
            // Handle specific error messages
            if (result.error.includes('Similar request already exists')) {
                alert('⚠️ You already submitted a similar request recently. Please wait before submitting again.');
            } else {
                alert(`❌ Error: ${result.error}`);
            }
        }
    } catch (error) {
        console.error('💥 Error submitting form:', error);
        alert('❌ Connection error. Please try again.');
    } finally {
        // **ALWAYS RE-ENABLE BUTTON**
        submitButton.disabled = false;
        submitButton.innerHTML = originalButtonText;
        this.showLoading(false);
    }
}


    validateForm(data) {
        const required = [
            { field: 'volunteerName', label: 'Your Name' },
            { field: 'volunteerPhone', label: 'Phone Number' },
            { field: 'itemName', label: 'Supply Item' },
            { field: 'quantity', label: 'Quantity' },
            { field: 'urgency', label: 'Urgency Level' }
        ];

        for (const { field, label } of required) {
            if (!data[field]) {
                return { isValid: false, error: `Please fill in the ${label}` };
            }
        }

        if (data.quantity <= 0) {
            return { isValid: false, error: 'Quantity must be greater than 0' };
        }

        if (data.quantity > 10000) {
            return { isValid: false, error: 'Quantity cannot exceed 10,000' };
        }

        // Validate phone number
        if (data.volunteerPhone && !/^[0-9+\-\s()]{10,}$/.test(data.volunteerPhone)) {
            return { isValid: false, error: 'Please enter a valid phone number (at least 10 digits)' };
        }

        // Validate email if provided
        if (data.volunteerEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.volunteerEmail)) {
            return { isValid: false, error: 'Please enter a valid email address' };
        }

        return { isValid: true };
    }

    clearForm() {
        const form = document.getElementById('needForm');
        if (form) {
            form.reset();
            
            // Reset any custom styling
            const inputs = form.querySelectorAll('input, select, textarea');
            inputs.forEach(input => {
                input.classList.remove('error');
            });
        }
    }

    async loadActiveNeeds() {
        console.log('📡 Loading volunteer needs');
        
        try {
            const response = await fetch(`${this.API_BASE}/needs?status=active&t=${Date.now()}`, {
                cache: 'no-store',
                headers: {
                    'Cache-Control': 'no-cache, no-store, must-revalidate',
                    'Pragma': 'no-cache'
                }
            });
            
            console.log('📥 Response status:', response.status);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const result = await response.json();
            console.log('✅ Volunteer needs response:', result);

            if (result.success) {
                this.currentNeeds = result.needs;
                this.displayNeeds(result.needs);
            } else {
                console.error('❌ API Error:', result.error);
                this.showError('Failed to load needs: ' + result.error);
            }
        } catch (error) {
            console.error('💥 Error fetching needs:', error);
            this.showError('Connection error while loading needs');
            this.displayError('Failed to load your relief requests. Please check your connection and try again.');
        }
    }

    displayNeeds(needs) {
        console.log('🖼️ Displaying', needs.length, 'volunteer needs');
        
        const container = document.getElementById('needsList');
        if (!container) {
            console.error('❌ Container #needsList not found!');
            return;
        }

        if (needs.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">
                        <i class="fas fa-clipboard-list"></i>
                    </div>
                    <h3>No Active Requests</h3>
                    <p>Start by adding your first relief request above. It will appear here for donors to see.</p>
                </div>
            `;
            return;
        }

        const needsHTML = needs.map(need => this.createNeedCard(need)).join('');
        container.innerHTML = needsHTML;
        
        console.log('✅ Volunteer needs displayed successfully');
    }
createNeedCard(need) {
    const urgencyClass = `urgency-${need.urgency_level}`;
    const progressPercent = need.progress_percentage || 0;
    const timeAgo = this.formatTimeAgo(need.created_at);
    
    // Create donations section
    const donationsSection = this.createDonationsSection(need.donations || []);
    
    return `
        <div class="need-card ${urgencyClass}" data-need-id="${need._id}">
            <div class="need-header">
                <h3>${this.escapeHtml(need.item_name)}</h3>
                <span class="urgency-badge ${need.urgency_level}">
                    ${this.getUrgencyIcon(need.urgency_level)} ${need.urgency_level.toUpperCase()}
                </span>
            </div>
            
            <div class="need-details">
                <div class="detail-row">
                    <div class="need-detail">
                        <span class="label">Required</span>
                        <span class="value">${need.required_quantity}</span>
                    </div>
                    <div class="need-detail">
                        <span class="label">Donated</span>
                        <span class="value donated">${need.donated_quantity}</span>
                    </div>
                    <div class="need-detail">
                        <span class="label">Remaining</span>
                        <span class="value remaining">${need.remaining_quantity}</span>
                    </div>
                    <div class="need-detail">
                        <span class="label">Status</span>
                        <span class="value status-${need.status}">${need.status.toUpperCase()}</span>
                    </div>
                </div>
            </div>

            <div class="progress-section">
                <div class="progress-header">
                    <span class="progress-label">Donation Progress</span>
                    <span class="progress-percentage">${progressPercent}%</span>
                </div>
                <div class="progress-bar">
                    <div class="progress-fill" style="width: ${progressPercent}%"></div>
                </div>
            </div>

            ${need.description ? `
                <div class="need-description">
                    <strong>Description:</strong> ${this.escapeHtml(need.description)}
                </div>
            ` : ''}

            ${donationsSection}

            <div class="need-meta">
                <div class="posted-info">
                    <i class="fas fa-clock"></i>
                    Posted ${timeAgo}
                </div>
            </div>

            <div class="need-actions">
                <button class="btn btn-ghost btn-small" onclick="volunteerPortal.editNeed('${need._id}')">
                    <i class="fas fa-edit"></i> Edit
                </button>
                <button class="btn btn-ghost btn-small" onclick="volunteerPortal.deleteNeed('${need._id}')">
                    <i class="fas fa-trash"></i> Delete
                </button>
                ${need.donations && need.donations.length > 0 ? `
                    <button class="btn btn-primary btn-small" onclick="volunteerPortal.contactAllDonors('${need._id}')">
                        <i class="fas fa-phone"></i> Contact Donors
                    </button>
                ` : ''}
            </div>
        </div>
    `;
}

createDonationsSection(donations) {
    if (!donations || donations.length === 0) {
        return `
            <div class="donations-section">
                <h4><i class="fas fa-heart"></i> Donor Pledges</h4>
                <div class="no-donations">
                    <p>No pledges received yet. Share your need to get donors!</p>
                </div>
            </div>
        `;
    }
    
    const donationsList = donations.map(donation => `
        <div class="donation-card">
            <div class="donor-info">
                <div class="donor-header">
                    <strong>${this.escapeHtml(donation.donor_name)}</strong>
                    <span class="pledge-amount">${donation.pledged_quantity} items</span>
                </div>
                <div class="donor-contact">
                    <div class="contact-item">
                        <i class="fas fa-phone"></i>
                        <span>${this.escapeHtml(donation.donor_phone)}</span>
                        <button class="btn-copy" onclick="volunteerPortal.callDonor('${donation.donor_phone}', '${this.escapeHtml(donation.donor_name)}')" title="Call donor">
                            <i class="fas fa-phone-alt"></i>
                        </button>
                    </div>
                    ${donation.donor_email ? `
                        <div class="contact-item">
                            <i class="fas fa-envelope"></i>
                            <span>${this.escapeHtml(donation.donor_email)}</span>
                        </div>
                    ` : ''}
                </div>
                <div class="donation-details">
                    <div class="detail-item">
                        <strong>Method:</strong> ${donation.donation_method}
                    </div>
                    <div class="detail-item">
                        <strong>Pledged:</strong> ${new Date(donation.pledge_date).toLocaleDateString()}
                    </div>
                    ${donation.delivery_notes ? `
                        <div class="detail-item">
                            <strong>Notes:</strong> ${this.escapeHtml(donation.delivery_notes)}
                        </div>
                    ` : ''}
                </div>
                <div class="donation-actions">
                    <button class="btn btn-small btn-outline" onclick="volunteerPortal.markAsReceived('${donation.donation_id}')">
                        <i class="fas fa-check"></i> Mark Received
                    </button>
                </div>
            </div>
        </div>
    `).join('');
    
    return `
        <div class="donations-section">
            <h4><i class="fas fa-heart"></i> Donor Pledges (${donations.length})</h4>
            <div class="donations-list">
                ${donationsList}
            </div>
        </div>
    `;
}

callDonor(phone, name) {
    if (confirm(`Call ${name} at ${phone}?`)) {
        window.location.href = `tel:${phone}`;
    }
}

contactAllDonors(needId) {
    const need = this.currentNeeds.find(n => n._id === needId);
    if (!need || !need.donations) return;
    
    const phoneNumbers = need.donations.map(d => d.donor_phone).filter(p => p);
    if (phoneNumbers.length === 0) {
        alert('No donor phone numbers available');
        return;
    }
    
    const message = `Hello! This is ${need.volunteer_name} from the relief camp. Thank you for pledging ${need.item_name}. When would be a good time to coordinate the donation?`;
    
    // Create WhatsApp links for each donor
    const whatsappLinks = phoneNumbers.map(phone => 
        `https://wa.me/${phone.replace(/\D/g, '')}?text=${encodeURIComponent(message)}`
    );
    
    if (whatsappLinks.length === 1) {
        window.open(whatsappLinks[0], '_blank');
    } else {
        // Show modal with all contact options
        this.showContactDonorsModal(need.donations, message);
    }
}

markAsReceived(donationId) {
    if (confirm('Mark this donation as received?')) {
        // TODO: Implement API call to update donation status
        console.log('Marking donation as received:', donationId);
        alert('✅ Donation marked as received!');
        this.loadActiveNeeds(); // Refresh
    }
}


    displayError(message) {
        const container = document.getElementById('needsList');
        if (container) {
            container.innerHTML = `
                <div class="error-state">
                    <div class="error-icon">
                        <i class="fas fa-exclamation-triangle"></i>
                    </div>
                    <h3>Unable to Load Requests</h3>
                    <p>${message}</p>
                    <button class="btn btn-primary" onclick="volunteerPortal.loadActiveNeeds()">
                        <i class="fas fa-retry"></i>
                        Try Again
                    </button>
                </div>
            `;
        }
    }

    async editNeed(needId) {
        console.log('✏️ Editing need:', needId);
        alert('🔧 Edit functionality coming soon!');
    }

    async deleteNeed(needId) {
        if (!confirm('Are you sure you want to delete this relief request?\n\nThis action cannot be undone.')) {
            return;
        }

        try {
            this.showLoading(true);
            console.log('🗑️ Deleting need:', needId);
            
            const response = await fetch(`${this.API_BASE}/needs/${needId}`, {
                method: 'DELETE'
            });

            const result = await response.json();
            console.log('🗑️ Delete result:', result);

            if (result.success) {
                this.showSuccess('✅ Relief request deleted successfully');
                this.loadActiveNeeds();
            } else {
                alert(`❌ Error: ${result.error}`);
            }
        } catch (error) {
            console.error('💥 Error deleting need:', error);
            alert('❌ Connection error. Please try again.');
        } finally {
            this.showLoading(false);
        }
    }

    async viewDonations(needId) {
        console.log('👀 Viewing donations for need:', needId);
        alert('👀 Donation details functionality coming soon!');
    }

    exportData() {
        if (this.currentNeeds.length === 0) {
            alert('📋 No data to export');
            return;
        }

        try {
            const csvData = this.convertToCSV(this.currentNeeds);
            this.downloadCSV(csvData, `aidconnect-needs-${new Date().toISOString().split('T')[0]}.csv`);
            this.showSuccess('📁 Data exported successfully!');
        } catch (error) {
            console.error('Export error:', error);
            alert('❌ Export failed');
        }
    }

    convertToCSV(data) {
        const headers = [
            'Item Name', 'Required Quantity', 'Donated Quantity', 'Remaining Quantity', 
            'Urgency Level', 'Status', 'Volunteer Name', 'Phone', 'Email', 
            'Location', 'Description', 'Created Date', 'Progress %'
        ];
        
        const rows = data.map(need => [
            need.item_name || '',
            need.required_quantity || 0,
            need.donated_quantity || 0,
            need.remaining_quantity || 0,
            need.urgency_level || '',
            need.status || '',
            need.volunteer_name || '',
            need.volunteer_phone || '',
            need.volunteer_email || '',
            need.volunteer_location || '',
            need.description || '',
            need.created_at ? new Date(need.created_at).toLocaleDateString() : '',
            need.progress_percentage || 0
        ]);

        const csvContent = [headers, ...rows]
            .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
            .join('\n');

        return csvContent;
    }

    downloadCSV(csvData, filename) {
        const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        
        if (link.download !== undefined) {
            const url = URL.createObjectURL(blob);
            link.setAttribute('href', url);
            link.setAttribute('download', filename);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
    }

    shareNeeds() {
        const donorUrl = `${window.location.origin}/donor.html`;
        const shareText = `🆘 Help Needed! Check out these relief requests on AidConnect and make a difference in someone's life.`;
        
        if (navigator.share) {
            navigator.share({
                title: 'AidConnect - Help Relief Efforts',
                text: shareText,
                url: donorUrl
            }).catch(console.error);
        } else {
            // Fallback: copy to clipboard
            const textToCopy = `${shareText}\n\n${donorUrl}`;
            
            navigator.clipboard.writeText(textToCopy).then(() => {
                this.showSuccess('🔗 Share link copied to clipboard!');
            }).catch(() => {
                // Fallback for older browsers
                const textArea = document.createElement('textarea');
                textArea.value = textToCopy;
                document.body.appendChild(textArea);
                textArea.select();
                document.execCommand('copy');
                document.body.removeChild(textArea);
                this.showSuccess('🔗 Share text copied to clipboard!');
            });
        }
    }

    // Utility functions
    getUrgencyIcon(urgency) {
        const icons = {
            'critical': '🔴',
            'high': '🟡',
            'medium': '🟢'
        };
        return icons[urgency] || '⚪';
    }

    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    formatTimeAgo(timestamp) {
        if (!timestamp) return 'recently';
        
        const date = new Date(timestamp);
        const now = new Date();
        const diff = now - date;
        
        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(diff / 3600000);
        const days = Math.floor(diff / 86400000);
        
        if (days > 0) return `${days} day${days > 1 ? 's' : ''} ago`;
        if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
        if (minutes > 0) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
        return 'just now';
    }

    showLoading(show) {
        const overlay = document.getElementById('loadingOverlay');
        if (overlay) {
            overlay.classList.toggle('hidden', !show);
        }
    }

    showSuccess(message) {
        // Create a success notification
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #10b981;
            color: white;
            padding: 1rem;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.1);
            z-index: 10000;
            max-width: 300px;
        `;
        notification.innerHTML = `
            <div style="display: flex; align-items: center; gap: 0.5rem;">
                <i class="fas fa-check-circle"></i>
                <span>${message}</span>
                <button onclick="this.parentElement.parentElement.remove()" style="margin-left: auto; background: none; border: none; color: white; cursor: pointer; font-size: 18px;">×</button>
            </div>
        `;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            if (notification.parentElement) {
                notification.remove();
            }
        }, 5000);
    }

    showError(message) {
        console.error('VolunteerPortal Error:', message);
    }
}

// Initialize when page loads
let volunteerPortal;
document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 DOM Content Loaded - Initializing VolunteerPortal');
    
    setTimeout(() => {
        console.log('🎯 Creating VolunteerPortal instance...');
        volunteerPortal = new VolunteerPortal();
    }, 100);
});

// Fallback initialization
window.addEventListener('load', () => {
    if (!volunteerPortal) {
        console.log('🔄 Fallback: Initializing VolunteerPortal on window load');
        volunteerPortal = new VolunteerPortal();
    }
});
