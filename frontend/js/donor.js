// donor.js - FIXED VERSION
class DonorPortal {
    constructor() {
        this.API_BASE = '/api/donor';
        this.currentNeeds = [];
        this.init();
    }

    init() {
        console.log('🎯 Initializing DonorPortal');
        this.bindEvents();
        this.loadAvailableNeeds();
        
        // Auto-refresh every 10 seconds for real-time updates
        this.refreshInterval = setInterval(() => {
            console.log('⏰ Auto-refreshing donor needs...');
            this.loadAvailableNeeds();
        }, 10000);
    }

    bindEvents() {
        const refreshBtn = document.getElementById('refreshDonations');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => {
                console.log('🔄 Manual refresh clicked');
                this.loadAvailableNeeds();
            });
        }

        // Filter buttons
        const filterTags = document.querySelectorAll('.filter-tag');
        console.log('🏷️ Found filter tags:', filterTags.length);
        
        filterTags.forEach(tag => {
            tag.addEventListener('click', (e) => {
                console.log('🔍 Filter clicked:', e.target.dataset.filter);
                filterTags.forEach(t => t.classList.remove('active'));
                e.target.classList.add('active');
                this.loadAvailableNeeds(e.target.dataset.filter);
            });
        });

        // Search input
        const searchInput = document.getElementById('searchNeeds');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                console.log('🔍 Search input:', e.target.value);
                clearTimeout(this.searchTimeout);
                this.searchTimeout = setTimeout(() => {
                    this.loadAvailableNeeds('all', e.target.value);
                }, 500);
            });
        }
    }

    async loadAvailableNeeds(urgency = 'all', search = '') {
        console.log('📡 Loading needs - Filter:', urgency, 'Search:', search);
        
        try {
            // Build URL with cache busting
            let url = `${this.API_BASE}/needs?`;
            if (urgency !== 'all') url += `urgency=${urgency}&`;
            if (search) url += `search=${encodeURIComponent(search)}&`;
            
            // Add multiple cache-busting parameters
            url += `t=${Date.now()}&r=${Math.random()}`;
            
            console.log('🌐 Fetching from:', url);

            const response = await fetch(url, {
                method: 'GET',
                cache: 'no-store',
                headers: {
                    'Cache-Control': 'no-cache, no-store, must-revalidate',
                    'Pragma': 'no-cache',
                    'Expires': '0'
                }
            });

            console.log('📥 Response status:', response.status, response.statusText);

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const result = await response.json();
            console.log('✅ API Response:', result);

            if (result.success) {
                console.log('🎯 Processing', result.needs.length, 'needs');
                this.currentNeeds = result.needs;
                this.displayNeeds(result.needs);
                this.updateNeedsCount(result.needs.length);
            } else {
                console.error('❌ API returned error:', result.error);
                this.showError('API Error: ' + result.error);
            }
        } catch (error) {
            console.error('💥 Network/Fetch error:', error);
            this.showError('Connection error: ' + error.message);
        }
    }

    displayNeeds(needs) {
        console.log('🖼️ Displaying', needs.length, 'needs');
        
        const container = document.getElementById('needsList');
        if (!container) {
            console.error('❌ Container #needsList not found!');
            console.log('🔍 Available containers:', document.querySelectorAll('[id*="needs"]'));
            return;
        }

        console.log('📦 Container found, updating content...');

        if (needs.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">
                        <i class="fas fa-heart-crack"></i>
                    </div>
                    <h3>No Active Needs</h3>
                    <p>All current relief requests have been fulfilled! Check back soon for new ways to help.</p>
                    <a href="dashboard.html" class="btn btn-outline">
                        <i class="fas fa-chart-line"></i>
                        View Impact Dashboard
                    </a>
                </div>
            `;
            console.log('📭 Displayed empty state');
            return;
        }

        const needsHTML = needs.map(need => this.createNeedCard(need)).join('');
        container.innerHTML = needsHTML;
        console.log('✅ Content updated successfully');
    }

    createNeedCard(need) {
        const urgencyClass = `urgency-${need.urgency_level}`;
        const progressPercent = need.progress_percentage || 0;
        
        return `
            <div class="need-card ${urgencyClass}" data-need-id="${need._id}">
                <div class="need-card-header">
                    <h3>${this.escapeHtml(need.item_name)}</h3>
                    <span class="urgency-badge ${need.urgency_level}">
                        ${this.getUrgencyIcon(need.urgency_level)} ${need.urgency_level.toUpperCase()}
                    </span>
                </div>
                
                <div class="need-meta">
                    <div class="need-quantity">
                        <strong>Still needed:</strong> ${need.remaining_quantity} out of ${need.required_quantity}
                    </div>
                    <div class="need-volunteer">
                        Posted by: <strong>${this.escapeHtml(need.volunteer_name)}</strong>
                    </div>
                </div>
                
                <div class="progress-section">
                    <div class="progress-info">
                        <span class="progress-label">Progress</span>
                        <span class="progress-percentage">${progressPercent}%</span>
                    </div>
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: ${progressPercent}%"></div>
                    </div>
                </div>
                
                ${this.createContactSection(need)}
                
                <div class="card-actions">
                    ${need.remaining_quantity > 0 ? `
                        <button class="btn btn-primary" onclick="donorPortal.makeDonation('${need._id}', '${this.escapeHtml(need.item_name)}', ${need.remaining_quantity})">
                            <i class="fas fa-heart"></i>
                            Pledge Donation
                        </button>
                    ` : `
                        <div class="fulfilled-badge">✅ Fulfilled</div>
                    `}
                </div>
            </div>
        `;
    }

    createContactSection(need) {
        return `
            <div class="volunteer-contact">
                <h4><i class="fas fa-user"></i> Contact Volunteer</h4>
                <div class="contact-details">
                    ${need.volunteer_phone ? `
                        <div class="contact-item">
                            <i class="fas fa-phone"></i>
                            <span>${this.escapeHtml(need.volunteer_phone)}</span>
                        </div>
                    ` : ''}
                    ${need.volunteer_email ? `
                        <div class="contact-item">
                            <i class="fas fa-envelope"></i>
                            <span>${this.escapeHtml(need.volunteer_email)}</span>
                        </div>
                    ` : ''}
                    ${need.volunteer_location ? `
                        <div class="contact-item">
                            <i class="fas fa-map-marker-alt"></i>
                            <span>${this.escapeHtml(need.volunteer_location)}</span>
                        </div>
                    ` : ''}
                    ${!need.volunteer_phone && !need.volunteer_email && !need.volunteer_location ? `
                        <div class="contact-item">
                            <i class="fas fa-info-circle"></i>
                            <span>Contact info not provided</span>
                        </div>
                    ` : ''}
                </div>
            </div>
        `;
    }

    updateNeedsCount(count) {
        const countElement = document.getElementById('needsCount');
        if (countElement) {
            countElement.textContent = count === 0 
                ? 'No active needs at the moment' 
                : `${count} opportunities to help`;
            console.log('📊 Updated needs count:', count);
        }
    }

    showError(message) {
        const container = document.getElementById('needsList');
        if (container) {
            container.innerHTML = `
                <div class="error-state">
                    <div class="error-icon">
                        <i class="fas fa-exclamation-triangle"></i>
                    </div>
                    <h3>Unable to Load Needs</h3>
                    <p>${message}</p>
                    <button class="btn btn-primary" onclick="donorPortal.loadAvailableNeeds()">
                        <i class="fas fa-retry"></i>
                        Try Again
                    </button>
                </div>
            `;
        }
    }

async makeDonation(needId, itemName, maxQuantity) {
    console.log('💝 Making donation for need:', needId);
    
    // Show donor details modal instead of simple prompt
    this.showDonorModal(needId, itemName, maxQuantity);
}

showDonorModal(needId, itemName, maxQuantity) {
    const modalHtml = `
        <div id="donorModal" class="modal-overlay">
            <div class="modal-content">
                <div class="modal-header">
                    <h3>🎁 Pledge Donation: ${itemName}</h3>
                    <button onclick="donorPortal.closeDonorModal()" class="modal-close">&times;</button>
                </div>
                <form id="donorPledgeForm" class="donor-form">
                    <div class="form-group">
                        <label for="donorName">Your Name <span style="color: red;">*</span></label>
                        <input type="text" id="donorName" required placeholder="Enter your full name">
                    </div>
                    
                    <div class="form-group">
                        <label for="donorPhone">Phone Number <span style="color: red;">*</span></label>
                        <input type="tel" id="donorPhone" required placeholder="Your contact number">
                    </div>
                    
                    <div class="form-group">
                        <label for="donorEmail">Email Address <span style="color: #666; font-weight: normal;">(Optional)</span></label>
                        <input type="email" id="donorEmail" placeholder="your.email@example.com">
                    </div>
                    
                    <div class="form-group">
                        <label for="pledgedQuantity">Quantity to Donate <span style="color: red;">*</span> (Max: ${maxQuantity})</label>
                        <input type="number" id="pledgedQuantity" required min="1" max="${maxQuantity}" placeholder="Enter quantity">
                    </div>
                    
                    <div class="form-group">
                        <label for="donationMethod">Donation Method <span style="color: red;">*</span></label>
                        <select id="donationMethod" required>
                            <option value="">Select method</option>
                            <option value="direct">Direct Delivery</option>
                            <option value="pickup">Volunteer Pickup</option>
                            <option value="drop_off">Drop-off at Location</option>
                            <option value="online">Online Transfer</option>
                        </select>
                    </div>
                    
                    <div class="form-group">
                        <label for="deliveryNotes">Delivery Notes <span style="color: #666; font-weight: normal;">(Optional)</span></label>
                        <textarea id="deliveryNotes" rows="3" placeholder="Any special instructions or preferred contact times..."></textarea>
                    </div>
                    
                    <div class="modal-actions">
                        <button type="button" onclick="donorPortal.closeDonorModal()" class="btn btn-ghost">Cancel</button>
                        <button type="submit" class="btn btn-primary">
                            <i class="fas fa-heart"></i> Confirm Pledge
                        </button>
                    </div>
                </form>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    
    // Bind form submission
    document.getElementById('donorPledgeForm').addEventListener('submit', (e) => {
        e.preventDefault();
        this.submitDonorPledge(needId);
    });
}


async submitDonorPledge(needId) {
    const formData = {
        need_id: needId,
        donor_name: document.getElementById('donorName').value.trim(),
        donor_phone: document.getElementById('donorPhone').value.trim(),
        donor_email: document.getElementById('donorEmail').value.trim(),
        pledged_quantity: parseInt(document.getElementById('pledgedQuantity').value),
        donation_method: document.getElementById('donationMethod').value,
        delivery_notes: document.getElementById('deliveryNotes').value.trim()
    };
    
    // Validate ONLY mandatory fields (not email and delivery_notes)
    const requiredFields = [
        { field: 'donor_name', label: 'Your Name' },
        { field: 'donor_phone', label: 'Phone Number' },
        { field: 'pledged_quantity', label: 'Quantity' },
        { field: 'donation_method', label: 'Donation Method' }
    ];
    
    // Check only required fields
    for (const { field, label } of requiredFields) {
        if (!formData[field] || formData[field] === '') {
            alert(`❌ Please fill in ${label}`);
            return;
        }
    }
    
    // Additional validation for quantity
    if (isNaN(formData.pledged_quantity) || formData.pledged_quantity <= 0) {
        alert('❌ Please enter a valid quantity');
        return;
    }
    
    try {
        console.log('📤 Submitting donor pledge:', formData);
        
        const response = await fetch(`${this.API_BASE}/donate`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(formData)
        });

        const result = await response.json();
        console.log('💝 Pledge result:', result);

        if (result.success) {
            this.closeDonorModal();
            this.showSuccessModal(result);
            this.loadAvailableNeeds(); // Refresh the list
        } else {
            alert(`❌ Error: ${result.error}`);
        }
    } catch (error) {
        console.error('💥 Pledge error:', error);
        alert('❌ Connection error. Please try again.');
    }
}


