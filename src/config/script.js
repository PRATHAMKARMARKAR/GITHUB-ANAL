const mysql = require("mysql2/promise");
require("dotenv").config();

const pool = mysql.createPool({
  uri: process.env.MYSQL_URL,  // e.g. mysql://user:pass@host:port/dbname
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  timezone: "+00:00",
  ssl: { rejectUnauthorized: false }, // required for Railway
});

async function testConnection() {
  try {
    const conn = await pool.getConnection();
    console.log("MySQL connected successfully");
    conn.release();
  } catch (err) {
    console.error("MySQL connection failed:", err.message);
    process.exit(1);
  }
}

module.exports = { pool, testConnection };