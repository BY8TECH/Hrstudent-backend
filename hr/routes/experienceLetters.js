const express = require('express');
const router = express.Router();
const PDFDocument = require('pdfkit');
const path = require('path');
const fs = require('fs');
const ExperienceLetter = require('../models/ExperienceLetter');
const { protect } = require('../middleware/auth');
const { isHR } = require('../middleware/rbac');

// Template image path
const TEMPLATE_PATH = path.join(__dirname, '..', 'experience letter.png');

// ─────────── GET all ───────────
router.get('/', protect, isHR, async (req, res) => {
    try {
        const letters = await ExperienceLetter.find().sort({ createdAt: -1 });
        res.json(letters);
    } catch (err) { res.status(500).json({ message: err.message }); }
});

// ─────────── PDF Download (MUST be before /:id to avoid route conflict) ───────────
router.get('/:id/download-pdf', protect, isHR, async (req, res) => {
    try {
        const letter = await ExperienceLetter.findById(req.params.id);
        if (!letter) return res.status(404).json({ message: 'Experience letter not found' });

        const doc = new PDFDocument({ margin: 0, size: 'A4' });
        const filename = `experience_letter_${(letter.employeeName || 'employee').replace(/\s/g, '_')}.pdf`;

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        doc.pipe(res);

        const W = doc.page.width;   // 595.28
        const H = doc.page.height;  // 841.89

        // ── 1. FULL-PAGE BACKGROUND TEMPLATE ──
        if (fs.existsSync(TEMPLATE_PATH)) {
            doc.image(TEMPLATE_PATH, 0, 0, { width: W, height: H });
        }

        const DARK = '#111827';
        const BLUE = '#1a3c6e';
        const GRAY = '#374151';

        // ── 2. CUSTOM LOGO OVERLAY (only if user uploaded their own) ──
        if (letter.companyLogo && letter.companyLogo.startsWith('data:image')) {
            try {
                const imgBuf = Buffer.from(letter.companyLogo.split(',')[1], 'base64');
                doc.image(imgBuf, 38, 28, { height: 65, fit: [155, 65] });
            } catch (e) { /* skip */ }
        }

        // ── 3. BODY CONTENT (below template title area) ──
        const bodyX = 55;
        const bodyW = W - 110;
        let curY = 200;

        // Issue date (right-aligned)
        const issueDate = new Date().toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' });
        doc.font('Helvetica').fontSize(10).fillColor(GRAY)
           .text(`Date: ${issueDate}`, bodyX, curY, { width: bodyW, align: 'right' });
        curY += 22;

        // To block
        doc.font('Helvetica-Bold').fontSize(10.5).fillColor(DARK)
           .text('To,', bodyX, curY, { width: bodyW });
        curY += 15;
        doc.font('Helvetica-Bold').fontSize(10.5).fillColor(DARK)
           .text(letter.employeeName || '', bodyX, curY, { width: bodyW });
        curY += 14;
        if (letter.jobRole) {
            doc.font('Helvetica').fontSize(10.5).fillColor(GRAY)
               .text(letter.jobRole, bodyX, curY, { width: bodyW });
            curY += 14;
        }
        curY += 10;

        // Main certification paragraph
        const doj = letter.dateOfJoining
            ? new Date(letter.dateOfJoining).toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' }) : '';
        const lwd = letter.lastWorkingDate
            ? new Date(letter.lastWorkingDate).toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' }) : '';

        const certText = letter.certificationText ||
            `This is to certify that ${letter.employeeName}${letter.employeeId ? ` (Employee ID: ${letter.employeeId})` : ''} has been employed with ${letter.companyName || 'our organization'} as ${letter.jobRole}${letter.department ? ` in the ${letter.department} department` : ''}, from ${doj} to ${lwd}, a total duration of ${letter.totalExperience}.`;

        const certHeight = doc.heightOfString(certText, { width: bodyW, lineGap: 5 });
        doc.font('Helvetica').fontSize(10.5).fillColor(DARK)
           .text(certText, bodyX, curY, { align: 'justify', width: bodyW, lineGap: 5 });
        curY += certHeight + 14;

        if (letter.rolesResponsibilities) {
            doc.font('Helvetica-Bold').fontSize(10.5).fillColor(BLUE)
               .text('Roles & Responsibilities:', bodyX, curY, { width: bodyW });
            curY += 15;
            const h = doc.heightOfString(letter.rolesResponsibilities, { width: bodyW, lineGap: 4 });
            doc.font('Helvetica').fontSize(10.5).fillColor(DARK)
               .text(letter.rolesResponsibilities, bodyX, curY, { align: 'justify', width: bodyW, lineGap: 4 });
            curY += h + 12;
        }

        if (letter.skillsTechnologies) {
            doc.font('Helvetica-Bold').fontSize(10.5).fillColor(BLUE)
               .text('Skills / Technologies:', bodyX, curY, { width: bodyW });
            curY += 15;
            const h = doc.heightOfString(letter.skillsTechnologies, { width: bodyW, lineGap: 4 });
            doc.font('Helvetica').fontSize(10.5).fillColor(DARK)
               .text(letter.skillsTechnologies, bodyX, curY, { width: bodyW, lineGap: 4 });
            curY += h + 12;
        }

        if (letter.workPerformance) {
            doc.font('Helvetica-Bold').fontSize(10.5).fillColor(BLUE)
               .text('Work Performance:', bodyX, curY, { width: bodyW });
            curY += 15;
            const h = doc.heightOfString(letter.workPerformance, { width: bodyW, lineGap: 4 });
            doc.font('Helvetica').fontSize(10.5).fillColor(DARK)
               .text(letter.workPerformance, bodyX, curY, { align: 'justify', width: bodyW, lineGap: 4 });
            curY += h + 12;
        }

        if (letter.conduct) {
            doc.font('Helvetica-Bold').fontSize(10.5).fillColor(BLUE)
               .text('Conduct:', bodyX, curY, { width: bodyW });
            curY += 15;
            const h = doc.heightOfString(letter.conduct, { width: bodyW, lineGap: 4 });
            doc.font('Helvetica').fontSize(10.5).fillColor(DARK)
               .text(letter.conduct, bodyX, curY, { align: 'justify', width: bodyW, lineGap: 4 });
            curY += h + 12;
        }

        if (curY < H - 230) {
            const closing = 'We wish him/her all the best in their future endeavours.';
            doc.font('Helvetica').fontSize(10.5).fillColor(DARK)
               .text(closing, bodyX, curY, { align: 'justify', width: bodyW });
        }

        doc.end();
    } catch (err) {
        console.error('Experience letter PDF error:', err);
        res.status(500).json({ message: err.message });
    }
});

