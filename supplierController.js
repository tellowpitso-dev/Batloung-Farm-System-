const db = require('../database/db');

exports.createSupplier = async (req, res) => {
    try {
        const { business_name, contact_person, phone, province, address } = req.body;

        if (!business_name || !contact_person || !phone || !province || !address) {
            return res.status(400).json({ success: false, message: 'All supplier details are required.' });
        }

        const validProvinces = ['Gauteng', 'Free State', 'KwaZulu-Natal', 'Western Cape', 'Eastern Cape', 'Limpopo', 'Mpumalanga', 'North West'];
        if (!validProvinces.includes(province)) {
            return res.status(400).json({ success: false, message: 'Province must be a valid South African province.' });
        }

        const [result] = await db.query(
            'INSERT INTO suppliers (business_name, contact_person, phone, province, address) VALUES (?, ?, ?, ?, ?)',
            [business_name, contact_person, phone, province, address]
        );

        return res.status(201).json({
            success: true,
            message: 'Supplier registered successfully.',
            supplier_id: result.insertId
        });
    } catch (error) {
        console.error('Create supplier error:', error);
        return res.status(500).json({ success: false, message: 'Failed to register supplier.' });
    }
};

exports.getAllSuppliers = async (req, res) => {
    try {
        const [rows] = await db.query('SELECT * FROM suppliers ORDER BY business_name ASC');
        return res.status(200).json({ success: true, count: rows.length, data: rows });
    } catch (error) {
        console.error('Get suppliers error:', error);
        return res.status(500).json({ success: false, message: 'Failed to retrieve suppliers.' });
    }
};

exports.getSupplierById = async (req, res) => {
    try {
        const id = parseInt(req.params.id, 10);
        const [rows] = await db.query('SELECT * FROM suppliers WHERE supplier_id = ?', [id]);

        if (rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Supplier not found.' });
        }

        return res.status(200).json({ success: true, data: rows[0] });
    } catch (error) {
        console.error('Get supplier by ID error:', error);
        return res.status(500).json({ success: false, message: 'Failed to retrieve supplier.' });
    }
};

exports.updateSupplier = async (req, res) => {
    try {
        const id = parseInt(req.params.id, 10);
        const { business_name, contact_person, phone, province, address } = req.body;

        const [existing] = await db.query('SELECT supplier_id FROM suppliers WHERE supplier_id = ?', [id]);
        if (existing.length === 0) {
            return res.status(404).json({ success: false, message: 'Supplier does not exist.' });
        }

        await db.query(
            'UPDATE suppliers SET business_name = ?, contact_person = ?, phone = ?, province = ?, address = ? WHERE supplier_id = ?',
            [business_name, contact_person, phone, province, address, id]
        );

        return res.status(200).json({ success: true, message: 'Supplier updated successfully.' });
    } catch (error) {
        console.error('Update supplier error:', error);
        return res.status(500).json({ success: false, message: 'Failed to update supplier.' });
    }
};

exports.deleteSupplier = async (req, res) => {
    try {
        const id = parseInt(req.params.id, 10);

        const [purchases] = await db.query('SELECT purchase_id FROM purchases WHERE supplier_id = ? LIMIT 1', [id]);
        if (purchases.length > 0) {
            return res.status(400).json({
                success: false,
                message: 'Cannot delete supplier with active recorded purchase transactions in the system.'
            });
        }

        const [result] = await db.query('DELETE FROM suppliers WHERE supplier_id = ?', [id]);
        if (result.affectedRows === 0) {
            return res.status(404).json({ success: false, message: 'Supplier not found.' });
        }

        return res.status(200).json({ success: true, message: 'Supplier deleted successfully.' });
    } catch (error) {
        console.error('Delete supplier error:', error);
        return res.status(500).json({ success: false, message: 'Failed to delete supplier.' });
    }
};
