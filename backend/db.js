const mariadb = require('mariadb');
require('dotenv').config();

// Create a connection pool
const pool = mariadb.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    connectionLimit: 5 // can increase later
});

// Test the connection on startup
pool.getConnection()
    .then(conn => {
        console.log("✅ Securely connected to MariaDB!");
        conn.release(); // Return connection to the pool
    })
    .catch(err => {
        console.error("❌ Database connection failed: ", err);
    });

module.exports = pool;