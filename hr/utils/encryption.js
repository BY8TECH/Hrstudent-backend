const crypto = require('crypto');

// Use a consistent key derived from JWT_SECRET or a fallback
// In production, this should be a dedicated ENCRYPTION_KEY environment variable
const getAlgorithm = () => 'aes-256-cbc';
const getKey = () => {
    const secret = process.env.JWT_SECRET || 'fallback_secret_key_needs_to_be_32_bytes_long';
    // Ensure key is 32 bytes
    return crypto.createHash('sha256').update(String(secret)).digest('base64').substring(0, 32);
};

const encrypt = (text) => {
    if (!text) return null;
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(getAlgorithm(), Buffer.from(getKey()), iv);
    let encrypted = cipher.update(text);
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    return iv.toString('hex') + ':' + encrypted.toString('hex');
};

const decrypt = (text) => {
    if (!text) return null;
    try {
        const textParts = text.split(':');
        const iv = Buffer.from(textParts.shift(), 'hex');
        const encryptedText = Buffer.from(textParts.join(':'), 'hex');
        const decipher = crypto.createDecipheriv(getAlgorithm(), Buffer.from(getKey()), iv);
        let decrypted = decipher.update(encryptedText);
        decrypted = Buffer.concat([decrypted, decipher.final()]);
        return decrypted.toString();
    } catch (error) {
        console.error('Decryption error:', error);
        return null;
    }
};

module.exports = { encrypt, decrypt };
