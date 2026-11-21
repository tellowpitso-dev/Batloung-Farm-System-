const db = require('../database/db');

function calculateHaversineDistance(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return parseFloat((R * c).toFixed(2));
}

exports.createSale = async (req, res) => {
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        let {
            vendor_id,
            items,
            payment_method,
            payment_status,
            amount_paid,
            delivery_type,
            delivery_lat,
            delivery_lng,
            notes
        } = req.body;

        if (req.user && req.user.role === 'vendor') {
            const [vRow] = await connection.query('SELECT vendor_id FROM vendors WHERE user_id = ?', [req.user.userId]);
            if (vRow.length === 0) {
                await connection.rollback();
                return res.status(403).json({ success: false, message: 'Vendor profile not found for this account.' });
            }
            vendor_id = vRow[0].vendor_id;
        }

        if (!vendor_id || !items || !Array.isArray(items) || items.length === 0) {
            await connection.rollback();
            return res.status(400).json({
                success: false,
                message: 'Vendor ID and at least one order fruit item are required.'
            });
        }

        const [vendorRows] = await connection.query('SELECT * FROM vendors WHERE vendor_id = ?', [vendor_id]);
        if (vendorRows.length === 0) {
            await connection.rollback();
            return res.status(404).json({ success: false, message: 'Selected vendor does not exist.' });
        }
        const vendor = vendorRows[0];

        const destLat = delivery_lat !== undefined && delivery_lat !== null ? parseFloat(delivery_lat) : parseFloat(vendor.latitude);
        const destLng = delivery_lng !== undefined && delivery_lng !== null ? parseFloat(delivery_lng) : parseFloat(vendor.longitude);

        const depotLat = parseFloat(process.env.DEPOT_LAT || '-29.3100');
        const depotLng = parseFloat(process.env.DEPOT_LNG || '27.4800');

        const distanceKm = calculateHaversineDistance(depotLat, depotLng, destLat, destLng);
        const estimatedMinutes = Math.max(5, Math.round((distanceKm / 18) * 60 + 8));

        let calculatedTotal = 0;
        const processedItems = [];

        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            const fruit_id = item.fruit_id;
            const packaging_size = item.packaging_size;
            const rawQty = item.quantity !== undefined ? item.quantity : item.quantity_boxes;
            const quantity = parseInt(rawQty, 10);

            if (!fruit_id || !packaging_size || isNaN(quantity) || quantity <= 0) {
                await connection.rollback();
                return res.status(400).json({
                    success: false,
                    message: `Item #${i + 1}: Invalid fruit ID, packaging size, or quantity.`
                });
            }

            const size = packaging_size.toLowerCase();
            if (!['small', 'medium', 'large'].includes(size)) {
                await connection.rollback();
                return res.status(400).json({
                    success: false,
                    message: `Item #${i + 1}: Invalid packaging size "${packaging_size}". Allowed sizes: small, medium, large.`
                });
            }

            const [stockRows] = await connection.query(
                'SELECT s.available_quantity, f.fruit_name FROM stock s JOIN fruits f ON s.fruit_id = f.fruit_id WHERE s.fruit_id = ? AND s.packaging_size = ? FOR UPDATE',
                [fruit_id, size]
            );

            if (stockRows.length === 0) {
                await connection.rollback();
                return res.status(404).json({
                    success: false,
                    message: `No stock record found for Fruit ID ${fruit_id} (${size} packaging).`
                });
            }

            const availableQty = stockRows[0].available_quantity;
            const fruitName = stockRows[0].fruit_name;
            const requestedQty = parseInt(quantity, 10);

            // Reject entire sale if requested quantity is more than available stock
            if (requestedQty > availableQty) {
                await connection.rollback();
                return res.status(400).json({
                    success: false,
                    error_code: 'INSUFFICIENT_STOCK',
                    message: `Sale rejected: Requested ${requestedQty} ${size} boxes of ${fruitName}, but only ${availableQty} ${size} boxes are currently available. No stock was deducted.`
                });
            }

            const [priceRows] = await connection.query(
                'SELECT selling_price FROM fruit_pricing WHERE fruit_id = ? AND packaging_size = ?',
                [fruit_id, size]
            );

            const unitPrice = priceRows.length > 0 ? parseFloat(priceRows[0].selling_price) : 65.00;
            const itemSubtotal = unitPrice * requestedQty;
            calculatedTotal += itemSubtotal;

            processedItems.push({
                fruit_id,
                packaging_size: size,
                quantity: requestedQty,
                unit_price: unitPrice,
                subtotal: itemSubtotal
            });
        }

        const method = payment_method || 'Cash';
        let paid = parseFloat(amount_paid || 0);

        const isVendorUser = req.user && req.user.role === 'vendor';
        const initialStatus = isVendorUser ? 'pending' : (req.body.order_status || 'confirmed');

        if (payment_status === 'PAID') {
            paid = calculatedTotal;
        }

        const balance = Math.max(0, calculatedTotal - paid);

        let finalPaymentStatus = 'UNPAID';
        if (paid >= calculatedTotal && calculatedTotal > 0) {
            finalPaymentStatus = 'PAID';
        } else if (paid > 0 && paid < calculatedTotal) {
            finalPaymentStatus = 'PARTIALLY_PAID';
        } else if (method === 'Credit') {
            finalPaymentStatus = 'UNPAID';
        }

        const [saleResult] = await connection.query(`
            INSERT INTO sales (
                vendor_id, sale_date, order_status, payment_status, payment_method,
                amount_paid, total_amount, balance_amount, delivery_type,
                delivery_lat, delivery_lng, distance_km, estimated_time_mins, notes
            ) VALUES (?, NOW(), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            vendor_id,
            initialStatus,
            finalPaymentStatus,
            method,
            paid,
            calculatedTotal,
            balance,
            delivery_type || 'delivery',
            destLat,
            destLng,
            distanceKm,
            estimatedMinutes,
            notes || ''
        ]);

        const saleId = saleResult.insertId;

        for (const item of processedItems) {
            await connection.query(
                'INSERT INTO sales_details (sale_id, fruit_id, packaging_size, quantity, unit_price, subtotal) VALUES (?, ?, ?, ?, ?, ?)',
                [saleId, item.fruit_id, item.packaging_size, item.quantity, item.unit_price, item.subtotal]
            );

            await connection.query(
                'UPDATE stock SET available_quantity = available_quantity - ? WHERE fruit_id = ? AND packaging_size = ?',
                [item.quantity, item.fruit_id, item.packaging_size]
            );
        }

        if (balance > 0) {
            await connection.query(
                'UPDATE vendors SET outstanding_balance = outstanding_balance + ? WHERE vendor_id = ?',
                [balance, vendor_id]
            );
        }

        await connection.commit();

        return res.status(201).json({
            success: true,
            message: isVendorUser
                ? 'Order submitted successfully. Your order is pending confirmation from the administrator.'
                : 'Sale recorded successfully and stock levels updated.',
            sale_id: saleId,
            order_status: initialStatus,
            total_amount: calculatedTotal,
            amount_paid: paid,
            balance_amount: balance,
            payment_status: finalPaymentStatus,
            distance_km: distanceKm,
            estimated_time_mins: estimatedMinutes
        });
    } catch (error) {
        await connection.rollback();
        console.error('Record sale transaction error:', error);
        return res.status(500).json({ success: false, message: 'Failed to record sale. Transaction rolled back.' });
    } finally {
        connection.release();
    }
};

exports.getAllSales = async (req, res) => {
    try {
        let sql = `
            SELECT 
                s.sale_id,
                s.vendor_id,
                v.vendor_name,
                v.phone_number,
                v.location,
                s.sale_date,
                s.order_status,
                s.payment_status,
                s.payment_method,
                s.amount_paid,
                s.total_amount,
                s.balance_amount,
                s.delivery_type,
                s.delivery_lat,
                s.delivery_lng,
                s.distance_km,
                s.estimated_time_mins,
                s.batch_photo_url,
                s.batch_inspection_notes,
                s.notes,
                (SELECT COUNT(*) FROM sales_details sd WHERE sd.sale_id = s.sale_id) AS total_items,
                (SELECT IFNULL(SUM(sd.quantity), 0) FROM sales_details sd WHERE sd.sale_id = s.sale_id) AS total_boxes_ordered,
                (SELECT GROUP_CONCAT(CONCAT(f.fruit_name, ' - ', sd.packaging_size, ' box x', sd.quantity) SEPARATOR ', ')
                 FROM sales_details sd
                 JOIN fruits f ON sd.fruit_id = f.fruit_id
                 WHERE sd.sale_id = s.sale_id) AS items_summary
            FROM sales s
            JOIN vendors v ON s.vendor_id = v.vendor_id
        `;

        const params = [];

        if (req.user && req.user.role === 'vendor') {
            sql += ' WHERE v.user_id = ?';
            params.push(req.user.userId);
        }

        sql += ' ORDER BY s.sale_date DESC';

        const [rows] = await db.query(sql, params);
        return res.status(200).json({ success: true, count: rows.length, data: rows });
    } catch (error) {
        console.error('Get sales error:', error);
        return res.status(500).json({ success: false, message: 'Failed to retrieve sales records.' });
    }
};

exports.getSaleById = async (req, res) => {
    try {
        const id = parseInt(req.params.id, 10);
        const [sales] = await db.query(`
            SELECT 
                s.*,
                v.vendor_name,
                v.phone_number,
                v.location,
                v.outstanding_balance
            FROM sales s
            JOIN vendors v ON s.vendor_id = v.vendor_id
            WHERE s.sale_id = ?
        `, [id]);

        if (sales.length === 0) {
            return res.status(404).json({ success: false, message: 'Sale order not found.' });
        }

        const [items] = await db.query(`
            SELECT 
                sd.detail_id,
                sd.fruit_id,
                sd.packaging_size,
                sd.quantity,
                sd.quantity AS quantity_boxes,
                sd.unit_price,
                sd.subtotal,
                f.fruit_name
            FROM sales_details sd
            JOIN fruits f ON sd.fruit_id = f.fruit_id
            WHERE sd.sale_id = ?
        `, [id]);

        return res.status(200).json({
            success: true,
            sale: sales[0],
            data: { ...sales[0], vendor_id: sales[0].vendor_id, items },
            items
        });
    } catch (error) {
        console.error('Get sale by ID error:', error);
        return res.status(500).json({ success: false, message: 'Failed to retrieve sale details.' });
    }
};

exports.updateOrderStatus = async (req, res) => {
    try {
        const id = parseInt(req.params.id, 10);
        const { order_status } = req.body;

        const validStatuses = ['pending', 'confirmed', 'processing', 'out_for_delivery', 'ready_for_collection', 'delivered', 'cancelled'];
        if (!validStatuses.includes(order_status)) {
            return res.status(400).json({
                success: false,
                message: `Invalid order status. Allowed: ${validStatuses.join(', ')}`
            });
        }

        const [result] = await db.query('UPDATE sales SET order_status = ? WHERE sale_id = ?', [order_status, id]);
        if (result.affectedRows === 0) {
            return res.status(404).json({ success: false, message: 'Order not found.' });
        }

        return res.status(200).json({
            success: true,
            message: `Order #${id} status updated to "${order_status}".`,
            order_status
        });
    } catch (error) {
        console.error('Update status error:', error);
        return res.status(500).json({ success: false, message: 'Failed to update order status.' });
    }
};

