import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import fs from "fs";
import nodemailer from "nodemailer";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Firebase Admin
const configPath = path.join(__dirname, "firebase-applet-config.json");
let dbAdmin: any = null;

if (fs.existsSync(configPath)) {
  try {
    const firebaseConfig = JSON.parse(fs.readFileSync(configPath, "utf-8"));
    const appInfo = initializeApp({
      projectId: firebaseConfig.projectId
    });
    dbAdmin = firebaseConfig.firestoreDatabaseId 
      ? getFirestore(appInfo, firebaseConfig.firestoreDatabaseId)
      : getFirestore(appInfo);
  } catch (err) {
    console.error("Error initializing Firebase Admin:", err);
  }
}

// ============================================
// EMAIL SERVICE CON POOLING (OPTIMIZADO)
// ============================================
class EmailServiceOptimized {
  private transporter: nodemailer.Transporter | null = null;

  private initTransporter(): nodemailer.Transporter {
    if (this.transporter) return this.transporter;

    const host = process.env.SMTP_HOST;
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;
    const port = process.env.SMTP_PORT || "587";

    if (!host || !user || !pass) {
      throw new Error("SMTP credentials not configured");
    }

    this.transporter = nodemailer.createTransport({
      host,
      port: parseInt(port),
      secure: process.env.SMTP_SECURE === "true",
      auth: { user, pass },
      pool: {
        maxConnections: 5,
        maxMessages: 100,
        rateDelta: 1000,
        rateLimit: 5,
      },
    });

    return this.transporter;
  }

  async sendEmail(to: string, subject: string, text: string, html?: string) {
    try {
      const transporter = this.initTransporter();
      const info = await transporter.sendMail({
        from: `"${process.env.SMTP_FROM_NAME || 'ESE Roldanillo'}" <${process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER}>`,
        to,
        subject,
        text,
        html,
      });
      return { success: true, messageId: info.messageId };
    } catch (error) {
      console.error("Error sending email:", error);
      throw error;
    }
  }

  async close() {
    if (this.transporter) {
      await this.transporter.close();
      this.transporter = null;
    }
  }
}

const emailService = new EmailServiceOptimized();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // ============================================
  // API ROUTES
  // ============================================

  // Register Doctor
  app.post("/api/register-doctor", async (req, res) => {
    if (!dbAdmin) {
      return res.status(500).json({ success: false, error: "Database not initialized" });
    }

    const { doctorId, doctorData, isUpdate } = req.body;

    try {
      const docRef = dbAdmin.collection("doctors").doc(doctorId.toString());
      
      if (isUpdate) {
        const existingDoc = await docRef.get();
        if (existingDoc.exists && existingDoc.data().username) {
          return res.status(400).json({ success: false, error: "La cuenta ya está activada" });
        }
        await docRef.update(doctorData);
      } else {
        await docRef.set(doctorData);
      }

      const customToken = await getAuth().createCustomToken(doctorId.toString());
      res.json({ success: true, customToken });
    } catch (error) {
      console.error("Error in registration:", error);
      res.status(500).json({ success: false, error: (error as Error).message });
    }
  });

  // Check Doctor by Cedula
  app.post("/api/check-doctor", async (req, res) => {
    if (!dbAdmin) {
      return res.status(500).json({ success: false, error: "Database not initialized" });
    }

    const { cedula } = req.body;

    try {
      const q = await dbAdmin.collection("doctors").where("cedula", "==", cedula).get();
      if (q.empty) {
        return res.json({ success: true, exists: false });
      }

      const data = q.docs[0].data();
      res.json({ 
        success: true, 
        exists: true, 
        id: data.id,
        username: data.username,
        nombre: data.nombre 
      });
    } catch (error) {
      res.status(500).json({ success: false, error: (error as Error).message });
    }
  });

  // Doctor Login
  app.post("/api/login", async (req, res) => {
    if (!dbAdmin) {
      return res.status(500).json({ success: false, error: "Database not initialized" });
    }

    const { u, p } = req.body;

    try {
      const q = await dbAdmin.collection("doctors")
        .where("username", "==", u)
        .where("password", "==", p)
        .get();

      if (q.empty) {
        return res.json({ success: false, error: "Credenciales incorrectas" });
      }

      const doc = q.docs[0];
      const data = doc.data();

      if (data.st !== "activo") {
        return res.json({ success: false, error: "Usuario inactivo" });
      }

      const customToken = await getAuth().createCustomToken(data.id.toString());
      res.json({
        success: true,
        customToken,
        session: {
          r: "doctor",
          n: data.nombre,
          doctorId: data.id
        },
        passwordLastChanged: data.passwordLastChanged
      });
    } catch (error) {
      console.error("Error in login:", error);
      res.status(500).json({ success: false, error: (error as Error).message });
    }
  });

  // Send Email (OPTIMIZADO CON POOLING)
  app.post("/api/send-email", async (req, res) => {
    const { to, subject, text, html } = req.body;

    try {
      const result = await emailService.sendEmail(to, subject, text, html);
      res.json({ success: true, messageId: result.messageId });
    } catch (error) {
      console.error("Error sending email:", error);
      res.status(500).json({ success: false, error: (error as Error).message });
    }
  });

  // Vite middleware
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  const server = app.listen(PORT, "0.0.0.0", () => {
    console.log(`✓ Server running on http://localhost:${PORT}`);
    console.log(`✓ Email service optimized with connection pooling`);
  });

  // Graceful shutdown
  process.on("SIGTERM", async () => {
    console.log("SIGTERM received, closing server...");
    await emailService.close();
    server.close(() => {
      console.log("Server closed");
      process.exit(0);
    });
  });
}

startServer().catch(err => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