closeDonorModal() {
    const modal = document.getElementById('donorModal');
    if (modal) {
        modal.remove();
    }
}

showSuccessModal(result) {
    const modalHtml = `
        <div id="successModal" class="modal-overlay success-modal">
            <div class="modal-content">
                <div class="success-header">
                    <div class="success-icon">🎉</div>
                    <h3>Pledge Confirmed!</h3>
                </div>
                <div class="success-body">
                    <p>Thank you for your generous donation pledge!</p>
                    <div class="contact-info">
                        <h4>Volunteer Contact:</h4>
                        <p><strong>Name:</strong> ${result.volunteer_contact?.name || 'N/A'}</p>
                        <p><strong>Phone:</strong> ${result.volunteer_contact?.phone || 'N/A'}</p>
                        <p><strong>Email:</strong> ${result.volunteer_contact?.email || 'N/A'}</p>
                        ${result.volunteer_contact?.location ? `<p><strong>Location:</strong> ${result.volunteer_contact.location}</p>` : ''}
                    </div>
                    <p class="note">The volunteer will contact you soon to coordinate the donation delivery.</p>
                </div>
                <div class="modal-actions">
                    <button onclick="this.remove()" class="btn btn-primary">Close</button>
                </div>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    
    // Auto-close after 10 seconds
    setTimeout(() => {
        const modal = document.getElementById('successModal');
        if (modal) modal.remove();
    }, 10000);
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
}

// Initialize when page loads
let donorPortal;
document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 DOM Content Loaded - Initializing DonorPortal');
    
    // Wait for all elements to be ready
    setTimeout(() => {
        console.log('🎯 Creating DonorPortal instance...');
        
        // Check if needsList container exists
        const container = document.getElementById('needsList');
        if (container) {
            console.log('✅ needsList container found');
            donorPortal = new DonorPortal();
        } else {
            console.error('❌ needsList container not found, retrying...');
            // Retry after another delay
            setTimeout(() => {
                donorPortal = new DonorPortal();
            }, 1000);
        }
    }, 500);
});

// Fallback initialization
window.addEventListener('load', () => {
    if (!donorPortal) {
        console.log('🔄 Fallback: Initializing DonorPortal on window load');
        donorPortal = new DonorPortal();
    }
});

// Force refresh when tab becomes visible (in case user switches tabs)
document.addEventListener('visibilitychange', () => {
    if (!document.hidden && donorPortal) {
        console.log('👁️ Tab became visible, refreshing needs...');
        donorPortal.loadAvailableNeeds();
    }
});
