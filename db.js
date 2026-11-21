const mysql = require('mysql2/promise');
const dotenv = require('dotenv');

dotenv.config();

const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'itsyobouyT06',
    database: process.env.DB_NAME || 'batloung_farm_db',
    port: parseInt(process.env.DB_PORT, 10) || 3306,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    enableKeepAlive: true,
    keepAliveInitialDelay: 0
});

async function checkConnection() {
    try {
        const connection = await pool.getConnection();
        console.log(`[DATABASE] Connected to MySQL (${process.env.DB_NAME || 'batloung_farm_db'}) at port ${process.env.DB_PORT || 3306}`);
        connection.release();
    } catch (err) {
        console.error('[DATABASE WARNING] Could not connect to MySQL server:', err.message);
        console.error('[HINT] Ensure MySQL Server is running and the database script has been executed in MySQL Workbench.');
    }
}

checkConnection();

module.exports = pool;