exports.recordPayment = async (req, res) => {
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        const id = parseInt(req.params.id, 10);
        const { payment_amount, payment_method } = req.body;

        const payAmount = parseFloat(payment_amount);
        if (isNaN(payAmount) || payAmount <= 0) {
            await connection.rollback();
            return res.status(400).json({ success: false, message: 'A valid positive payment amount is required.' });
        }

        const [sales] = await connection.query('SELECT * FROM sales WHERE sale_id = ?', [id]);
        if (sales.length === 0) {
            await connection.rollback();
            return res.status(404).json({ success: false, message: 'Sale not found.' });
        }

        const sale = sales[0];
        const newPaid = parseFloat(sale.amount_paid) + payAmount;
        const newBalance = Math.max(0, parseFloat(sale.total_amount) - newPaid);

        let newStatus = 'PARTIALLY_PAID';
        if (newBalance === 0) newStatus = 'PAID';

        await connection.query(`
            UPDATE sales 
            SET amount_paid = ?, balance_amount = ?, payment_status = ?, payment_method = ?
            WHERE sale_id = ?
        `, [newPaid, newBalance, newStatus, payment_method || sale.payment_method, id]);

        await connection.query(
            'UPDATE vendors SET outstanding_balance = GREATEST(0, outstanding_balance - ?) WHERE vendor_id = ?',
            [payAmount, sale.vendor_id]
        );

        await connection.commit();

        return res.status(200).json({
            success: true,
            message: 'Payment recorded successfully.',
            amount_paid: newPaid,
            balance_amount: newBalance,
            payment_status: newStatus
        });
    } catch (error) {
        await connection.rollback();
        console.error('Record payment error:', error);
        return res.status(500).json({ success: false, message: 'Failed to record payment.' });
    } finally {
        connection.release();
    }
};

exports.updateBatchPhoto = async (req, res) => {
    try {
        const id = parseInt(req.params.id, 10);
        const { batch_photo_url, batch_inspection_notes } = req.body;

        if (!batch_photo_url) {
            return res.status(400).json({ success: false, message: 'Batch photo URL is required.' });
        }

        await db.query(
            'UPDATE sales SET batch_photo_url = ?, batch_inspection_notes = ? WHERE sale_id = ?',
            [
                batch_photo_url,
                batch_inspection_notes || 'Depot QC Inspection: Crates verified and sealed before driver departure.',
                id
            ]
        );

        return res.status(200).json({
            success: true,
            message: 'Real batch inspection photo attached to order successfully.'
        });
    } catch (error) {
        console.error('Update batch photo error:', error);
        return res.status(500).json({ success: false, message: 'Failed to attach batch photo.' });
    }
};
