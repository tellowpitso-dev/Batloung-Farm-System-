const db = require('../database/db');

exports.getTopFiveFruits = async (req, res) => {
    try {
        const query = `
            SELECT 
                f.fruit_id,
                f.fruit_name,
                IFNULL(SUM(sd.quantity), 0) AS total_boxes_sold,
                IFNULL(SUM(sd.subtotal), 0) AS total_sales_revenue,
                COUNT(DISTINCT sd.sale_id) AS orders_count
            FROM fruits f
            JOIN sales_details sd ON f.fruit_id = sd.fruit_id
            JOIN sales s ON sd.sale_id = s.sale_id
            WHERE s.order_status != 'cancelled'
            GROUP BY f.fruit_id, f.fruit_name
            ORDER BY total_boxes_sold DESC
            LIMIT 5
        `;

        const [rows] = await db.query(query);

        return res.status(200).json({
            success: true,
            title: 'Top 5 Most Frequently Sold Fruits',
            count: rows.length,
            data: rows
        });
    } catch (error) {
        console.error('Top fruits report error:', error);
        return res.status(500).json({ success: false, message: 'Failed to retrieve top 5 fruits report.' });
    }
};

exports.getSalesRevenueByDateRange = async (req, res) => {
    try {
        const { start_date, end_date } = req.query;

        const startDate = start_date || new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
        const endDate = end_date || new Date().toISOString().split('T')[0];

        const query = `
            SELECT 
                COUNT(sale_id) AS total_sales_count,
                IFNULL(SUM(total_amount), 0) AS total_revenue_generated,
                IFNULL(SUM(amount_paid), 0) AS total_cash_collected,
                IFNULL(SUM(balance_amount), 0) AS total_uncollected_credit,
                IFNULL(AVG(total_amount), 0) AS average_order_value,
                DATE(?) AS range_start_date,
                DATE(?) AS range_end_date
            FROM sales
            WHERE DATE(sale_date) BETWEEN ? AND ?
              AND order_status != 'cancelled'
        `;

        const [summaryRows] = await db.query(query, [startDate, endDate, startDate, endDate]);

        const [dailyRows] = await db.query(`
            SELECT 
                DATE(sale_date) AS sale_day,
                COUNT(sale_id) AS orders_count,
                IFNULL(SUM(total_amount), 0) AS daily_revenue
            FROM sales
            WHERE DATE(sale_date) BETWEEN ? AND ?
              AND order_status != 'cancelled'
            GROUP BY DATE(sale_date)
            ORDER BY sale_day ASC
        `, [startDate, endDate]);

        return res.status(200).json({
            success: true,
            title: 'Sales Revenue by Date Range',
            summary: summaryRows[0],
            daily_breakdown: dailyRows
        });
    } catch (error) {
        console.error('Revenue date range report error:', error);
        return res.status(500).json({ success: false, message: 'Failed to retrieve sales revenue report.' });
    }
};

exports.getTopVendorByBoxes = async (req, res) => {
    try {
        const query = `
            SELECT 
                v.vendor_id,
                v.vendor_name,
                v.phone_number,
                v.location,
                IFNULL(SUM(sd.quantity), 0) AS total_boxes_purchased,
                IFNULL(SUM(sd.subtotal), 0) AS total_amount_spent,
                COUNT(DISTINCT s.sale_id) AS total_orders_completed
            FROM vendors v
            JOIN sales s ON v.vendor_id = s.vendor_id
            JOIN sales_details sd ON s.sale_id = sd.sale_id
            WHERE s.order_status != 'cancelled'
            GROUP BY v.vendor_id, v.vendor_name, v.phone_number, v.location
            ORDER BY total_boxes_purchased DESC
            LIMIT 1
        `;

        const [rows] = await db.query(query);

        const [leaderboard] = await db.query(`
            SELECT 
                v.vendor_id,
                v.vendor_name,
                v.location,
                IFNULL(SUM(sd.quantity), 0) AS total_boxes_purchased,
                IFNULL(SUM(sd.subtotal), 0) AS total_amount_spent
            FROM vendors v
            JOIN sales s ON v.vendor_id = s.vendor_id
            JOIN sales_details sd ON s.sale_id = sd.sale_id
            WHERE s.order_status != 'cancelled'
            GROUP BY v.vendor_id, v.vendor_name, v.location
            ORDER BY total_boxes_purchased DESC
            LIMIT 5
        `);

        return res.status(200).json({
            success: true,
            title: 'Vendor with Highest Boxes Purchased',
            top_vendor: rows.length > 0 ? rows[0] : null,
            leaderboard
        });
    } catch (error) {
        console.error('Top vendor report error:', error);
        return res.status(500).json({ success: false, message: 'Failed to retrieve top vendor report.' });
    }
};

exports.getCurrentStockLevels = async (req, res) => {
    try {
        const query = `
            SELECT 
                f.fruit_id,
                f.fruit_name,
                s.packaging_size,
                s.available_quantity,
                s.reorder_level,
                p.cost_price,
                p.selling_price,
                (s.available_quantity * p.selling_price) AS potential_sales_value,
                CASE 
                    WHEN s.available_quantity = 0 THEN 'OUT_OF_STOCK'
                    WHEN s.available_quantity <= s.reorder_level THEN 'LOW_STOCK'
                    ELSE 'HEALTHY'
                END AS stock_status
            FROM stock s
            JOIN fruits f ON s.fruit_id = f.fruit_id
            JOIN fruit_pricing p ON s.fruit_id = p.fruit_id AND s.packaging_size = p.packaging_size
            ORDER BY f.fruit_name ASC, FIELD(s.packaging_size, 'small', 'medium', 'large') ASC
        `;

        const [rows] = await db.query(query);

        const totalBoxesInWarehouse = rows.reduce((acc, curr) => acc + parseInt(curr.available_quantity, 10), 0);
        const totalPotentialValue = rows.reduce((acc, curr) => acc + parseFloat(curr.potential_sales_value), 0);

        return res.status(200).json({
            success: true,
            title: 'Current Stock Levels by Fruit and Packaging Size',
            metrics: {
                total_boxes_in_warehouse: totalBoxesInWarehouse,
                total_warehouse_value: totalPotentialValue,
                total_combinations_tracked: rows.length
            },
            data: rows
        });
    } catch (error) {
        console.error('Stock report error:', error);
        return res.status(500).json({ success: false, message: 'Failed to retrieve stock levels report.' });
    }
};
