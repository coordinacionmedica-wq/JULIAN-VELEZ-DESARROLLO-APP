import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { createServer as createViteServer } from "vite";
import nodemailer from "nodemailer";
import dotenv from "dotenv";
import admin from "firebase-admin";
import fs from "fs";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Firebase Admin
const configPath = path.join(__dirname, "firebase-applet-config.json");
let dbAdmin: any = null;

if (fs.existsSync(configPath)) {
  try {
    const firebaseConfig = JSON.parse(fs.readFileSync(configPath, "utf-8"));
    admin.initializeApp({
      projectId: firebaseConfig.projectId
    });
    // Use the specific database ID if provided in the config
    dbAdmin = firebaseConfig.firestoreDatabaseId 
      ? admin.firestore(firebaseConfig.firestoreDatabaseId)
      : admin.firestore();
  } catch (err) {
    console.error("Error initializing Firebase Admin:", err);
  }
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Route for Self-Registration
  app.post("/api/register-doctor", async (req, res) => {
    if (!dbAdmin) {
      return res.status(500).json({ success: false, error: "Database not initialized on server" });
    }

    const { doctorId, doctorData, isUpdate } = req.body;

    try {
      const docRef = dbAdmin.collection("doctors").doc(doctorId.toString());
      
      if (isUpdate) {
        // Double check it doesn't already have a username to prevent spoofing
        const existingDoc = await docRef.get();
        if (existingDoc.exists && existingDoc.data().username) {
          return res.status(400).json({ success: false, error: "La cuenta ya está activada" });
        }
        await docRef.update(doctorData);
      } else {
        await docRef.set(doctorData);
      }

      // Generate Custom Token for Firebase Auth
      const customToken = await admin.auth().createCustomToken(doctorId.toString());

      res.json({ success: true, customToken });
    } catch (error) {
      console.error("Error in server-side registration:", error);
      res.status(500).json({ success: false, error: (error as Error).message });
    }
  });

  // API Route to verify if a doctor exists by cedula
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

  // API Route for Doctor Login
  app.post("/api/login", async (req, res) => {
    if (!dbAdmin) {
      return res.status(500).json({ success: false, error: "Database not initialized on server" });
    }

    const { u, p } = req.body;

    try {
      const doctorsRef = dbAdmin.collection("doctors");
      const q = await doctorsRef.where("username", "==", u).where("password", "==", p).get();

      if (q.empty) {
        return res.json({ success: false, error: "Credenciales incorrectas" });
      }

      const doc = q.docs[0];
      const data = doc.data();

      if (data.st !== "activo") {
        return res.json({ success: false, error: "Usuario inactivo" });
      }

      const doctorId = data.id.toString();
      const customToken = await admin.auth().createCustomToken(doctorId);

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
      console.error("Error in server-side login:", error);
      res.status(500).json({ success: false, error: (error as Error).message });
    }
  });

  // API Route for sending emails
  app.post("/api/send-email", async (req, res) => {
    const { to, subject, text, html } = req.body;

    const host = process.env.SMTP_HOST;
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;

    if (!host || !user || !pass) {
      console.warn("SMTP credentials not configured. Email NOT sent.");
      return res.status(200).json({ success: false, message: "SMTP not configured" });
    }

    try {
      const transporter = nodemailer.createTransport({
        host: host,
        port: parseInt(process.env.SMTP_PORT || "587"),
        secure: process.env.SMTP_SECURE === "true", // true for 465, false for other ports
        auth: {
          user: user,
          pass: pass,
        },
      });

      const info = await transporter.sendMail({
        from: `"${process.env.SMTP_FROM_NAME || 'ESE Roldanillo'}" <${process.env.SMTP_FROM_EMAIL || user}>`,
        to,
        subject,
        text,
        html,
      });

      console.log("Message sent: %s", info.messageId);
      res.json({ success: true, messageId: info.messageId });
    } catch (error) {
      console.error("Error sending email:", error);
      res.status(500).json({ success: false, error: (error as Error).message });
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
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
