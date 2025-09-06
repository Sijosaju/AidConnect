from flask import Flask, request, jsonify, render_template, send_from_directory, redirect, url_for
from flask_cors import CORS
from pymongo import MongoClient
from bson import ObjectId
from datetime import datetime, timedelta
from dotenv import load_dotenv
import os

# Load environment variables from .env file
load_dotenv()

# Initialize Flask app
app = Flask(__name__, 
            static_folder='../frontend',
            template_folder='../frontend')

# Enable CORS
CORS(app, origins="*")

# MongoDB Connection using environment variables
try:
    # Get MongoDB URI from environment variables
    MONGO_URI = os.getenv('MONGO_URI')
    DB_NAME = os.getenv('DB_NAME', 'aidconnect_db')  # default fallback
    
    if not MONGO_URI:
        raise ValueError("MONGO_URI not found in environment variables. Check your .env file.")
    
    # Connect to MongoDB
    client = MongoClient(MONGO_URI)
    db = client[DB_NAME]
    needs_collection = db.relief_needs
    donations_collection = db.donations
    
    # Test connection
    client.admin.command('ping')
    print(f"✅ Connected to MongoDB Atlas: {DB_NAME}")
    
except Exception as e:
    print(f"❌ MongoDB connection failed: {e}")
    print("📋 Make sure your .env file contains MONGO_URI=your_connection_string")
    exit(1)

# ===== STATIC FILE SERVING =====
@app.route('/css/<path:filename>')
def serve_css(filename):
    return send_from_directory('../frontend/css', filename)

@app.route('/js/<path:filename>')
def serve_js(filename):
    return send_from_directory('../frontend/js', filename)

# ===== HTML PAGES =====
@app.route('/')
def index():
    """Home page route - this handles the root URL"""
    return render_template('index.html')

@app.route('/home')
@app.route('/index.html')
def home():
    """Alternative home routes - redirect to main index"""
    return redirect(url_for('index'))

@app.route('/volunteer')
@app.route('/volunteer.html')
def volunteer():
    return render_template('volunteer.html')

@app.route('/donor')
@app.route('/donor.html')  
def donor():
    return render_template('donor.html')

@app.route('/dashboard')
@app.route('/dashboard.html')
def dashboard():
    return render_template('dashboard.html')

# ===== ERROR HANDLERS =====
@app.errorhandler(404)
def page_not_found(error):
    """Handle 404 errors by redirecting to home page"""
    print(f"⚠️ 404 Error: {request.url} not found, redirecting to home")
    return redirect(url_for('index'))

@app.errorhandler(500)  
def internal_error(error):
    """Handle 500 errors"""
    print(f"❌ 500 Error: {error}")
    return {'success': False, 'error': 'Internal server error'}, 500

# ===== VOLUNTEER API ROUTES =====

