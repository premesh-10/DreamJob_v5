import mongoose from 'mongoose';

// Minimal v1: plain placeholder substitution, no design canvas.
// Supported placeholders in templateHtml: {{userName}}, {{testTitle}}, {{score}}, {{date}}.
const certificateTemplateSchema = new mongoose.Schema({
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, // seller or admin
    name: { type: String, required: true },
    templateHtml: { type: String, required: true },
    isActive: { type: Boolean, default: true }
}, { timestamps: true });

const CertificateTemplate = mongoose.model('CertificateTemplate', certificateTemplateSchema);
export default CertificateTemplate;
