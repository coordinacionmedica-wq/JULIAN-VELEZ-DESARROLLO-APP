import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { createServer as createViteServer } from "vite";
import nodemailer from "nodemailer";
import dotenv from "dotenv";
import { initializeApp as initAdminApp, getApps, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import fs from "fs";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Firebase Admin
const configPath = path.join(__dirname, "firebase-applet-config.json");
let dbAdmin: any = null;
let authAdmin: any = null;

// Initialize Firebase Admin (async IIFE so we can use return/await cleanly)
await (async () => {
  try {
    const firebaseConfig = fs.existsSync(configPath)
      ? JSON.parse(fs.readFileSync(configPath, "utf-8"))
      : { projectId: process.env.FIREBASE_PROJECT_ID || "" };

    // Build credential from env variable or service account file
    let credential: any = undefined;
    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
      try {
        const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
        credential = cert(serviceAccount);
        console.log("Firebase Admin: using FIREBASE_SERVICE_ACCOUNT env var.");
      } catch (e) {
        console.error("Failed to parse FIREBASE_SERVICE_ACCOUNT:", e);
      }
    } else {
      const saPath = path.join(__dirname, "service-account.json");
      if (fs.existsSync(saPath)) {
        const serviceAccount = JSON.parse(fs.readFileSync(saPath, "utf-8"));
        credential = cert(serviceAccount);
        console.log("Firebase Admin: using service-account.json file.");
      }
    }

    if (!credential) {
      console.log("Firebase Admin: no credentials configured — server-side admin endpoints disabled. App uses client-side Firestore auth.");
      return; // OK — client-side handles auth
    }

    const adminApp = getApps().length === 0
      ? initAdminApp({
          projectId: firebaseConfig.projectId || process.env.FIREBASE_PROJECT_ID || "",
          credential,
        })
      : getApps()[0];

    const { getAuth } = await import("firebase-admin/auth");
    authAdmin = getAuth(adminApp);
    dbAdmin = firebaseConfig.firestoreDatabaseId
      ? getFirestore(adminApp, firebaseConfig.firestoreDatabaseId)
      : getFirestore(adminApp);
    console.log("Firebase Admin initialized successfully.");
  } catch (err) {
    console.error("Error initializing Firebase Admin:", err);
  }
})();

