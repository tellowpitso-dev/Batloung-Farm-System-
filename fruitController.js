const db = require('../database/db');

exports.createFruit = async (req, res) => {
    try {
        const { fruit_name, description, pricing } = req.body;

        if (!fruit_name) {
            return res.status(400).json({ success: false, message: 'Fruit name is required.' });
        }

        const [result] = await db.query(
            'INSERT INTO fruits (fruit_name, description) VALUES (?, ?)',
            [fruit_name, description || '']
        );

        const fruitId = result.insertId;

        const sizes = ['small', 'medium', 'large'];
        for (const size of sizes) {
            const priceConfig = (pricing && pricing[size]) || { cost: 50.00, sell: 75.00 };
            await db.query(
                'INSERT INTO fruit_pricing (fruit_id, packaging_size, cost_price, selling_price) VALUES (?, ?, ?, ?)',
                [fruitId, size, priceConfig.cost || 50.00, priceConfig.sell || 75.00]
            );
            await db.query(
                'INSERT INTO stock (fruit_id, packaging_size, available_quantity, reorder_level) VALUES (?, ?, 0, 15)',
                [fruitId, size]
            );
        }

        return res.status(201).json({
            success: true,
            message: 'Fruit type registered with small, medium, and large packaging stock tracking.',
            fruit_id: fruitId
        });
    } catch (error) {
        console.error('Create fruit error:', error);
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({ success: false, message: 'Fruit name already exists in the system.' });
        }
        return res.status(500).json({ success: false, message: 'Failed to create fruit type.' });
    }
};

exports.getAllFruits = async (req, res) => {
    try {
        const [fruits] = await db.query('SELECT * FROM fruits WHERE status = "active" ORDER BY fruit_name ASC');
        const [pricing] = await db.query('SELECT * FROM fruit_pricing');
        const [stock] = await db.query('SELECT * FROM stock');

        const fruitList = fruits.map(f => {
            const fruitPrices = pricing.filter(p => p.fruit_id === f.fruit_id);
            const fruitStock = stock.filter(s => s.fruit_id === f.fruit_id);

            const packaging = ['small', 'medium', 'large'].map(size => {
                const p = fruitPrices.find(x => x.packaging_size === size) || { selling_price: 0, cost_price: 0 };
                const s = fruitStock.find(x => x.packaging_size === size) || { available_quantity: 0, reorder_level: 15 };
                return {
                    packaging_size: size,
                    selling_price: parseFloat(p.selling_price),
                    cost_price: parseFloat(p.cost_price),
                    available_quantity: s.available_quantity,
                    is_low_stock: s.available_quantity <= s.reorder_level
                };
            });

            return {
                fruit_id: f.fruit_id,
                fruit_name: f.fruit_name,
                description: f.description,
                status: f.status,
                packaging
            };
        });

        return res.status(200).json({ success: true, count: fruitList.length, data: fruitList });
    } catch (error) {
        console.error('Get fruits error:', error);
        return res.status(500).json({ success: false, message: 'Failed to retrieve fruits.' });
    }
};

exports.updateFruit = async (req, res) => {
    try {
        const id = parseInt(req.params.id, 10);
        const { fruit_name, description, status, pricing } = req.body;

        const [existing] = await db.query('SELECT fruit_id FROM fruits WHERE fruit_id = ?', [id]);
        if (existing.length === 0) {
            return res.status(404).json({ success: false, message: 'Fruit not found.' });
        }

        await db.query(
            'UPDATE fruits SET fruit_name = ?, description = ?, status = ? WHERE fruit_id = ?',
            [fruit_name, description, status || 'active', id]
        );

        if (pricing) {
            for (const size of ['small', 'medium', 'large']) {
                if (pricing[size]) {
                    await db.query(
                        'UPDATE fruit_pricing SET selling_price = ?, cost_price = ? WHERE fruit_id = ? AND packaging_size = ?',
                        [pricing[size].selling_price, pricing[size].cost_price, id, size]
                    );
                }
            }
        }

        return res.status(200).json({ success: true, message: 'Fruit details updated successfully.' });
    } catch (error) {
        console.error('Update fruit error:', error);
        return res.status(500).json({ success: false, message: 'Failed to update fruit.' });
    }
};

exports.getStockLevels = async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT 
                s.stock_id,
                f.fruit_id,
                f.fruit_name,
                s.packaging_size,
                s.available_quantity,
                s.reorder_level,
                p.selling_price,
                p.cost_price,
                (s.available_quantity * p.selling_price) AS estimated_stock_value,
                CASE WHEN s.available_quantity <= s.reorder_level THEN 1 ELSE 0 END AS is_low_stock
            FROM stock s
            JOIN fruits f ON s.fruit_id = f.fruit_id
            JOIN fruit_pricing p ON s.fruit_id = p.fruit_id AND s.packaging_size = p.packaging_size
            ORDER BY f.fruit_name ASC, 
                     FIELD(s.packaging_size, 'small', 'medium', 'large') ASC
        `);

        return res.status(200).json({ success: true, count: rows.length, data: rows });
    } catch (error) {
        console.error('Get stock levels error:', error);
        return res.status(500).json({ success: false, message: 'Failed to retrieve stock levels.' });
    }
};

exports.getLowStockFruits = async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT 
                f.fruit_id,
                f.fruit_name,
                s.packaging_size,
                s.available_quantity,
                s.reorder_level,
                (s.reorder_level - s.available_quantity) AS shortage_amount
            FROM stock s
            JOIN fruits f ON s.fruit_id = f.fruit_id
            WHERE s.available_quantity <= s.reorder_level
            ORDER BY s.available_quantity ASC
        `);

        return res.status(200).json({
            success: true,
            count: rows.length,
            message: rows.length > 0 ? 'Low stock detected for fruit packaging sizes.' : 'All stock levels are optimal.',
            data: rows
        });
    } catch (error) {
        console.error('Low stock query error:', error);
        return res.status(500).json({ success: false, message: 'Failed to identify low stock fruits.' });
    }
};
