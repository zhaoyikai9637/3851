const path = require('node:path');
const { fail } = require('./validation');
async function inspectResume(file) {
    if (!file || !file.buffer.length) fail('Select a non-empty resume file.');
    const ext = path.extname(file.originalname).toLowerCase().slice(1);
    if (!['pdf', 'doc', 'docx', 'txt', 'rtf'].includes(ext)) fail('Allowed files: pdf, doc, docx, txt, rtf.');
    const buffer = file.buffer;
    if (ext === 'txt') {
        try { new TextDecoder('utf-8', { fatal: true }).decode(buffer); } catch { fail('Text files must use UTF-8.'); }
        if (buffer.includes(0) || buffer.some(v => v < 32 && ![9, 10, 13].includes(v))) fail('Invalid text file.');
        return 'text/plain';
    }
    if (ext === 'rtf') {
        if (!buffer.subarray(0, 6).toString('ascii').startsWith('{\\rtf')) fail('Invalid RTF file content.');
        return 'application/rtf';
    }
    const { fileTypeFromBuffer } = await import('file-type');
    let detected;
    try { detected = await fileTypeFromBuffer(buffer); } catch { fail('Invalid or damaged document.'); }
    // Legacy Word uses the Compound File Binary container. Require its WordDocument stream name too.
    if (ext === 'doc') {
        const magic = Buffer.from('d0cf11e0a1b11ae1', 'hex');
        if (!buffer.subarray(0, 8).equals(magic) || !buffer.includes(Buffer.from('WordDocument', 'utf16le'))) fail('Invalid Word document.');
        return 'application/msword';
    }
    if (!detected || detected.ext !== ext) fail('File extension does not match document content.');
    return detected.mime;
}
module.exports = { inspectResume };
