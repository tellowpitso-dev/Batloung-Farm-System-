const db = require('../database/db');
const bcrypt = require('bcryptjs');

exports.registerVendor = async (req, res) => {
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        const { vendor_name, email, password, phone_number, location, latitude, longitude } = req.body;

        if (!vendor_name || !email || !password || !phone_number || !location) {
            await connection.rollback();
            return res.status(400).json({ success: false, message: 'Vendor name, email, password, phone, and location are required.' });
        }

        const [existing] = await connection.query('SELECT user_id FROM users WHERE email = ?', [email]);
        if (existing.length > 0) {
            await connection.rollback();
            return res.status(400).json({ success: false, message: 'Email address is already registered.' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const [userResult] = await connection.query(
            'INSERT INTO users (email, password_hash, role, full_name) VALUES (?, ?, "vendor", ?)',
            [email, hashedPassword, vendor_name]
        );

        const userId = userResult.insertId;

        const lat = latitude !== undefined && latitude !== null ? parseFloat(latitude) : -29.3138;
        const lng = longitude !== undefined && longitude !== null ? parseFloat(longitude) : 27.4842;

        const [vendorResult] = await connection.query(
            'INSERT INTO vendors (user_id, vendor_name, phone_number, location, latitude, longitude, registration_date, outstanding_balance) VALUES (?, ?, ?, ?, ?, ?, CURDATE(), 0.00)',
            [userId, vendor_name, phone_number, location, lat, lng]
        );

        await connection.commit();

        return res.status(201).json({
            success: true,
            message: 'Vendor registered successfully.',
            vendor_id: vendorResult.insertId,
            user_id: userId
        });
    } catch (error) {
        await connection.rollback();
        console.error('Register vendor error:', error);
        return res.status(500).json({ success: false, message: 'Failed to register vendor.' });
    } finally {
        connection.release();
    }
};

exports.getAllVendors = async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT 
                v.vendor_id,
                v.user_id,
                v.vendor_name,
                v.phone_number,
                v.location,
                v.latitude,
                v.longitude,
                v.registration_date,
                v.outstanding_balance,
                u.email,
                u.is_active,
                (SELECT COUNT(*) FROM sales s WHERE s.vendor_id = v.vendor_id) AS total_orders_placed,
                (SELECT IFNULL(SUM(s.total_amount), 0) FROM sales s WHERE s.vendor_id = v.vendor_id) AS lifetime_purchases
            FROM vendors v
            JOIN users u ON v.user_id = u.user_id
            ORDER BY v.vendor_name ASC
        `);

        return res.status(200).json({ success: true, count: rows.length, data: rows });
    } catch (error) {
        console.error('Get vendors error:', error);
        return res.status(500).json({ success: false, message: 'Failed to retrieve vendors.' });
    }
};

exports.searchVendors = async (req, res) => {
    try {
        const { query } = req.query;

        if (!query || query.trim() === '') {
            return res.status(400).json({ success: false, message: 'Search query is required.' });
        }

        const searchTerm = `%${query.trim()}%`;
        const [rows] = await db.query(`
            SELECT 
                v.vendor_id,
                v.vendor_name,
                v.phone_number,
                v.location,
                v.latitude,
                v.longitude,
                v.registration_date,
                v.outstanding_balance,
                u.email
            FROM vendors v
            JOIN users u ON v.user_id = u.user_id
            WHERE v.vendor_name LIKE ? OR v.phone_number LIKE ?
            ORDER BY v.vendor_name ASC
        `, [searchTerm, searchTerm]);

        return res.status(200).json({ success: true, count: rows.length, data: rows });
    } catch (error) {
        console.error('Search vendor error:', error);
        return res.status(500).json({ success: false, message: 'Failed to search vendors.' });
    }
};

exports.updateVendor = async (req, res) => {
    try {
        const id = parseInt(req.params.id, 10);
        const { vendor_name, phone_number, location, latitude, longitude } = req.body;

        const [existing] = await db.query('SELECT vendor_id FROM vendors WHERE vendor_id = ?', [id]);
        if (existing.length === 0) {
            return res.status(404).json({ success: false, message: 'Vendor not found.' });
        }

        await db.query(`
            UPDATE vendors 
            SET vendor_name = ?, phone_number = ?, location = ?, latitude = ?, longitude = ? 
            WHERE vendor_id = ?
        `, [vendor_name, phone_number, location, parseFloat(latitude), parseFloat(longitude), id]);

        return res.status(200).json({ success: true, message: 'Vendor details updated successfully.' });
    } catch (error) {
        console.error('Update vendor error:', error);
        return res.status(500).json({ success: false, message: 'Failed to update vendor.' });
    }
};

exports.deleteVendor = async (req, res) => {
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();
        const id = parseInt(req.params.id, 10);

        const [vendorRows] = await connection.query(
            'SELECT vendor_id, user_id FROM vendors WHERE vendor_id = ?', [id]
        );
        if (vendorRows.length === 0) {
            await connection.rollback();
            return res.status(404).json({ success: false, message: 'Vendor not found.' });
        }
        const userId = vendorRows[0].user_id;

        // Remove sales details linked to this vendor's orders
        await connection.query(
            'DELETE sd FROM sales_details sd JOIN sales s ON sd.sale_id = s.sale_id WHERE s.vendor_id = ?', [id]
        );
        // Remove sales records for this vendor
        await connection.query('DELETE FROM sales WHERE vendor_id = ?', [id]);
        // Remove the vendor profile
        await connection.query('DELETE FROM vendors WHERE vendor_id = ?', [id]);
        // Remove the user login account
        await connection.query('DELETE FROM users WHERE user_id = ?', [userId]);

        await connection.commit();
        return res.status(200).json({ success: true, message: 'Vendor account and all related records removed.' });
    } catch (error) {
        await connection.rollback();
        console.error('Delete vendor error:', error);
        return res.status(500).json({ success: false, message: 'Failed to delete vendor.' });
    } finally {
        connection.release();
    }
};

exports.getPublicVendorList = async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT v.vendor_id, v.vendor_name, v.location, u.email
            FROM vendors v
            JOIN users u ON v.user_id = u.user_id
            WHERE u.is_active = 1 OR u.is_active IS NULL
            ORDER BY v.vendor_name ASC
        `);
        return res.status(200).json({ success: true, data: rows });
    } catch (error) {
        console.error('Public vendor list error:', error);
        return res.status(500).json({ success: false, message: 'Failed to load vendor list.' });
    }
};

exports.getVendorBalances = async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT 
                v.vendor_id,
                v.vendor_name,
                v.phone_number,
                v.location,
                v.outstanding_balance,
                (SELECT COUNT(*) FROM sales s WHERE s.vendor_id = v.vendor_id AND s.payment_status != 'PAID') AS unpaid_orders_count
            FROM vendors v
            ORDER BY v.outstanding_balance DESC
        `);

        const totalOutstanding = rows.reduce((acc, curr) => acc + parseFloat(curr.outstanding_balance || 0), 0);

        return res.status(200).json({
            success: true,
            total_market_outstanding: totalOutstanding,
            count: rows.length,
            data: rows
        });
    } catch (error) {
        console.error('Vendor balance error:', error);
        return res.status(500).json({ success: false, message: 'Failed to retrieve vendor balances.' });
    }
};
