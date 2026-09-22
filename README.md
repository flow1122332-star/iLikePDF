# iLikePDF

> **We make PDF easy.** — Free, fast and private online PDF & image tools.

iLikePDF is a lightweight, frontend-only web app with 6 essential tools for
everyday PDF and image work. Everything runs in your browser — no uploads,
no accounts, no watermarks.

🌐 **Live Demo:** https://ilikepdf.pages.dev

---

## ✨ Features

- **6 essential tools** — compress, convert, merge and shrink PDFs and images
- **100% private** — files never leave your browser
- **Zero sign-up** — use every tool without creating an account
- **No watermarks** — clean output files, always
- **Fully responsive** — optimized for mobile, tablet and desktop
- **Fast** — most operations complete in seconds

---

## 🧰 Tools Included

| Tool | What it does |
|------|--------------|
| **PDF Compressor** | Reduce PDF file size with Light, Balanced, Strong or a custom 100 KB target. |
| **JPG to PDF** | Convert JPG, PNG, WEBP and other images into a single PDF. |
| **PDF to Word** | Convert PDFs into editable .docx files. |
| **Word to PDF** | Turn .docx files into clean, shareable PDFs. |
| **Merge PDF** | Combine multiple PDFs into one. |
| **Photo Compressor** | Reduce image file size while keeping good quality. |

---

## 📁 Project Structure

ilikepdf/
- index.html                    (Homepage)
- compress-pdf.html             (PDF Compressor)
- jpg-to-pdf.html               (JPG to PDF)
- pdf-to-word.html              (PDF to Word)
- word-to-pdf.html              (Word to PDF)
- merge-pdf.html                (Merge PDF)
- photo-compressor.html         (Photo Compressor)
- README.md
- css/
  - style.css
  - tool.css
- js/
  - main.js
  - tools/
    - compress-pdf.js
    - jpg-to-pdf.js
    - pdf-to-word.js
    - word-to-pdf.js
    - merge-pdf.js
    - photo-compressor.js
- assets/
  - images/
    - logo-icon.png
    - logo-full.png
    - hero-illustration.png
    - why-illustration.png
    - icons/
      - compress-pdf.png
      - jpg-to-pdf.png
      - pdf-to-word.png
      - word-to-pdf.png
      - merge-pdf.png
      - photo-compressor.png

---

## 🚀 How to Use (Local)

1. Download or clone this repository
2. Open the `ilikepdf` folder
3. Double-click `index.html`
4. Website opens in your browser — ready to use!

No installation. No build step. Just open and use.

---

## 🌐 Deploying to Cloudflare Pages

### Step 1 — Push to GitHub

Upload all files to a GitHub repository named `ilikepdf`.

### Step 2 — Connect to Cloudflare Pages

1. Go to dash.cloudflare.com → Workers & Pages
2. Click Create application → Pages → Connect to Git
3. Select your ilikepdf repository
4. Build settings:
   - Framework preset: None
   - Build command: (leave empty)
   - Build output directory: /
5. Click Save and Deploy

Your site will be live at https://ilikepdf.pages.dev in under 2 minutes.

---

## 🔒 Privacy

**No server. No uploads. No tracking.**

All file processing happens **entirely in your browser**. Your files never
leave your device. Close the tab, and everything's gone.

---

## 📱 Browser Support

- Chrome / Edge (recent) ✅
- Firefox (recent) ✅
- Safari 15+ ✅
- Mobile Safari (iOS 15+) ✅
- Chrome Android ✅

---

## 📋 Limitations

- **PDF to Word**: Works on text-based PDFs. Scanned PDFs won't work.
- **Word to PDF**: Supports .docx (Word 2007+). Older .doc files need conversion first.
- **Large files**: Very large PDFs (over 50 MB) may take a while.

---

## 📄 License

MIT — free to use, modify and distribute.

---

## 🙏 Credits

Built with love for people who just want the file done.

Made with 🧠 by iLikePDF
