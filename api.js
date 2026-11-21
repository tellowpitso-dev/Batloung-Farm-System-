const express = require('express');
const router = express.Router();

const authController = require('../controllers/authController');
const supplierController = require('../controllers/supplierController');
const fruitController = require('../controllers/fruitController');
const vendorController = require('../controllers/vendorController');
const purchaseController = require('../controllers/purchaseController');
const salesController = require('../controllers/salesController');
const reportController = require('../controllers/reportController');
const { verifyToken, requireAdmin } = require('../middleware/auth');
const db = require('../database/db');

// Auth Routes
router.post('/auth/login', authController.login);
router.get('/auth/me', verifyToken, authController.me);

// Supplier Routes (Admin Only)
router.post('/suppliers', verifyToken, requireAdmin, supplierController.createSupplier);
router.get('/suppliers', verifyToken, supplierController.getAllSuppliers);
router.get('/suppliers/:id', verifyToken, supplierController.getSupplierById);
router.put('/suppliers/:id', verifyToken, requireAdmin, supplierController.updateSupplier);
router.delete('/suppliers/:id', verifyToken, requireAdmin, supplierController.deleteSupplier);

// Fruit and Stock Management Routes
router.post('/fruits', verifyToken, requireAdmin, fruitController.createFruit);
router.get('/fruits', verifyToken, fruitController.getAllFruits);
router.put('/fruits/:id', verifyToken, requireAdmin, fruitController.updateFruit);
router.get('/fruits/stock/levels', verifyToken, fruitController.getStockLevels);
router.get('/fruits/stock/low', verifyToken, fruitController.getLowStockFruits);

// Vendor Management Routes
router.post('/vendors', verifyToken, requireAdmin, vendorController.registerVendor);
router.get('/vendors/public', vendorController.getPublicVendorList);
router.get('/vendors', verifyToken, vendorController.getAllVendors);
router.get('/vendors/search', verifyToken, vendorController.searchVendors);
router.get('/vendors/balances', verifyToken, requireAdmin, vendorController.getVendorBalances);
router.put('/vendors/:id', verifyToken, requireAdmin, vendorController.updateVendor);
router.delete('/vendors/:id', verifyToken, requireAdmin, vendorController.deleteVendor);

// Purchase Management Routes (Supplier -> Farm)
router.post('/purchases', verifyToken, requireAdmin, purchaseController.createPurchase);
router.get('/purchases', verifyToken, requireAdmin, purchaseController.getAllPurchases);

// Sales Management Routes (Farm -> Vendors)
router.post('/sales', verifyToken, salesController.createSale);
router.get('/sales', verifyToken, salesController.getAllSales);
router.get('/sales/:id', verifyToken, salesController.getSaleById);
router.put('/sales/:id/status', verifyToken, requireAdmin, salesController.updateOrderStatus);
router.put('/sales/:id/batch-photo', verifyToken, requireAdmin, salesController.updateBatchPhoto);
router.post('/sales/:id/payment', verifyToken, requireAdmin, salesController.recordPayment);

// SQL Reporting Routes
router.get('/reports/top-fruits', verifyToken, requireAdmin, reportController.getTopFiveFruits);
router.get('/reports/sales-revenue', verifyToken, requireAdmin, reportController.getSalesRevenueByDateRange);
router.get('/reports/top-vendor', verifyToken, requireAdmin, reportController.getTopVendorByBoxes);
router.get('/reports/stock-levels', verifyToken, requireAdmin, reportController.getCurrentStockLevels);

// Live GPS Location Tracking
router.get('/map/active-orders', verifyToken, async (req, res) => {
    try {
        let sql = `
            SELECT 
                s.sale_id,
                s.vendor_id,
                v.vendor_name,
                v.phone_number,
                v.location AS vendor_location,
                s.order_status,
                s.payment_status,
                s.total_amount,
                s.delivery_type,
                s.delivery_lat,
                s.delivery_lng,
                s.distance_km,
                s.estimated_time_mins,
                s.sale_date,
                (SELECT GROUP_CONCAT(CONCAT(f.fruit_name, ' (', sd.packaging_size, ' x ', sd.quantity, ')') SEPARATOR ', ')
                 FROM sales_details sd
                 JOIN fruits f ON sd.fruit_id = f.fruit_id
                 WHERE sd.sale_id = s.sale_id) AS items_summary
            FROM sales s
            JOIN vendors v ON s.vendor_id = v.vendor_id
            WHERE s.order_status NOT IN ('cancelled')
        `;

        const params = [];
        if (req.user && req.user.role === 'vendor') {
            sql += ' AND v.user_id = ?';
            params.push(req.user.userId);
        }

        sql += ' ORDER BY s.sale_date DESC LIMIT 40';

        const [orders] = await db.query(sql, params);

        return res.status(200).json({
            success: true,
            depot: {
                name: process.env.DEPOT_NAME || 'Batloung Farm Maseru Depot',
                latitude: parseFloat(process.env.DEPOT_LAT || '-29.3100'),
                longitude: parseFloat(process.env.DEPOT_LNG || '27.4800')
            },
            count: orders.length,
            orders
        });
    } catch (error) {
        console.error('Active orders map query error:', error);
        return res.status(500).json({ success: false, message: 'Failed to retrieve live map orders.' });
    }
});

module.exports = router;
