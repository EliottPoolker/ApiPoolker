const express = require("express");
const axios = require("axios");
const cors = require("cors");
const multer = require("multer");
const nodemailer = require("nodemailer");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());

const upload = multer({
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ["image/jpeg", "image/png", "application/pdf"];
    cb(null, allowed.includes(file.mimetype));
  },
});

app.post("/api/contact", upload.single("file"), async (req, res) => {
  const { nom, prenom, contact, message } = req.body;

  const recaptchaToken = req.body["g-recaptcha-response"];
  if (!recaptchaToken) {
    return res.status(400).json({ error: "Captcha manquant" });
  }

  try {
    const verifyRes = await axios.post(
      `https://www.google.com/recaptcha/api/siteverify?secret=${process.env.CAPTCHAT_SECRET}&response=${recaptchaToken}`
    );
    if (!verifyRes.data.success) {
      return res.status(400).json({ error: "Captcha invalide", details: verifyRes.data });
    }
  } catch (captchaErr) {
    return res.status(500).json({ error: "Erreur de vérification reCAPTCHA", details: captchaErr.toString() });
  }

  const file = req.file;

  let transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT,
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASSWORD,
    },
  });

  let mailOptions = {
    from: process.env.FROM_EMAIL,
    to: process.env.TO_EMAIL,
    subject: `formulaire site web Poolker`,
    text: `Nom: ${nom}\nPrénom: ${prenom}\nContact: ${contact}\n\nMessage:\n${message}`,
    attachments: file
      ? [
          {
            filename: file.originalname,
            content: file.buffer,
          },
        ]
      : [],
  };

  try {
    await transporter.sendMail(mailOptions);
    res.json({ success: true });
    console.log("Mail bien envoyé");
  } catch (err) {
    console.error("Erreur lors de l'envoi du mail :", err);
    res.status(500).json({ error: "Erreur d'envoi du mail", details: err.toString() });
  }
});

app.listen(PORT, () => {
  console.log(`Serveur en cours d'exécution sur le port ${PORT}`);
});