@app.route('/api/volunteer/needs', methods=['POST'])
def create_need():
    """Volunteer posts a new relief need with duplicate prevention"""
    try:
        data = request.get_json()
        print(f"📝 Creating need with data: {data}")
        
        # Validate required fields
        required_fields = ['volunteerName', 'volunteerPhone', 'itemName', 'quantity', 'urgency']
        for field in required_fields:
            if not data.get(field):
                return jsonify({'success': False, 'error': f'Missing field: {field}'}), 400
        
        # Validate phone number
        phone = data.get('volunteerPhone', '').strip()
        if not phone or len(phone) < 10:
            return jsonify({'success': False, 'error': 'Valid phone number is required for donor contact'}), 400
        
        # **DUPLICATE CHECK** - Prevent duplicate requests within 1 hour
        cutoff_time = datetime.utcnow() - timedelta(hours=1)
        
        existing_need = needs_collection.find_one({
            'volunteer_name': data['volunteerName'].strip(),
            'volunteer_phone': phone,
            'item_name': data['itemName'].strip(),
            'status': 'active',
            'created_at': {'$gte': cutoff_time}
        })
        
        if existing_need:
            print(f"⚠️ Duplicate request blocked for {data['volunteerName']} - {data['itemName']}")
            return jsonify({
                'success': False, 
                'error': 'Similar request already exists in the last hour. Please wait before submitting again.'
            }), 409
        
        # Create need document
        need = {
            'volunteer_name': data['volunteerName'].strip(),
            'volunteer_phone': phone,
            'volunteer_email': data.get('volunteerEmail', '').strip(),
            'volunteer_location': data.get('volunteerLocation', '').strip(),
            'item_name': data['itemName'].strip(),
            'required_quantity': int(data['quantity']),
            'donated_quantity': 0,
            'remaining_quantity': int(data['quantity']),
            'urgency_level': data['urgency'],
            'description': data.get('description', '').strip(),
            'status': 'active',
            'created_at': datetime.utcnow(),
            'updated_at': datetime.utcnow(),
            'donations': []
        }
        
        # Insert into database - this should only happen once now
        result = needs_collection.insert_one(need)
        print(f"✅ Need created with ID: {result.inserted_id}")
        
        return jsonify({
            'success': True,
            'message': 'Relief need posted successfully!',
            'need_id': str(result.inserted_id)
        }), 201
        
    except Exception as e:
        print(f"❌ Error creating need: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/volunteer/needs', methods=['GET'])
def get_volunteer_needs():
    """Get all needs for volunteer dashboard"""
    try:
        # Get query parameters
        volunteer_name = request.args.get('volunteer')
        status = request.args.get('status', 'active')
        
        # Build query
        query = {'status': status}
        if volunteer_name:
            query['volunteer_name'] = volunteer_name
        
        # Fetch from database
        needs = list(needs_collection.find(query).sort('created_at', -1))
        print(f"📋 Found {len(needs)} volunteer needs")
        
        # Format response
        for need in needs:
            need['_id'] = str(need['_id'])
            need['created_at'] = need['created_at'].isoformat()
            need['updated_at'] = need['updated_at'].isoformat()
            
            # Calculate progress percentage
            if need['required_quantity'] > 0:
                progress = (need['donated_quantity'] / need['required_quantity']) * 100
                need['progress_percentage'] = round(progress, 1)
            else:
                need['progress_percentage'] = 0
        
        return jsonify({
            'success': True,
            'needs': needs,
            'total_count': len(needs)
        }), 200
        
    except Exception as e:
        print(f"❌ Error fetching volunteer needs: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/volunteer/needs/<need_id>', methods=['DELETE'])
def delete_need(need_id):
    """Delete a relief need"""
    try:
        print(f"🗑️ Deleting need: {need_id}")
        result = needs_collection.delete_one({'_id': ObjectId(need_id)})
        
        if result.deleted_count == 0:
            return jsonify({'success': False, 'error': 'Need not found'}), 404
        
        print(f"✅ Need deleted successfully: {need_id}")
        return jsonify({
            'success': True,
            'message': 'Need deleted successfully'
        }), 200
        
    except Exception as e:
        print(f"❌ Error deleting need: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

# ===== DONOR API ROUTES =====

@app.route('/api/donor/needs', methods=['GET'])
def get_donor_needs():
    """Get all active needs for donors"""
    try:
        # Get query parameters for filtering
        urgency = request.args.get('urgency')
        search = request.args.get('search')
        
        print(f"🔍 Donor needs request - urgency: {urgency}, search: {search}")
        
        # Build query
        query = {'status': 'active', 'remaining_quantity': {'$gt': 0}}
        
        if urgency and urgency != 'all':
            query['urgency_level'] = urgency
            
        if search:
            query['item_name'] = {'$regex': search, '$options': 'i'}
        
        # Fetch from database
        needs = list(needs_collection.find(query).sort('created_at', -1))
        print(f"📋 Found {len(needs)} donor needs")
        
        # Format response
        for need in needs:
            need['_id'] = str(need['_id'])
            need['created_at'] = need['created_at'].isoformat()
            need['updated_at'] = need['updated_at'].isoformat()
            
            # Calculate progress percentage
            if need['required_quantity'] > 0:
                progress = (need['donated_quantity'] / need['required_quantity']) * 100
                need['progress_percentage'] = round(progress, 1)
            else:
                need['progress_percentage'] = 0
            
            # Calculate time since posted - FIXED VERSION
            created_at_dt = need['created_at']
            if isinstance(created_at_dt, str):
                try:
                    created_at_dt = datetime.fromisoformat(created_at_dt.replace('Z', '+00:00'))
                except:
                    created_at_dt = datetime.utcnow()  # fallback
            
            time_diff = datetime.utcnow() - created_at_dt
            days = time_diff.days
            hours = time_diff.seconds // 3600
            
            if days > 0:
                need['time_since'] = f"{days} day{'s' if days > 1 else ''} ago"
            elif hours > 0:
                need['time_since'] = f"{hours} hour{'s' if hours > 1 else ''} ago"
            else:
                need['time_since'] = "Just posted"
        
        return jsonify({
            'success': True,
            'needs': needs,
            'total_count': len(needs)
        }), 200
        
    except Exception as e:
        print(f"❌ Error fetching donor needs: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/donor/donate', methods=['POST'])
def make_donation():
    """Process a donation pledge with enhanced donor tracking"""
    try:
        data = request.get_json()
        print(f"💝 Processing donation: {data}")
        
        # Validate required fields
        required_fields = ['need_id', 'donor_name', 'donor_phone', 'pledged_quantity', 'donation_method']
        for field in required_fields:
            if not data.get(field):
                return jsonify({'success': False, 'error': f'Missing field: {field}'}), 400
        
        need_id = data['need_id']
        pledged_quantity = int(data['pledged_quantity'])
        
        # Check if need exists and is active
        need = needs_collection.find_one({'_id': ObjectId(need_id), 'status': 'active'})
        
        if not need:
            return jsonify({'success': False, 'error': 'Need not found or inactive'}), 404
        
        # Check if requested quantity is available
        if pledged_quantity > need['remaining_quantity']:
            return jsonify({
                'success': False,
                'error': f'Only {need["remaining_quantity"]} items remaining'
            }), 400
        
        # Create enhanced donation record
        donation = {
            'need_id': need_id,
            'donor_name': data['donor_name'],
            'donor_phone': data['donor_phone'],
            'donor_email': data.get('donor_email', ''),
            'pledged_quantity': pledged_quantity,
            'donation_method': data['donation_method'],
            'delivery_notes': data.get('delivery_notes', ''),
            'status': 'pledged',
            'created_at': datetime.utcnow(),
            'updated_at': datetime.utcnow(),
            # Add volunteer info for reference
            'volunteer_name': need['volunteer_name'],
            'volunteer_phone': need['volunteer_phone'],
            'item_name': need['item_name']
        }
        
        # Insert donation
        donation_result = donations_collection.insert_one(donation)
        
        # Update need quantities
        new_donated = need['donated_quantity'] + pledged_quantity
        new_remaining = need['required_quantity'] - new_donated
        new_status = 'fulfilled' if new_remaining <= 0 else 'active'
        
        # Create donor info for the need document
        donor_info = {
            'donation_id': str(donation_result.inserted_id),
            'donor_name': data['donor_name'],
            'donor_phone': data['donor_phone'],
            'donor_email': data.get('donor_email', ''),
            'pledged_quantity': pledged_quantity,
            'donation_method': data['donation_method'],
            'delivery_notes': data.get('delivery_notes', ''),
            'pledge_date': datetime.utcnow().isoformat(),
            'status': 'pledged'
        }
        
        # Update need in database with donor info
        needs_collection.update_one(
            {'_id': ObjectId(need_id)},
            {
                '$set': {
                    'donated_quantity': new_donated,
                    'remaining_quantity': max(0, new_remaining),
                    'status': new_status,
                    'updated_at': datetime.utcnow()
                },
                '$push': {
                    'donations': donor_info  # Add complete donor info
                }
            }
        )
        
        print(f"✅ Donation processed successfully: {donation_result.inserted_id}")
        
        return jsonify({
            'success': True,
            'message': 'Donation pledged successfully!',
            'donation_id': str(donation_result.inserted_id),
            'remaining_quantity': max(0, new_remaining),
            'volunteer_contact': {
                'name': need['volunteer_name'],
                'phone': need['volunteer_phone'],
                'email': need['volunteer_email'],
                'location': need['volunteer_location']
            }
        }), 201
        
    except Exception as e:
        print(f"❌ Error processing donation: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500


# ===== DASHBOARD API ROUTES =====

@app.route('/api/dashboard', methods=['GET'])
def get_dashboard_data():
    """Get dashboard statistics and data"""
    try:
        # Get all needs
        active_needs = list(needs_collection.find({'status': 'active'}))
        fulfilled_needs = list(needs_collection.find({'status': 'fulfilled'}))
        all_donations = list(donations_collection.find())
        
        print(f"📊 Dashboard stats - Active: {len(active_needs)}, Fulfilled: {len(fulfilled_needs)}, Donations: {len(all_donations)}")
        
        # Format data
        for need in active_needs + fulfilled_needs:
            need['_id'] = str(need['_id'])
            need['created_at'] = need['created_at'].isoformat()
            need['updated_at'] = need['updated_at'].isoformat()
            
            # Calculate progress percentage
            if need['required_quantity'] > 0:
                progress = (need['donated_quantity'] / need['required_quantity']) * 100
                need['progress_percentage'] = round(progress, 1)
            else:
                need['progress_percentage'] = 0
        
        # Calculate statistics
        stats = {
            'active_needs_count': len(active_needs),
            'fulfilled_needs_count': len(fulfilled_needs),
            'total_donations': len(all_donations),
            'critical_needs_count': len([n for n in active_needs if n.get('urgency_level') == 'critical'])
        }
        
        return jsonify({
            'success': True,
            'stats': stats,
            'active_needs': active_needs,
            'fulfilled_needs': fulfilled_needs
        }), 200
        
    except Exception as e:
        print(f"❌ Error fetching dashboard data: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

# ===== UTILITY ROUTES =====

@app.route('/api/health')
def health_check():
    """Health check endpoint"""
    return {'status': 'healthy', 'message': 'AidConnect API is running'}, 200

# ===== APPLICATION STARTUP =====
if __name__ == '__main__':
    print("🚀 Starting AidConnect Server...")
    print("📱 Frontend: http://localhost:5000")
    print("🔌 API Base: http://localhost:5000/api")
    print(f"🗃️  Database: {DB_NAME}")
    print("=" * 50)
    
    app.run(
        host='0.0.0.0',
        port=5000,
        debug=True,
        threaded=True
    )
