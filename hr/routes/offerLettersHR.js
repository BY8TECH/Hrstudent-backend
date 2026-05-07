const express = require('express');
const router = express.Router();
const PDFDocument = require('pdfkit');
const path = require('path');
const fs = require('fs');
const OfferLetterHR = require('../models/OfferLetterHR');
const { protect } = require('../middleware/auth');
const { isHR } = require('../middleware/rbac');

// Template image path
const TEMPLATE_PATH = path.join(__dirname, '..', 'job offer letter .png');

// ─────────── GET all ───────────
router.get('/', protect, isHR, async (req, res) => {
    try {
        const letters = await OfferLetterHR.find().sort({ createdAt: -1 });
        res.json(letters);
    } catch (err) { res.status(500).json({ message: err.message }); }
});

// ─────────── PDF Download (MUST be before /:id to avoid route conflict) ───────────
router.get('/:id/download-pdf', protect, isHR, async (req, res) => {
    try {
        const letter = await OfferLetterHR.findById(req.params.id);
        if (!letter) return res.status(404).json({ message: 'Offer letter not found' });

        const doc = new PDFDocument({ margin: 0, size: 'A4', bufferPages: true });
        const filename = `offer_letter_${(letter.candidateName || 'candidate').replace(/\s/g, '_')}.pdf`;

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        doc.pipe(res);

        const W = doc.page.width;
        const H = doc.page.height;

        // ── 1. FULL-PAGE BACKGROUND TEMPLATE ──
        const templateExists = fs.existsSync(TEMPLATE_PATH);
        console.log('[OfferLetter PDF] Template path:', TEMPLATE_PATH, '| Exists:', templateExists);
        if (templateExists) {
            doc.image(TEMPLATE_PATH, 0, 0, { width: W, height: H });
        } else {
            // Fallback: white background with blue/orange header bar
            doc.rect(0, 0, W, 5).fill('#1a3c6e');
            doc.rect(0, 5, W, 3).fill('#f97316');
            doc.rect(0, H - 8, W, 8).fill('#1a3c6e');
        }

        const DARK = '#111827';
        const BLUE = '#1a3c6e';
        const GRAY = '#374151';

        // ── 2. CUSTOM LOGO OVERLAY (if user uploaded their own) ──
        if (letter.companyLogo && letter.companyLogo.startsWith('data:image')) {
            try {
                const imgBuf = Buffer.from(letter.companyLogo.split(',')[1], 'base64');
                doc.image(imgBuf, 38, 28, { height: 65, fit: [155, 65] });
            } catch (e) { /* skip */ }
        }

        // ── 3. BODY CONTENT ──
        const bodyX = 55;
        const bodyW = W - 110;
        let curY = 200;

        // Date (right-aligned)
        const offerDate = letter.offerDate
            ? new Date(letter.offerDate).toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' })
            : new Date().toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' });
        doc.font('Helvetica').fontSize(10).fillColor(GRAY)
           .text(`Date: ${offerDate}`, bodyX, curY, { width: bodyW, align: 'right' });
        curY += 22;

        // Candidate block
        doc.font('Helvetica-Bold').fontSize(10.5).fillColor(DARK)
           .text(letter.candidateName || '', bodyX, curY, { width: bodyW });
        curY += 14;
        if (letter.candidateAddress) {
            doc.font('Helvetica').fontSize(10).fillColor(GRAY).text(letter.candidateAddress, bodyX, curY, { width: bodyW });
            curY += 13;
        }
        if (letter.candidateEmail) {
            doc.font('Helvetica').fontSize(10).fillColor(GRAY).text(letter.candidateEmail, bodyX, curY, { width: bodyW });
            curY += 13;
        }
        if (letter.candidatePhone) {
            doc.font('Helvetica').fontSize(10).fillColor(GRAY).text(letter.candidatePhone, bodyX, curY, { width: bodyW });
            curY += 13;
        }
        curY += 8;

        // Subject
        doc.font('Helvetica-Bold').fontSize(10.5).fillColor(DARK)
           .text(`Subject: Offer of Employment – ${letter.jobRole}`, bodyX, curY, { width: bodyW });
        curY += 18;

        // Salutation
        doc.font('Helvetica').fontSize(10.5).fillColor(DARK)
           .text(`Dear ${letter.candidateName},`, bodyX, curY, { width: bodyW });
        curY += 18;

        // Opening paragraph
        const confirmText = letter.offerConfirmationText ||
            `We are pleased to offer you the position of ${letter.jobRole} in the ${letter.department} department at ${letter.companyName}. This offer is subject to the terms and conditions outlined below.`;
        const confH = doc.heightOfString(confirmText, { width: bodyW, lineGap: 4 });
        doc.font('Helvetica').fontSize(10.5).fillColor(DARK)
           .text(confirmText, bodyX, curY, { align: 'justify', width: bodyW, lineGap: 4 });
        curY += confH + 12;

        // Details list
        const joiningDate = letter.joiningDate
            ? new Date(letter.joiningDate).toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' }) : '';

        const details = [
            ['Designation',      letter.jobRole],
            ['Department',       letter.department],
            ['Work Location',    letter.workLocation],
            ['Employment Type',  letter.employmentType],
            ['Date of Joining',  joiningDate],
            ['Probation Period', letter.probationPeriod],
            ['Salary / Stipend', letter.salary],
            ['Payment Cycle',    letter.paymentCycle],
            ['CTC Breakdown',    letter.ctcBreakdown],
            ['Working Hours',    letter.workingHours],
            ['Leave Policy',     letter.leavePolicy],
            ['Notice Period',    letter.noticePeriod],
            ['Company Rules',    letter.companyRules],
        ].filter(([, v]) => v);

        details.forEach(([label, value]) => {
            if (curY > H - 230) return;
            doc.font('Helvetica-Bold').fontSize(10).fillColor(BLUE)
               .text(`${label}:`, bodyX, curY, { width: 130, lineBreak: false });
            doc.font('Helvetica').fontSize(10).fillColor(DARK)
               .text(value, bodyX + 135, curY, { width: bodyW - 135 });
            curY += 16;
        });

        curY += 8;

        if (curY < H - 230) {
            const acceptText = letter.acceptanceInstruction ||
                'Please sign and return a copy of this letter as your acceptance. We look forward to welcoming you to the team.';
            const acceptH = doc.heightOfString(acceptText, { width: bodyW, lineGap: 4 });
            if (curY + acceptH < H - 230) {
                doc.font('Helvetica').fontSize(10.5).fillColor(DARK)
                   .text(acceptText, bodyX, curY, { align: 'justify', width: bodyW, lineGap: 4 });
            }
        }

        doc.end();
    } catch (err) {
        console.error('Offer letter PDF error:', err);
        res.status(500).json({ message: err.message });
    }
});

