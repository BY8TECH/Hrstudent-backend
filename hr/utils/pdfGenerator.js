const PDFDocument = require('pdfkit');
const { toWords } = require('number-to-words');
const path = require('path');
const fs = require('fs');

/**
 * Generate salary slip PDF
 * @param {Object} payroll - Payroll document with populated employee data
 * @param {boolean} withTax - Whether to include tax deductions
 * @returns {PDFDocument} PDF document stream
 */
function generateSalarySlipPDF(payroll, withTax = true) {
    const doc = new PDFDocument({ margin: 40, size: 'A4' });

    const employee = payroll.employeeId;
    const monthNames = ['JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE',
        'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER'];
    const monthName = monthNames[payroll.month - 1];

    // --- Header Section ---
    const logoPath = path.join(__dirname, '..', 'public', 'logo.png');
    if (fs.existsSync(logoPath)) {
        doc.image(logoPath, 40, 30, { width: 100 });
    }

    doc.fontSize(16).font('Helvetica-Bold').text('BY8LABS AI PRIVATE LDT.', { align: 'center' });
    doc.fontSize(9).font('Helvetica').text('5861, SANTHANATHAPURAM, 7 th street, Pudukkottai-622001', { align: 'center' });
    doc.text('Tamil Nadu', { align: 'center' });

    doc.moveDown(1.5);
    doc.fontSize(14).font('Helvetica-Bold').text(`PAYSLIP FOR ${monthName} ${payroll.year}`, { align: 'center' });
    doc.moveDown(1.5);

    // --- Employee Details Grid ---
    const startX = 40;
    const midX = 300;
    let y = doc.y;

    const rowHeight = 16;

    // Helper to draw a row with two columns
    const drawRow = (label1, val1, label2, val2, yPos) => {
        doc.fontSize(9).font('Helvetica-Bold').text(label1, startX, yPos);
        doc.font('Helvetica').text(val1 || '-', startX + 90, yPos);
        doc.font('Helvetica-Bold').text(label2, midX, yPos);
        doc.font('Helvetica').text(val2 || '-', midX + 110, yPos);
    };

    drawRow('Name', `${employee.firstName} ${employee.lastName}`, 'PAN', employee.bankDetails?.panNumber, y);
    y += rowHeight;
    drawRow('Employee Code', employee.employeeId, 'Employee Status', employee.employmentStatus, y); // Adjusted some placeholders from DOCX
    y += rowHeight;
    drawRow('Sex', employee.gender, 'Designation', employee.designation, y);
    y += rowHeight;
    drawRow('Account Number', employee.bankDetails?.accountNumber, 'Location', employee.region || 'Onsite', y);
    y += rowHeight;
    drawRow('PF Account Number', employee.pfAccountNumber, 'Joining Date', employee.joiningDate ? new Date(employee.joiningDate).toLocaleDateString('en-GB') : '', y);
    y += rowHeight;
    drawRow('UAN', employee.uanNumber, 'Leaving Date', employee.dateOfLeaving ? new Date(employee.dateOfLeaving).toLocaleDateString('en-GB') : '', y);
    y += rowHeight;
    drawRow('ESI Number', employee.esiNumber, 'Tax Regime', 'NEW', y); // Based on DOCX

    y += rowHeight + 10;
    doc.y = y;

    // --- Summary Row ---
    doc.fontSize(9).font('Helvetica-Bold');
    doc.text('PAY DAYS:', startX, y);
    doc.text('ATTENDANCE ARREAR DAYS:', startX + 120, y);
    doc.text('INCREMENT ARREAR DAYS:', startX + 320, y);

    y += 15;
    doc.font('Helvetica');
    doc.text(payroll.actualWorkingDays.toFixed(2), startX, y);
    doc.text((0).toFixed(2), startX + 120, y);
    doc.text((0).toFixed(2), startX + 320, y);

    y += 25;

    // --- Table Headers ---
    // Draw table outlines
    doc.rect(startX, y, 515, 20).stroke(); // Header box

    let currentY = y + 6;
    doc.fontSize(9).font('Helvetica-Bold');

    // Earnings side
    doc.text('EARNINGS (INR)', startX + 5, currentY);

    // Deductions side
    doc.text('DEDUCTIONS (INR )', startX + 270, currentY);

    // Vertical divider for table
    doc.moveTo(startX + 260, y).lineTo(startX + 260, y + 250).stroke(); // Main vertical divider
    doc.moveTo(startX, y + 250).lineTo(startX + 515, y + 250).stroke(); // Bottom border

    y += 20; // Move to subheaders
    currentY = y + 6;
    doc.rect(startX, y, 515, 20).stroke(); // Subheader box

    doc.text('COMPONENTS', startX + 5, currentY);
    doc.text('RATE', startX + 90, currentY);
    doc.text('MONTHLY', startX + 140, currentY);
    doc.text('ARREAR', startX + 190, currentY);
    doc.text('TOTAL', startX + 230, currentY);

    doc.text('COMPONENTS', startX + 270, currentY);
    doc.text('TOTAL', startX + 470, currentY);

    y += 20;
    currentY = y + 8;
    doc.font('Helvetica');

    // --- Table Content ---

    // Calculate adjusted values based on withTax flag
    let pfAmount = payroll.providentFund || 0;
    let ptAmount = payroll.professionalTax || 0;
    let itDeduction = payroll.incomeTax || 0;
    let lopAmount = payroll.lopAmount || 0;

    let totalDeductions = pfAmount + ptAmount + itDeduction + lopAmount + (payroll.advanceDeduction || 0) + (payroll.timeDeductions || 0) + (payroll.otherDeductions || 0);

    if (!withTax) {
        // If without tax, remove PF, PT, IT
        totalDeductions = totalDeductions - pfAmount - ptAmount - itDeduction;
        pfAmount = 0;
        ptAmount = 0;
        itDeduction = 0;
    }

    const netPayable = payroll.grossSalary + (payroll.incentives || 0) + (payroll.advance || 0) - totalDeductions;

    // Function to draw Earnings row
    let eY = currentY;
    const addEarningRow = (comp, rate, note = '') => {
        doc.fontSize(8).text(comp, startX + 5, eY);
        doc.text(rate.toFixed(2) + (note ? `\n${note}` : ''), startX + 90, eY);
        doc.text(rate.toFixed(2), startX + 140, eY);
        doc.text('0.00', startX + 190, eY);
        doc.text(rate.toFixed(2), startX + 230, eY);
        eY += note ? 25 : 15;
    };

    // Draw Earnings
    addEarningRow('Basic', payroll.basicSalary || 0);
    addEarningRow('HRA', payroll.hra || 0, '(40 or 50%)');
    addEarningRow('Telephone Allowance', payroll.telephoneAllowance || 0, '(fixed)');
    addEarningRow('Conveyance', payroll.conveyanceAllowance || 0, '(fixed)');
    addEarningRow('Medical', payroll.medicalAllowance || 0, '(fixed)');
    if (payroll.specialAllowance > 0) {
        addEarningRow('Special Allowance', payroll.specialAllowance || 0);
    }
    if (payroll.incentives > 0) {
        addEarningRow('Incentives', payroll.incentives || 0);
    }
    if (payroll.advance > 0) {
        addEarningRow('Advance', payroll.advance || 0);
    }

    // Draw Deductions
    let dY = currentY;
    const addDeductionRow = (comp, amount, note = '') => {
        doc.fontSize(8).text(comp, startX + 270, dY);
        doc.text(amount.toFixed(2) + (note ? ` ${note}` : ''), startX + 410, dY, { width: 100, align: 'right' });
        dY += note ? 25 : 15;
    };

    if (withTax || pfAmount > 0) addDeductionRow('PF', pfAmount, '(fixed)');
    if (withTax || ptAmount > 0) addDeductionRow('PT', ptAmount, '(fixed)');
    if (withTax || itDeduction > 0) addDeductionRow('IT', itDeduction, '(yearly once paid\nbased on income)');
    if (lopAmount > 0) addDeductionRow('Loss of Pay (LOP)', lopAmount);
    if (payroll.advanceDeduction > 0) addDeductionRow('Advance Deduction', payroll.advanceDeduction);
    if (payroll.timeDeductions > 0) addDeductionRow('Late Arrival/Early Leave Deductions', payroll.timeDeductions);
    if (payroll.otherDeductions > 0) addDeductionRow('Other Deductions', payroll.otherDeductions);

    if (!withTax) {
        doc.font('Helvetica-Oblique').text('(Tax Details Excluded)', startX + 270, dY);
    }

    // Draw Total Rows inside the table
    // Bottom border is at y + 250
    const totalsY = y + 230;
    doc.moveTo(startX, totalsY - 5).lineTo(startX + 515, totalsY - 5).stroke(); // Top border of Total row

    doc.fontSize(9).font('Helvetica-Bold');
    doc.text('TOTAL EARNINGS', startX + 5, totalsY);
    const totalEarnings = payroll.grossSalary + (payroll.incentives || 0) + (payroll.advance || 0);
    doc.text(totalEarnings.toFixed(2), startX + 90, totalsY);
    doc.text(totalEarnings.toFixed(2), startX + 140, totalsY);
    doc.text('0.00', startX + 190, totalsY);
    doc.text(totalEarnings.toFixed(2), startX + 230, totalsY);

    doc.text('TOTAL DEDUCTIONS', startX + 270, totalsY);
    doc.text(totalDeductions.toFixed(2), startX + 410, totalsY, { width: 100, align: 'right' });

    // Table ends at y + 250
    y = y + 260;

    // --- Footer Section ---
    doc.fontSize(10).font('Helvetica-Bold');
    doc.text('NET PAY ( INR )', startX, y);
    doc.text(netPayable.toFixed(2), startX + 150, y);

    y += 20;
    doc.text('NET PAY IN WORDS', startX, y);
    doc.font('Helvetica').text(convertToWords(Math.round(netPayable)), startX + 150, y);

    y += 50;

    // Cut Here line
    doc.fontSize(10).font('Helvetica');
    const cutLineText = '..................................................... Cut Here .....................................................';
    doc.text(cutLineText, { align: 'center' });

    return doc;
}

/**
 * Convert number to words in Indian format
 * @param {number} amount - Amount to convert
 * @returns {string} Amount in words
 */
function convertToWords(amount) {
    if (amount === 0) return 'Zero Rupees Only';

    try {
        const words = toWords(amount);
        // Capitalize first letter and add 'Rupees Only'
        const capitalized = words.charAt(0).toUpperCase() + words.slice(1);
        return `${capitalized} Rupees Only`;
    } catch (error) {
        return 'Amount conversion error';
    }
}

module.exports = { generateSalarySlipPDF };
