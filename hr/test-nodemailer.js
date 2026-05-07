// Quick test to verify nodemailer works
const nodemailer = require('nodemailer');

console.log('Nodemailer object:', typeof nodemailer);
console.log('createTransporter:', typeof nodemailer.createTransporter);
console.log('Nodemailer keys:', Object.keys(nodemailer));

if (typeof nodemailer.createTransporter === 'function') {
    console.log('✅ nodemailer.createTransporter is a function!');
} else {
    console.log('❌ nodemailer.createTransporter is NOT a function!');
    console.log('nodemailer exports:', nodemailer);
}
