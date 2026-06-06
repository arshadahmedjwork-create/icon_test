import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { createClient } from "@supabase/supabase-js";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import QRCode from "qrcode";
import fs from "fs";

// Create custom Vite plugin to handle PDF generation and download
function certificateDownloadPlugin() {
  return {
    name: "certificate-download-middleware",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const urlMatch = req.url?.match(/^\/api\/certificate\/download\/([a-f0-9-]+)/);
        if (urlMatch) {
          const certificateId = urlMatch[1];
          const query = new URL(req.url, `http://${req.headers.host}`).searchParams;
          const expiresStr = query.get("expires");
          const signature = query.get("signature");

          // 1. Verify Signed URL or Auth Token
          let isAuthorized = false;
          
          // Verify simple signature if provided
          if (expiresStr && signature) {
            const SECRET = "midas-certificate-signing-key-2026-secret";
            const expires = parseInt(expiresStr, 10);
            if (!isNaN(expires) && expires >= Date.now()) {
              const rawString = `${certificateId}:${expires}:${SECRET}`;
              let hash = 0;
              for (let i = 0; i < rawString.length; i++) {
                hash = (hash << 5) - hash + rawString.charCodeAt(i);
                hash = hash & hash;
              }
              const expectedSignature = Math.abs(hash).toString(16);
              if (expectedSignature === signature) {
                isAuthorized = true;
              }
            }
          }

          // Setup Supabase by reading .env file manually
          const envPath = path.resolve(__dirname, ".env");
          let supabaseAnonKey = "";
          let supabaseUrl = "https://fzxtxumrmhudvzhxvawa.supabase.co";

          if (fs.existsSync(envPath)) {
            const envContent = fs.readFileSync(envPath, "utf8");
            envContent.split("\n").forEach((line) => {
              const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
              if (match) {
                const key = match[1];
                let value = match[2] || "";
                if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
                else if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);
                if (key === "VITE_SUPABASE_URL") supabaseUrl = value.trim();
                if (key === "VITE_SUPABASE_ANON_KEY") supabaseAnonKey = value.trim();
              }
            });
          }

          const supabase = createClient(supabaseUrl, supabaseAnonKey);

          // If no signed URL, check Auth header
          if (!isAuthorized) {
            const authHeader = req.headers.authorization;
            if (authHeader && authHeader.startsWith("Bearer ")) {
              const token = authHeader.split(" ")[1];
              const { data: { user }, error: authError } = await supabase.auth.getUser(token);
              if (user && !authError) {
                // Check if user owns the certificate or is admin
                const { data: cert } = await supabase
                  .from("certificates")
                  .select("user_id, role")
                  .eq("id", certificateId)
                  .single();
                  
                if (cert && (cert.user_id === user.id || user.email?.endsWith("@midas.com") || user.email?.endsWith("@admin.com"))) {
                  isAuthorized = true;
                }
              }
            }
          }

          if (!isAuthorized) {
            res.statusCode = 403;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ error: "Access denied. Invalid signature or expired URL." }));
            return;
          }

          try {
            // 2. Fetch certificate metadata
            const { data: cert, error: certErr } = await supabase
              .from("certificates")
              .select("*")
              .eq("id", certificateId)
              .single();

            if (certErr || !cert) {
              res.statusCode = 404;
              res.setHeader("Content-Type", "application/json");
              res.end(JSON.stringify({ error: "Certificate metadata not found." }));
              return;
            }

            // Determine recipient details
            let recipientName = "Attendee";
            const role = cert.role || "student";
            const userId = cert.user_id || cert.eventStudentId;

            if (role === "judge") {
              const { data: judge } = await supabase
                .from("judges")
                .select("fullName")
                .eq("id", userId)
                .single();
              if (judge) {
                recipientName = judge.fullName;
              }
            } else {
              const { data: student } = await supabase
                .from("event_students")
                .select("participantName")
                .eq("id", userId)
                .single();
              if (student) {
                recipientName = student.participantName;
              }
            }

            // Fetch session details
            let sessionName = "Session Event";
            if (cert.session_id || cert.eventId) {
              const { data: session } = await supabase
                .from("sessions")
                .select("name")
                .eq("id", cert.session_id || cert.eventId)
                .single();
              if (session) {
                sessionName = session.name;
              }
            }

            // 3. Create PDF and embed background PNG
            const pdfDoc = await PDFDocument.create();
            const certType = (cert.role || cert.certificateType || cert.type || 'participation').toLowerCase();
            const isPortrait = certType === 'judge';
            const width = isPortrait ? 595 : 842;
            const height = isPortrait ? 842 : 595;
            const page = pdfDoc.addPage([width, height]);

            const imageName = isPortrait 
              ? 'judge_certificate.png' 
              : (certType === 'winner' ? 'appre_certificate.png' : 'Participation_Certificate.png');
            const imagePath = path.resolve(__dirname, 'public', imageName);

            if (!fs.existsSync(imagePath)) {
              res.statusCode = 500;
              res.setHeader("Content-Type", "application/json");
              res.end(JSON.stringify({ error: `Certificate image template not found: ${imageName}` }));
              return;
            }
            const imageBytes = fs.readFileSync(imagePath);
            const backgroundImage = await pdfDoc.embedPng(imageBytes);
            page.drawImage(backgroundImage, {
              x: 0,
              y: 0,
              width: width,
              height: height
            });

            const verifyUrl = `https://portal.domain.com/certificate/verify/${certificateId}`;
            const qrDataUrl = await QRCode.toDataURL(verifyUrl, { margin: 1, width: 120 });
            const qrImage = await pdfDoc.embedPng(qrDataUrl);

            const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
            const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);

            // Inject name centered on the underline space
            const cleanedName = (() => {
              if (!recipientName) return "";
              const trimmed = recipientName.trim();
              const words = trimmed.split(/\s+/);
              if (words.length % 2 === 0) {
                const half = words.length / 2;
                const firstHalf = words.slice(0, half).join(" ");
                const secondHalf = words.slice(half).join(" ");
                if (firstHalf.toLowerCase() === secondHalf.toLowerCase()) {
                  return words.slice(0, half).join(" ");
                }
              }
              return trimmed;
            })();

            let nameFontSize = 28;
            let nameWidth = helveticaBold.widthOfTextAtSize(cleanedName, nameFontSize);
            let nameX = 0;

            if (!isPortrait) {
              // Align to the underline space (X from 280 to 720, center at 500)
              const minX = 280;
              const maxX = 720;
              const maxWidth = maxX - minX;

              while (nameWidth > maxWidth && nameFontSize > 14) {
                nameFontSize -= 1;
                nameWidth = helveticaBold.widthOfTextAtSize(cleanedName, nameFontSize);
              }
              nameX = minX + (maxWidth - nameWidth) / 2;
            } else {
              // For portrait, center on the page
              const maxWidth = width - 80;
              while (nameWidth > maxWidth && nameFontSize > 14) {
                nameFontSize -= 1;
                nameWidth = helveticaBold.widthOfTextAtSize(cleanedName, nameFontSize);
              }
              nameX = (width - nameWidth) / 2;
            }

            const nameY = isPortrait ? height * 0.52 : height * 0.545; 

            page.drawText(cleanedName, {
              x: nameX,
              y: nameY,
              size: nameFontSize,
              font: helveticaBold,
              color: rgb(0.12, 0.22, 0.4),
            });

            // Inject metadata (Bottom left below signatures)
            const dateStr = new Date(cert.generatedAt || cert.generated_at || Date.now()).toLocaleDateString();
            const certIdText = `Certificate ID: ${certificateId}`;
            const dateText = `Generated on: ${dateStr}`;

            page.drawText(certIdText, {
              x: 90,
              y: 35,
              size: 8,
              font: helveticaBold,
              color: rgb(0.2, 0.2, 0.2),
            });

            page.drawText(dateText, {
              x: 90,
              y: 22,
              size: 8,
              font: helvetica,
              color: rgb(0.4, 0.4, 0.4),
            });

            // Inject QR code beside metadata in the bottom left space
            page.drawImage(qrImage, {
              x: 90 + helveticaBold.widthOfTextAtSize(certIdText, 8) + 15,
              y: 15,
              width: 32,
              height: 32,
            });

            // Log downloaded status
            await supabase.from("certificate_audit_logs").insert({
              userId: userId,
              sessionId: cert.session_id || cert.eventId || null,
              action: "DOWNLOADED",
              details: `IP: ${req.headers["x-forwarded-for"] || req.socket.remoteAddress}`
            });

            const pdfBytes = await pdfDoc.save();

            // 5. Send PDF Stream
            res.statusCode = 200;
            res.setHeader("Content-Type", "application/pdf");
            res.setHeader("Content-Disposition", `attachment; filename="certificate_${certificateId}.pdf"`);
            res.end(Buffer.from(pdfBytes));
            return;
          } catch (err) {
            console.error("PDF generation server error:", err);
            res.statusCode = 500;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ error: `Internal Server Error: ${err.message}` }));
            return;
          }
        }
        next();
      });
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [
    react(), 
    mode === "development" && componentTagger(),
    certificateDownloadPlugin()
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));