async function startServer() {
  const app = express();
  const PORT = parseInt(process.env.PORT || "3000");

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
      const customToken = await authAdmin.createCustomToken(doctorId.toString());

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

  // API Route for Admin Login (master credentials)
  const ADMIN_UID = "master-admin-001";
  const MASTER_CREDS = { u: "761798", p: "761798" };

  app.post("/api/admin-login", async (req, res) => {
    if (!dbAdmin || !authAdmin) {
      return res.status(500).json({ success: false, error: "Server not initialized" });
    }
    const { u, p } = req.body;
    if (u !== MASTER_CREDS.u || p !== MASTER_CREDS.p) {
      return res.json({ success: false, error: "Credenciales de admin incorrectas" });
    }
    try {
      // Ensure admin doc exists in /admins collection
      const adminRef = dbAdmin.collection("admins").doc(ADMIN_UID);
      const adminDoc = await adminRef.get();
      if (!adminDoc.exists) {
        await adminRef.set({ role: "admin", createdAt: Date.now() });
      }
      const customToken = await authAdmin.createCustomToken(ADMIN_UID);
      res.json({ success: true, customToken });
    } catch (error) {
      console.error("Admin login error:", error);
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
      const customToken = await authAdmin.createCustomToken(doctorId);

      const prefix = data.genero === 'F' ? 'Dra.' : 'Dr.';
      res.json({
        success: true,
        customToken,
        session: {
          r: "doctor",
          n: `${prefix} ${data.nombre}`,
          doctorId: data.id
        },
        passwordLastChanged: data.passwordLastChanged
      });
    } catch (error) {
      console.error("Error in server-side login:", error);
      res.status(500).json({ success: false, error: (error as Error).message });
    }
  });

  // API Route: Submit a registration request (pending admin approval)
  app.post("/api/submit-registration", async (req, res) => {
    if (!dbAdmin) {
      console.error("submit-registration: dbAdmin is null - Firebase not initialized");
      return res.status(500).json({ success: false, error: "Server not configured: Firebase credentials missing. Set FIREBASE_SERVICE_ACCOUNT env var." });
    }
    const { nombre, apellidos, cedula, registroMedico, email, telefono, genero, requestedRol } = req.body;

    if (!nombre?.trim() || !apellidos?.trim() || !cedula?.trim() || !email?.trim()) {
      return res.status(400).json({ success: false, error: "Faltan campos obligatorios" });
    }

    try {
      // Check if doctor already has an active account
      const dupDoctor = await dbAdmin.collection("doctors").where("cedula", "==", cedula.trim()).get();
      if (!dupDoctor.empty && dupDoctor.docs[0].data().username) {
        return res.json({ success: false, error: `Ya existe una cuenta para esta cédula. Usuario: ${dupDoctor.docs[0].data().username}` });
      }

      // Check if there is already a pending request for this cedula
      const dupReq = await dbAdmin.collection("registrationRequests")
        .where("cedula", "==", cedula.trim())
        .where("status", "==", "pending")
        .get();
      if (!dupReq.empty) {
        return res.json({ success: false, alreadyPending: true, error: "Ya existe una solicitud pendiente para esta cédula. Un administrador la revisará pronto." });
      }

      const id = Date.now().toString();
      await dbAdmin.collection("registrationRequests").doc(id).set({
        id, nombre: nombre.trim(), apellidos: apellidos.trim(),
        cedula: cedula.trim(), registroMedico: (registroMedico || "").trim(),
        email: email.trim(), telefono: (telefono || "").trim(),
        genero: genero || "M", requestedRol: requestedRol || "Médico General",
        status: "pending", createdAt: Date.now()
      });

      res.json({ success: true });
    } catch (error) {
      console.error("Error submitting registration:", error);
      res.status(500).json({ success: false, error: (error as Error).message });
    }
  });

  // Default permissions per role (mirrors src/constants.ts)
  const SERVER_DEFAULT_PERMISSIONS: Record<string, string[]> = {
    'Médico General':             ['solicitar_turno', 'call_availability', 'ver_pic', 'ver_guias', 'ver_protocolo_rojo', 'ver_protocolo_azul'],
    'Médico Rural':               ['solicitar_turno', 'call_availability', 'ver_pic', 'ver_guias', 'ver_protocolo_azul'],
    'Médico Especialista':        ['solicitar_turno', 'ver_pic', 'ver_guias', 'ver_protocolo_rojo', 'ver_protocolo_azul'],
    'Especialista':               ['solicitar_turno', 'ver_pic', 'ver_guias', 'ver_protocolo_rojo', 'ver_protocolo_azul'],
    'Médico Obstetra/Ginecólogo': ['solicitar_turno', 'ver_pic', 'ver_guias', 'ver_protocolo_rojo', 'ver_protocolo_azul'],
    'Enfermero Jefe':             ['ver_pic', 'ver_guias', 'ver_protocolo_rojo', 'ver_protocolo_azul'],
    'Jefe de Partos':             ['ver_pic', 'ver_guias', 'ver_protocolo_rojo'],
    'Auxiliar Enfermería':        ['ver_pic', 'ver_guias'],
    'Interno':                    ['solicitar_turno', 'ver_pic', 'ver_guias', 'ver_protocolo_azul'],
    'Triage':                     ['ver_pic', 'ver_guias', 'ver_protocolo_azul'],
    'Odontólogo':                 ['solicitar_turno', 'ver_pic', 'ver_guias'],
    'Laboratorio':                ['ver_pic', 'ver_guias'],
    'Fisioterapeuta':             ['ver_pic', 'ver_guias'],
    'Rayos X':                    ['ver_pic', 'ver_guias'],
  };

  // API Route: Approve a registration request (admin only — called from frontend with admin session)
  app.post("/api/approve-registration", async (req, res) => {
    if (!dbAdmin || !authAdmin) {
      console.error("approve-registration: dbAdmin or authAdmin is null");
      return res.status(500).json({ success: false, error: "Server not configured: Firebase credentials missing. Set FIREBASE_SERVICE_ACCOUNT env var." });
    }
    const { requestId, assignedRol, assignedCat, reviewedBy } = req.body;

    if (!requestId || !assignedRol || !assignedCat) {
      return res.status(400).json({ success: false, error: "Faltan parámetros requeridos" });
    }

    try {
      const reqRef = dbAdmin.collection("registrationRequests").doc(requestId);
      const reqDoc = await reqRef.get();
      if (!reqDoc.exists) return res.status(404).json({ success: false, error: "Solicitud no encontrada" });

      const reqData = reqDoc.data();
      if (reqData.status !== "pending") {
        return res.status(400).json({ success: false, error: "Esta solicitud ya fue procesada" });
      }

      // Find lowest available sequential integer ID (gap-filling, ignores timestamp IDs > 10M)
      const allDocs = await dbAdmin.collection("doctors").get();
      const usedIds = new Set(
        allDocs.docs
          .map((d: any) => parseInt(d.id))
          .filter((n: number) => !isNaN(n) && n > 0 && n < 10000000)
      );
      let newId = 1;
      while (usedIds.has(newId)) newId++;

      // Generate credentials
      const cleanName = reqData.nombre.toLowerCase().replace(/\s+/g, "").replace(/[^a-z0-9]/g, "").substring(0, 5);
      const username = `${cleanName}${reqData.cedula.slice(-4)}`;
      const password = `ESE${Math.floor(1000 + Math.random() * 9000)}`;
      const now = Date.now();

      await dbAdmin.collection("doctors").doc(newId.toString()).set({
        id: newId,
        nombre: `${reqData.nombre} ${reqData.apellidos}`,
        apellidos: reqData.apellidos,
        cedula: reqData.cedula,
        registroMedico: reqData.registroMedico,
        email: reqData.email,
        telefono: reqData.telefono,
        genero: reqData.genero,
        cat: assignedCat,
        rol: assignedRol,
        st: "activo",
        username,
        password,
        passwordLastChanged: now,
        createdAt: now,
        mustChangePassword: true,
        permissions: SERVER_DEFAULT_PERMISSIONS[assignedRol] || []
      });

      await reqRef.update({ status: "approved", reviewedAt: now, reviewedBy: reviewedBy || "Admin", assignedId: newId });

      // Send email with credentials (best-effort)
      const host = process.env.SMTP_HOST;
      const user = process.env.SMTP_USER;
      const pass = process.env.SMTP_PASS;
      if (host && user && pass) {
        try {
          const nodemailerMod = await import("nodemailer");
          const transporter = nodemailerMod.default.createTransport({
            host, port: parseInt(process.env.SMTP_PORT || "587"),
            secure: process.env.SMTP_SECURE === "true",
            auth: { user, pass }
          });
          const prefix = reqData.genero === "F" ? "Dra." : "Dr.";
          await transporter.sendMail({
            from: `"${process.env.SMTP_FROM_NAME || 'ESE Roldanillo'}" <${process.env.SMTP_FROM_EMAIL || user}>`,
            to: reqData.email,
            subject: "Cuenta Activada - Sistema de Coordinación Médica HDSAR",
            html: `<div style="font-family:sans-serif;padding:24px;color:#334155;max-width:480px">
              <h2 style="color:#059669;">✅ Registro Aprobado</h2>
              <p>Estimado(a) <strong>${prefix} ${reqData.nombre} ${reqData.apellidos}</strong>,</p>
              <p>Su solicitud de acceso al sistema de Coordinación Médica del HDSAR ha sido <strong>aprobada</strong>.</p>
              <div style="background:#f0fdf4;border:1px solid #bbf7d0;padding:16px;border-radius:10px;margin:20px 0">
                <p style="margin:6px 0"><strong>Usuario:</strong> <code style="color:#059669;font-size:16px">${username}</code></p>
                <p style="margin:6px 0"><strong>Contraseña temporal:</strong> <code style="color:#059669;font-size:16px">${password}</code></p>
              </div>
              <p style="background:#fef9c3;border:1px solid #fde047;padding:12px;border-radius:8px;font-size:13px">
                ⚠️ <strong>Importante:</strong> Debe cambiar su contraseña en el primer ingreso al sistema.
              </p>
              <p style="font-size:12px;color:#94a3b8;margin-top:20px">ESE Hospital Departamental San Rafael de Roldanillo — Sistema de Coordinación Médica</p>
            </div>`
          });
        } catch (emailErr) {
          console.error("Email send error (non-fatal):", emailErr);
        }
      }

      res.json({ success: true, newId, username, password });
    } catch (error) {
      console.error("Error approving registration:", error);
      res.status(500).json({ success: false, error: (error as Error).message });
    }
  });

  // API Route: Reject a registration request
  app.post("/api/reject-registration", async (req, res) => {
    if (!dbAdmin) {
      console.error("reject-registration: dbAdmin is null");
      return res.status(500).json({ success: false, error: "Server not configured: Firebase credentials missing. Set FIREBASE_SERVICE_ACCOUNT env var." });
    }
    const { requestId, rejectionReason, reviewedBy } = req.body;
    if (!requestId) return res.status(400).json({ success: false, error: "requestId requerido" });

    try {
      const reqRef = dbAdmin.collection("registrationRequests").doc(requestId);
      const reqDoc = await reqRef.get();
      if (!reqDoc.exists) return res.status(404).json({ success: false, error: "Solicitud no encontrada" });

      await reqRef.update({
        status: "rejected",
        rejectionReason: rejectionReason || "",
        reviewedAt: Date.now(),
        reviewedBy: reviewedBy || "Admin"
      });

      res.json({ success: true });
    } catch (error) {
      console.error("Error rejecting registration:", error);
      res.status(500).json({ success: false, error: (error as Error).message });
    }
  });

  // API Route: Send password reset link to a doctor
  app.post("/api/send-reset-email", async (req, res) => {
    if (!dbAdmin) {
      return res.status(500).json({ success: false, error: "Server not configured" });
    }
    const { doctorId, doctorName, email } = req.body;
    if (!doctorId || !email) {
      return res.status(400).json({ success: false, error: "doctorId y email son requeridos" });
    }

    try {
      const crypto = await import("crypto");
      const token = crypto.default.randomBytes(32).toString("hex");
      const expiresAt = Date.now() + 24 * 60 * 60 * 1000; // 24 hours

      // Store token in Firestore
      await dbAdmin.collection("passwordResets").doc(token).set({
        token,
        doctorId,
        doctorName: doctorName || "",
        email,
        expiresAt,
        createdAt: Date.now(),
      });

      // Build reset URL — use APP_URL env var or default
      const baseUrl = process.env.APP_URL || `http://localhost:${process.env.PORT || 3000}`;
      const resetUrl = `${baseUrl}/reset-password?token=${token}`;

      // Send email (best-effort)
      const host = process.env.SMTP_HOST;
      const user = process.env.SMTP_USER;
      const pass = process.env.SMTP_PASS;
      if (host && user && pass) {
        const nodemailerMod = await import("nodemailer");
        const transporter = nodemailerMod.default.createTransport({
          host, port: parseInt(process.env.SMTP_PORT || "587"),
          secure: process.env.SMTP_SECURE === "true",
          auth: { user, pass }
        });
        await transporter.sendMail({
          from: `"${process.env.SMTP_FROM_NAME || 'ESE Roldanillo'}" <${process.env.SMTP_FROM_EMAIL || user}>`,
          to: email,
          subject: "Restablecimiento de contraseña — Sistema de Coordinación Médica HDSAR",
          html: `<div style="font-family:sans-serif;padding:24px;color:#334155;max-width:480px">
            <h2 style="color:#059669;">🔑 Restablecer contraseña</h2>
            <p>Estimado(a) <strong>${doctorName || "usuario"}</strong>,</p>
            <p>El administrador del sistema ha solicitado un restablecimiento de su contraseña.</p>
            <p>Haga clic en el siguiente botón para crear una nueva contraseña. Este enlace es válido por <strong>24 horas</strong>.</p>
            <div style="text-align:center;margin:28px 0">
              <a href="${resetUrl}" style="background:#059669;color:white;padding:14px 28px;border-radius:10px;text-decoration:none;font-weight:900;font-size:14px;display:inline-block">
                RESTABLECER CONTRASEÑA
              </a>
            </div>
            <p style="font-size:11px;color:#94a3b8;word-break:break-all">O copie este enlace: ${resetUrl}</p>
            <p style="font-size:11px;color:#94a3b8;margin-top:16px">Si no solicitó esto, puede ignorar este correo.</p>
            <p style="font-size:11px;color:#94a3b8">ESE Hospital Departamental San Rafael de Roldanillo — Sistema de Coordinación Médica</p>
          </div>`
        });
        res.json({ success: true, emailSent: true });
      } else {
        // SMTP not configured — return the link so admin can share manually
        res.json({ success: true, emailSent: false, resetUrl });
      }
    } catch (error) {
      console.error("Error sending reset email:", error);
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

  // Temporary endpoint to import siglas directly from JSON file
  app.post("/api/import-siglas", async (req, res) => {
    if (!dbAdmin) {
      return res.status(500).json({ success: false, error: "Firebase Admin not configured" });
    }

    try {
      const siglasPath = path.join(__dirname, "siglas_configuradas.json");
      if (!fs.existsSync(siglasPath)) {
        return res.status(404).json({ success: false, error: "siglas_configuradas.json not found" });
      }

      const siglasData = JSON.parse(fs.readFileSync(siglasPath, "utf-8"));
      
      await dbAdmin.collection("settings").doc("variables").set(siglasData);
      
      console.log("Siglas importadas exitosamente a Firebase");
      res.json({ 
        success: true, 
        message: "Siglas importadas exitosamente",
        count: {
          mañana: Object.keys(siglasData.m || {}).length,
          tarde: Object.keys(siglasData.t || {}).length,
          noche: Object.keys(siglasData.n || {}).length
        }
      });
    } catch (error) {
      console.error("Error importing siglas:", error);
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