// ─────────── GET single ───────────
router.get('/:id', protect, isHR, async (req, res) => {
    try {
        const letter = await OfferLetterHR.findById(req.params.id);
        if (!letter) return res.status(404).json({ message: 'Offer letter not found' });
        res.json(letter);
    } catch (err) { res.status(500).json({ message: err.message }); }
});

// ─────────── POST create ───────────
router.post('/', protect, isHR, async (req, res) => {
    try {
        const letter = await OfferLetterHR.create({ ...req.body, createdBy: req.user._id });
        res.status(201).json(letter);
    } catch (err) { res.status(400).json({ message: err.message }); }
});

// ─────────── PUT update ───────────
router.put('/:id', protect, isHR, async (req, res) => {
    try {
        const letter = await OfferLetterHR.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
        if (!letter) return res.status(404).json({ message: 'Offer letter not found' });
        res.json(letter);
    } catch (err) { res.status(400).json({ message: err.message }); }
});

// ─────────── DELETE ───────────
router.delete('/:id', protect, isHR, async (req, res) => {
    try {
        const letter = await OfferLetterHR.findByIdAndDelete(req.params.id);
        if (!letter) return res.status(404).json({ message: 'Offer letter not found' });
        res.json({ message: 'Deleted successfully' });
    } catch (err) { res.status(500).json({ message: err.message }); }
});

module.exports = router;
