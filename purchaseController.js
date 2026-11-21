const db = require('../database/db');

exports.createPurchase = async (req, res) => {
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        const { supplier_id, items, notes } = req.body;

        if (!supplier_id || !items || !Array.isArray(items) || items.length === 0) {
            await connection.rollback();
            return res.status(400).json({
                success: false,
                message: 'Supplier ID and at least one purchase item are required.'
            });
        }

        const [supp] = await connection.query('SELECT supplier_id FROM suppliers WHERE supplier_id = ?', [supplier_id]);
        if (supp.length === 0) {
            await connection.rollback();
            return res.status(404).json({ success: false, message: 'Supplier not found.' });
        }

        let calculatedTotal = 0;
        const validItems = [];

        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            const { fruit_id, packaging_size, quantity, unit_cost } = item;

            if (!fruit_id || !packaging_size || !quantity || quantity <= 0) {
                await connection.rollback();
                return res.status(400).json({
                    success: false,
                    message: `Item #${i + 1} validation failed: fruit_id, valid packaging size (small, medium, large), and positive quantity are required.`
                });
            }

            if (!['small', 'medium', 'large'].includes(packaging_size.toLowerCase())) {
                await connection.rollback();
                return res.status(400).json({
                    success: false,
                    message: `Item #${i + 1}: Invalid packaging size "${packaging_size}". Allowed sizes: small, medium, large.`
                });
            }

            const [fruit] = await connection.query('SELECT fruit_id FROM fruits WHERE fruit_id = ?', [fruit_id]);
            if (fruit.length === 0) {
                await connection.rollback();
                return res.status(404).json({
                    success: false,
                    message: `Item #${i + 1}: Fruit ID ${fruit_id} does not exist.`
                });
            }

            let finalCost = parseFloat(unit_cost);
            if (isNaN(finalCost) || finalCost <= 0) {
                const [priceRow] = await connection.query(
                    'SELECT cost_price FROM fruit_pricing WHERE fruit_id = ? AND packaging_size = ?',
                    [fruit_id, packaging_size.toLowerCase()]
                );
                finalCost = priceRow.length > 0 ? parseFloat(priceRow[0].cost_price) : 50.00;
            }

            const itemSubtotal = finalCost * parseInt(quantity, 10);
            calculatedTotal += itemSubtotal;

            validItems.push({
                fruit_id,
                packaging_size: packaging_size.toLowerCase(),
                quantity: parseInt(quantity, 10),
                unit_cost: finalCost,
                subtotal: itemSubtotal
            });
        }

        const [purchaseResult] = await connection.query(
            'INSERT INTO purchases (supplier_id, purchase_date, total_amount, notes) VALUES (?, NOW(), ?, ?)',
            [supplier_id, calculatedTotal, notes || '']
        );

        const purchaseId = purchaseResult.insertId;

        for (const item of validItems) {
            await connection.query(
                'INSERT INTO purchase_details (purchase_id, fruit_id, packaging_size, quantity, unit_cost, subtotal) VALUES (?, ?, ?, ?, ?, ?)',
                [purchaseId, item.fruit_id, item.packaging_size, item.quantity, item.unit_cost, item.subtotal]
            );

            await connection.query(
                `INSERT INTO stock (fruit_id, packaging_size, available_quantity) 
                 VALUES (?, ?, ?)
                 ON DUPLICATE KEY UPDATE available_quantity = available_quantity + ?`,
                [item.fruit_id, item.packaging_size, item.quantity, item.quantity]
            );
        }

        await connection.commit();

        return res.status(201).json({
            success: true,
            message: 'Purchase recorded successfully and stock levels increased.',
            purchase_id: purchaseId,
            total_amount: calculatedTotal,
            items_count: validItems.length
        });
    } catch (error) {
        await connection.rollback();
        console.error('Record purchase transaction error:', error);
        return res.status(500).json({ success: false, message: 'Failed to record purchase. Transaction rolled back.' });
    } finally {
        connection.release();
    }
};

exports.getAllPurchases = async (req, res) => {
    try {
        const [purchases] = await db.query(`
            SELECT 
                p.purchase_id,
                p.supplier_id,
                s.business_name AS supplier_name,
                s.province,
                p.purchase_date,
                p.total_amount,
                p.notes,
                (SELECT COUNT(*) FROM purchase_details pd WHERE pd.purchase_id = p.purchase_id) AS total_items,
                (SELECT IFNULL(SUM(pd.quantity), 0) FROM purchase_details pd WHERE pd.purchase_id = p.purchase_id) AS total_boxes_received
            FROM purchases p
            JOIN suppliers s ON p.supplier_id = s.supplier_id
            ORDER BY p.purchase_date DESC
        `);

        return res.status(200).json({ success: true, count: purchases.length, data: purchases });
    } catch (error) {
        console.error('Get purchases error:', error);
        return res.status(500).json({ success: false, message: 'Failed to retrieve purchases.' });
    }
};
