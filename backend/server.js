const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const pool = require('./db');
const verifyToken = require('./middleware/auth');
const multer = require('multer');
const sharp = require('sharp');
const tesseract = require('node-tesseract-ocr');
const fs = require('fs');

// Configure Multer to save uploaded images to a temporary "uploads" folder
const upload = multer({ dest: 'uploads/' });

const app = express();
const PORT = 3000;

// Middleware
app.use(cors({
    origin: '*', // Allows all origins (fine for development)
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json()); // Allows us to receive JSON data

// REGISTER A NEW USER
app.post('/api/register', async (req, res) => {
    const { name, email, password, role } = req.body;
    let conn;

    try {
        //Scramble the password using bcrypt
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // Save the user to MariaDB
        conn = await pool.getConnection();
        const result = await conn.query(
            "INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)",
            [name, email, hashedPassword, role || 'user']
        );

        res.status(201).json({
            message: "User created successfully!",
            userId: Number(result.insertId)
        });

    } catch (err) {
        console.error(err);
        // Error 1062 is MariaDB's code for "Duplicate Entry" (email already exists)
        if (err.errno === 1062) {
            res.status(400).json({ error: "Email already exists." });
        } else {
            res.status(500).json({ error: "Database error" });
        }
    } finally {
        if (conn) conn.release();
    }
});

// LOGIN A USER
app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;
    let conn;

    try {
        conn = await pool.getConnection();

        //Find the user by email in the database
        const rows = await conn.query("SELECT * FROM users WHERE email = ?", [email]);

        // If the array is empty, the user doesn't exist
        if (rows.length === 0) {
            return res.status(401).json({ error: "Invalid credentials." });
        }

        const user = rows[0];

        // Compare the typed password with the scrambled password in the database
        const validPassword = await bcrypt.compare(password, user.password_hash);
        if (!validPassword) {
            return res.status(401).json({ error: "Invalid credentials." });
        }
        // We pack the user's ID and Role inside the ticket.
        const token = jwt.sign(
            { id: Number(user.id), role: user.role },
            process.env.JWT_SECRET
        );

        // Hand the ticket to the user
        res.json({
            message: "Login successful!",
            token: token,
            user: {
                id: Number(user.id),
                name: user.name,
                role: user.role
            }
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Server error during login." });
    } finally {
        if (conn) conn.release();
    }
});

// GET ALL TO-DOS FOR THE LOGGED-IN USER
app.get('/api/todos', verifyToken, async (req, res) => {
    const userId = req.user.id;
    let conn;

    try {
        conn = await pool.getConnection();
        const rows = await conn.query(
            "SELECT * FROM todos WHERE user_id = ? ORDER BY created_at DESC",
            [userId]
        );
        res.json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to fetch To-Dos." });
    } finally {
        if (conn) conn.release();
    }
});

// CREATE A NEW TO-DO
app.post('/api/todos', verifyToken, async (req, res) => {
    const { task } = req.body;

    // The function (verifyToken) attached the user's ID to req.user!
    const userId = req.user.id;
    let conn;

    try {
        conn = await pool.getConnection();
        const result = await conn.query(
            "INSERT INTO todos (user_id, task) VALUES (?, ?)",
            [userId, task]
        );

        res.status(201).json({
            message: "To-Do added successfully!",
            todoId: Number(result.insertId)
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to add To-Do." });
    } finally {
        if (conn) conn.release();
    }
});

app.delete('/api/todos/:id', verifyToken, async (req, res) => {
    const { id } = req.params;
    const userId = req.user.id;
    let conn;
    try {
        conn = await pool.getConnection();
        await conn.query("DELETE FROM todos WHERE id = ? AND user_id = ?", [id, userId]);
        res.json({ message: "Deleted successfully" });
    } catch (err) {
        res.status(500).json({ error: "Delete failed" });
    } finally {
        if (conn) conn.release();
    }
});

// BULK SYNC TO-DOS
app.post('/api/todos/sync', verifyToken, async (req, res) => {
    const { todos } = req.body; // Expecting an array of to-do objects
    const userId = req.user.id;
    let conn;

    try {
        conn = await pool.getConnection();

        const results = [];
        for (let todo of todos) {
            // We use INSERT ... ON DUPLICATE KEY UPDATE (Upsert)
            // This prevents creating the same to-do twice if a sync happens twice
            const res = await conn.query(
                "INSERT INTO todos (user_id, task, is_completed) VALUES (?, ?, ?) " +
                "ON DUPLICATE KEY UPDATE task=VALUES(task), is_completed=VALUES(is_completed)",
                [userId, todo.task, todo.is_completed || false]
            );
            results.push({ local_id: todo.id, server_id: Number(res.insertId) });
        }

        res.json({ message: "Sync complete", synced: results });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Sync failed" });
    } finally {
        if (conn) conn.release();
    }
});

// 1. EDIT A TO-DO
app.put('/api/todos/:id', verifyToken, async (req, res) => {
    const { id } = req.params;
    const { task, is_completed } = req.body;
    const userId = req.user.id;
    let conn;
    try {
        conn = await pool.getConnection();
        await conn.query(
            "UPDATE todos SET task = ?, is_completed = ? WHERE id = ? AND user_id = ?",
            [task, is_completed, id, userId]
        );
        res.json({ message: "To-Do updated successfully" });
    } catch (err) {
        res.status(500).json({ error: "Failed to update To-Do" });
    } finally {
        if (conn) conn.release();
    }
});

// SAVE WORK HOURS
app.post('/api/work-hours', verifyToken, async (req, res) => {
    const { work_date, punch_in, punch_out, break_minutes } = req.body;
    const userId = req.user.id;
    let conn;

    try {
        conn = await pool.getConnection();
        await conn.query(
            "INSERT INTO work_hours (user_id, work_date, punch_in, punch_out, break_minutes) VALUES (?, ?, ?, ?, ?)",
            [userId, work_date, punch_in, punch_out, break_minutes || 0]
        );
        res.status(201).json({ message: "Work hours logged!" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Database error" });
    } finally {
        if (conn) conn.release();
    }
});

// TO LOAD THE HISTORY OF WORK HOURS FOR THE LOGGED-IN USER
app.get('/api/work-hours', verifyToken, async (req, res) => {
    const userId = req.user.id;
    let conn;
    try {
        conn = await pool.getConnection();
        const rows = await conn.query(
            "SELECT * FROM work_hours WHERE user_id = ? ORDER BY work_date DESC",
            [userId]
        );
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: "Failed to fetch hours." });
    } finally {
        if (conn) conn.release();
    }
});

// 4. EDIT WORK HOURS
app.put('/api/work-hours/:id', verifyToken, async (req, res) => {
    const { id } = req.params;
    const { punch_in, punch_out, break_minutes } = req.body;
    const userId = req.user.id;
    let conn;
    try {
        conn = await pool.getConnection();
        await conn.query(
            "UPDATE work_hours SET punch_in = ?, punch_out = ?, break_minutes = ? WHERE id = ? AND user_id = ?",
            [punch_in, punch_out, break_minutes, id, userId]
        );
        res.json({ message: "Work hours updated successfully" });
    } catch (err) {
        res.status(500).json({ error: "Failed to update work hours" });
    } finally {
        if (conn) conn.release();
    }
});

// 5. DELETE WORK HOURS
app.delete('/api/work-hours/:id', verifyToken, async (req, res) => {
    const { id } = req.params;
    const userId = req.user.id;
    let conn;
    try {
        conn = await pool.getConnection();
        await conn.query("DELETE FROM work_hours WHERE id = ? AND user_id = ?", [id, userId]);
        res.json({ message: "Work hours deleted successfully" });
    } catch (err) {
        res.status(500).json({ error: "Failed to delete work hours" });
    } finally {
        if (conn) conn.release();
    }
});


// ── Image Preprocessor ────────────────────────────────────── AI Help
// threshold(128) is the right balance for thermal receipts.
// The bleed-through watermark is handled in the PARSER instead
// (filtering garbage lines is more reliable than fighting it in pixels).
async function preprocessReceipt(inputPath) {
    const outputPath = inputPath + '_clean.png';

    await sharp(inputPath)
        .rotate()                    // Auto-fix sideways photos via EXIF
        .greyscale()                 // Drop color
        .normalize()                 // Auto stretch contrast
        .sharpen({ sigma: 1.5 })    // Sharpen blurry edges
        .resize({
            width: 1800,
            withoutEnlargement: false,
            fit: 'inside'
        })
        .threshold(128)              //captures more real text
        .png()
        .toFile(outputPath);

    return outputPath;
}

// ── Receipt Line Parser ──────────────────────────────────────
//   - Strips leading 6-digit article codes (720500, 187170, etc.)
//   - Expanded junk word list for Aldi/Lidl/Rewe receipts
//   - Handles "2 x" quantity prefix rows
function parseReceiptLines(text) {
    const today = new Date().toISOString().split('T')[0];

    const junkPatterns = [
        /summe/i, /total/i, /mwst/i, /steuer/i, /kreditkarte/i,
        /kartenzahlung/i, /barzahlung/i, /rabatt/i, /netto/i, /brutto/i,
        /zahlung/i, /rückgeld/i, /gegeben/i, /vielen dank/i, /kassenbon/i,
        /receipt/i, /subtotal/i, /tax/i, /change/i, /artikel/i,
        /straße/i, /strasse/i, /\bplz\b/i,
        /^\s*\d{4,}\s*$/,   // lines that are only a number
        /^\s*\d+\s*x\s*$/i, // "2 x" quantity-only lines
        /^\s*EUR\s*$/i,
    ];

    const lines = text.split('\n');
    const items = [];

    for (const rawLine of lines) {
        const line = rawLine.trim();
        if (line.length < 4) continue;
        if (junkPatterns.some(p => p.test(line))) continue;

        // Price at end of line: "3,58" or "3.58" optionally followed by A/B tax letter
        const priceMatch = line.match(/(\d{1,4}[.,]\d{2})\s*[ABCabc]?\s*$/);
        if (!priceMatch) continue;

        const amount = parseFloat(priceMatch[1].replace(',', '.'));
        if (isNaN(amount) || amount <= 0 || amount > 9999) continue;

        let desc = line.slice(0, line.lastIndexOf(priceMatch[1])).trim();

        // Strip leading 5–7 digit article/PLU code (e.g. "720500 ")
        desc = desc.replace(/^\d{5,7}\s+/, '');

        // Strip leading quantity (e.g. "2x " or "2 X ")
        desc = desc.replace(/^\d+\s*[xX]\s+/, '');

        // Remove OCR garbage, keep German letters and useful symbols
        desc = desc
            .replace(/[^a-zA-ZäöüÄÖÜß0-9 &\-\.'%]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();

        if (desc.length < 2) continue;

        desc = desc.charAt(0).toUpperCase() + desc.slice(1);

        items.push({
            description: desc,
            amount: amount.toFixed(2),
            expense_date: today
        });
    }

    return items;
}

// ── Scan Route ───────────────────────────────────────────────
app.post('/api/expenses/scan', verifyToken, upload.single('receipt'), async (req, res) => {
    if (!req.file) return res.status(400).json({ error: "No receipt uploaded." });

    let processedPath = null;

    try {
        console.log("🖼️  Preprocessing receipt image...");
        processedPath = await preprocessReceipt(req.file.path);

        const config = {
            lang: 'deu+eng',
            oem: 1,  // LSTM neural net
            psm: 6,  // Uniform text block — best for receipts
        };

        console.log("🔍 Running OCR...");
        const rawText = await tesseract.recognize(processedPath, config);
        console.log("📄 Raw OCR:\n", rawText);

        const items = parseReceiptLines(rawText);
        console.log(`✅ Found ${items.length} items`);

        res.json({ message: "Scan complete", items, raw: rawText });

    } catch (err) {
        console.error("❌ Scan error:", err);
        res.status(500).json({ error: "Failed to read the receipt." });
    } finally {
        if (req.file?.path && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
        if (processedPath && fs.existsSync(processedPath)) fs.unlinkSync(processedPath);
    }
});

// 2. BULK SAVE EXPENSES
app.post('/api/expenses/bulk', verifyToken, async (req, res) => {
    const { items } = req.body; // Expecting an array of items
    const userId = req.user.id;
    let conn;

    try {
        conn = await pool.getConnection();
        // Loop through the array and insert each item
        for (let item of items) {
            await conn.query(
                "INSERT INTO expenses (user_id, amount, description, expense_date) VALUES (?, ?, ?, ?)",
                [userId, item.amount, item.description, item.expense_date]
            );
        }
        res.status(201).json({ message: "All items saved successfully!" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Database error" });
    } finally {
        if (conn) conn.release();
    }
});

// GET ALL EXPENSES FOR THE LOGGED-IN USER
app.get('/api/expenses', verifyToken, async (req, res) => {
    const userId = req.user.id;
    let conn;
    try {
        conn = await pool.getConnection();
        const rows = await conn.query(
            "SELECT * FROM expenses WHERE user_id = ? ORDER BY expense_date DESC",
            [userId]
        );
        res.json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to fetch expenses." });
    } finally {
        if (conn) conn.release();
    }
});

// 2. EDIT AN EXPENSE
app.put('/api/expenses/:id', verifyToken, async (req, res) => {
    const { id } = req.params;
    const { description, amount, expense_date } = req.body;
    const userId = req.user.id;
    let conn;
    try {
        conn = await pool.getConnection();
        await conn.query(
            "UPDATE expenses SET description = ?, amount = ?, expense_date = ? WHERE id = ? AND user_id = ?",
            [description, amount, expense_date, id, userId]
        );
        res.json({ message: "Expense updated successfully" });
    } catch (err) {
        res.status(500).json({ error: "Failed to update expense" });
    } finally {
        if (conn) conn.release();
    }
});

// 3. BULK DELETE EXPENSES
app.post('/api/expenses/bulk-delete', verifyToken, async (req, res) => {
    const { ids } = req.body; // Expecting an array of IDs: [1, 5, 12]
    const userId = req.user.id;
    let conn;
    try {
        if (!ids || ids.length === 0) return res.status(400).json({ error: "No IDs provided" });

        conn = await pool.getConnection();
        // Create a string of question marks for the SQL query: "?, ?, ?"
        const placeholders = ids.map(() => '?').join(',');

        // Pass the IDs AND the userId to ensure they only delete their own stuff
        const queryParams = [...ids, userId];

        await conn.query(
            `DELETE FROM expenses WHERE id IN (${placeholders}) AND user_id = ?`,
            queryParams
        );
        res.json({ message: "Bulk delete successful" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to bulk delete expenses" });
    } finally {
        if (conn) conn.release();
    }
});


// GET DASHBOARD SUMMARY
app.get('/api/dashboard', verifyToken, async (req, res) => {
    const userId = req.user.id;
    let conn;

    try {
        conn = await pool.getConnection();

        // Count pending To-Dos
        const todoQuery = await conn.query(
            "SELECT COUNT(*) as pending FROM todos WHERE user_id = ? AND is_completed = 0",
            [userId]
        );

        // Sum expenses for the current month
        const expenseQuery = await conn.query(
            "SELECT SUM(amount) as monthTotal FROM expenses WHERE user_id = ? AND MONTH(expense_date) = MONTH(CURRENT_DATE()) AND YEAR(expense_date) = YEAR(CURRENT_DATE())",
            [userId]
        );

        // Count days worked this week
        const hoursQuery = await conn.query(
            "SELECT COUNT(*) as daysWorked FROM work_hours WHERE user_id = ? AND work_date >= DATE_SUB(CURRENT_DATE(), INTERVAL 7 DAY)",
            [userId]
        );

        res.json({
            pendingTodos: Number(todoQuery[0].pending) || 0,
            monthlyExpenses: Number(expenseQuery[0].monthTotal) || 0,
            daysWorkedThisWeek: Number(hoursQuery[0].daysWorked) || 0
        });

    } catch (err) {
        console.error("Dashboard error:", err);
        res.status(500).json({ error: "Failed to load dashboard data." });
    } finally {
        if (conn) conn.release();
    }
});

// ==========================================
// TELEMETRY & ANALYTICS ROUTES
// ==========================================

// 1. LOG A VISIT (No token required, we want to track everyone who opens the app!)
app.post('/api/track-access', async (req, res) => {
    const { platform, device_model, os } = req.body;
    let ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;

    // Clean IPv6 prefix if present (::ffff:192.168.1.5)
    if (ip.startsWith("::ffff:")) ip = ip.substring(7);

    let location = "Unknown";

    // Check if it's a private IP (Tailscale, Localhost, etc.)
    if (ip.startsWith('100.') || ip.startsWith('192.168.') || ip === '127.0.0.1' || ip === '::1') {
        location = "Tailscale / Local";
    } else {
        // If it's a public IP, get the exact City and Country!
        try {
            const geoRes = await axios.get(`http://ip-api.com/json/${ip}`);
            if (geoRes.data.status === 'success') {
                location = `${geoRes.data.city}, ${geoRes.data.countryCode}`;
            }
        } catch (err) {
            console.log("Geo IP lookup failed.");
        }
    }

    let conn;
    try {
        conn = await pool.getConnection();
        await conn.query(
            "INSERT INTO access_logs (platform, ip_address, user_agent, device_model, os, location) VALUES (?, ?, ?, ?, ?, ?)",
            [platform, ip, req.headers['user-agent'] || 'Unknown', device_model || 'Unknown', os || 'Unknown', location]
        );
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: "Failed to log visit" });
    } finally {
        if (conn) conn.release();
    }
});

// Update the GET route slightly to pull the new data
app.get('/api/analytics', verifyToken, async (req, res) => {
    let conn;
    try {
        conn = await pool.getConnection();
        const webCount = await conn.query("SELECT COUNT(*) as count FROM access_logs WHERE platform = 'web'");
        const mobileCount = await conn.query("SELECT COUNT(*) as count FROM access_logs WHERE platform = 'mobile'");

        // Grab the new columns!
        const recent = await conn.query("SELECT platform, ip_address, device_model, os, location, accessed_at FROM access_logs ORDER BY accessed_at DESC LIMIT 5");

        res.json({ web: Number(webCount[0].count), mobile: Number(mobileCount[0].count), recentLogs: recent });
    } catch (err) {
        res.status(500).json({ error: "Failed to fetch analytics" });
    } finally {
        if (conn) conn.release();
    }
});

// 2. GET STATS FOR THE DASHBOARD
app.get('/api/analytics', verifyToken, async (req, res) => {
    let conn;
    try {
        conn = await pool.getConnection();
        const webCount = await conn.query("SELECT COUNT(*) as count FROM access_logs WHERE platform = 'web'");
        const mobileCount = await conn.query("SELECT COUNT(*) as count FROM access_logs WHERE platform = 'mobile'");

        // Get the 7 most recent visits
        const recent = await conn.query("SELECT platform, ip_address, accessed_at FROM access_logs ORDER BY accessed_at DESC LIMIT 7");

        res.json({
            web: Number(webCount[0].count),
            mobile: Number(mobileCount[0].count),
            recentLogs: recent
        });
    } catch (err) {
        res.status(500).json({ error: "Failed to fetch analytics" });
    } finally {
        if (conn) conn.release();
    }
});

// Start the server
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Beryllium API running on port ${PORT}`);
});