// ─────────── GET single ───────────
router.get('/:id', protect, isHR, async (req, res) => {
    try {
        const letter = await ExperienceLetter.findById(req.params.id);
        if (!letter) return res.status(404).json({ message: 'Experience letter not found' });
        res.json(letter);
    } catch (err) { res.status(500).json({ message: err.message }); }
});

// ─────────── POST create ───────────
router.post('/', protect, isHR, async (req, res) => {
    try {
        const letter = await ExperienceLetter.create({ ...req.body, createdBy: req.user._id });
        res.status(201).json(letter);
    } catch (err) { res.status(400).json({ message: err.message }); }
});

// ─────────── PUT update ───────────
router.put('/:id', protect, isHR, async (req, res) => {
    try {
        const letter = await ExperienceLetter.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
        if (!letter) return res.status(404).json({ message: 'Experience letter not found' });
        res.json(letter);
    } catch (err) { res.status(400).json({ message: err.message }); }
});

// ─────────── DELETE ───────────
router.delete('/:id', protect, isHR, async (req, res) => {
    try {
        const letter = await ExperienceLetter.findByIdAndDelete(req.params.id);
        if (!letter) return res.status(404).json({ message: 'Experience letter not found' });
        res.json({ message: 'Deleted successfully' });
    } catch (err) { res.status(500).json({ message: err.message }); }
});

module.exports = router;
