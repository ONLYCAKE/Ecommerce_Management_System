import { useState, useEffect } from 'react';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import { X, Eye, Send, Paperclip } from 'lucide-react';
import {
    getDefaultTemplate,
    getDefaultSubject,
    replacePlaceholders,
    convertToHTML,
    isValidEmail,
    type InvoiceEmailData
} from '../utils/emailTemplates';

interface EmailTemplateModalProps {
    isOpen: boolean;
    onClose: () => void;
    invoice: any;
    buyer: any;
    onSend: (data: { to: string; subject: string; htmlBody: string }) => Promise<void>;
}

export default function EmailTemplateModal({
    isOpen,
    onClose,
    invoice,
    buyer,
    onSend
}: EmailTemplateModalProps) {
    const [to, setTo] = useState('');
    const [subject, setSubject] = useState('');
    const [body, setBody] = useState('');
    const [showPreview, setShowPreview] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const companyName = import.meta.env.VITE_COMPANY_NAME || 'Uday Dairy';
    const fromEmail = import.meta.env.VITE_SMTP_FROM || 'Uday Dairy <no-reply@udaydairy.com>';

    // Initialize email data when modal opens
    useEffect(() => {
        if (isOpen && invoice && buyer) {
            setTo(buyer.email || '');
            setSubject(getDefaultSubject(invoice.invoiceNo, companyName));
            setBody(getDefaultTemplate());
            setError('');
            setShowPreview(false);
        }
    }, [isOpen, invoice, buyer, companyName]);

    const emailData: InvoiceEmailData = {
        invoiceNumber: invoice?.invoiceNo || '',
        buyerName: buyer?.name || '',
        invoiceTotal: `₹${invoice?.total?.toFixed(2) || '0.00'}`,
        dueDate: invoice?.dueDate ? new Date(invoice.dueDate).toLocaleDateString() : 'N/A',
        companyName
    };

    const handleSend = async () => {
        // Validation
        if (!to) {
            setError('Recipient email is required');
            return;
        }

        if (!isValidEmail(to)) {
            setError('Please enter a valid email address');
            return;
        }

        if (!subject.trim()) {
            setError('Subject is required');
            return;
        }

        if (!body.trim()) {
            setError('Email body is required');
            return;
        }

        setError('');
        setLoading(true);

        try {
            // Convert template to HTML
            const htmlBody = convertToHTML(body, emailData);

            await onSend({
                to,
                subject: replacePlaceholders(subject, emailData),
                htmlBody
            });

            onClose();
        } catch (err: any) {
            setError(err.message || 'Failed to send email');
        } finally {
            setLoading(false);
        }
    };

    const getPreviewHTML = () => {
        return convertToHTML(body, emailData);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
                {/* Header */}
                <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-6 py-4 flex items-center justify-between">
                    <div>
                        <h3 className="text-xl font-bold">Send Invoice Email</h3>
                        <p className="text-blue-100 text-sm mt-1">Customize and send invoice to customer</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                        disabled={loading}
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 space-y-4">
                    {/* Error Message */}
                    {error && (
                        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center gap-2">
                            <span className="font-medium">⚠️ {error}</span>
                        </div>
                    )}

                    {/* From Field (Readonly) */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            From
                        </label>
                        <input
                            type="text"
                            value={fromEmail}
                            readOnly
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-600 cursor-not-allowed"
                        />
                    </div>

                    {/* To Field */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            To <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="email"
                            value={to}
                            onChange={(e) => setTo(e.target.value)}
                            placeholder="customer@example.com"
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                        />
                    </div>

                    {/* Subject Field */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Subject <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="text"
                            value={subject}
                            onChange={(e) => setSubject(e.target.value)}
                            placeholder="Invoice {{invoiceNumber}}: {{companyName}}"
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                        />
                        <p className="text-xs text-gray-500 mt-1">
                            Use placeholders: {'{'}{'{'} invoiceNumber {'}'}{'}'}, {'{'}{'{'} buyerName {'}'}{'}'}, {'{'}{'{'} companyName {'}'}{'}'}
                        </p>
                    </div>

                    {/* Email Body */}
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <label className="block text-sm font-medium text-gray-700">
                                Email Body <span className="text-red-500">*</span>
                            </label>
                            <button
                                onClick={() => setShowPreview(!showPreview)}
                                className="flex items-center gap-2 px-3 py-1.5 text-sm text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            >
                                <Eye size={16} />
                                {showPreview ? 'Edit' : 'Preview'}
                            </button>
                        </div>

                        {showPreview ? (
                            <div className="border border-gray-300 rounded-lg p-4 bg-gray-50 min-h-[300px] overflow-auto">
                                <div dangerouslySetInnerHTML={{ __html: getPreviewHTML() }} />
                            </div>
                        ) : (
                            <textarea
                                value={body}
                                onChange={(e) => setBody(e.target.value)}
                                rows={12}
                                placeholder={getDefaultTemplate()}
                                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all font-mono text-sm"
                            />
                        )}
                        <p className="text-xs text-gray-500 mt-1">
                            Available placeholders: {'{'}{'{'} invoiceNumber {'}'}{'}'}, {'{'}{'{'} buyerName {'}'}{'}'}, {'{'}{'{'} invoiceTotal {'}'}{'}'}, {'{'}{'{'} dueDate {'}'}{'}'}, {'{'}{'{'} companyName {'}'}{'}'}
                        </p>
                    </div>

                    {/* Attachments */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Attachments
                        </label>
                        <div className="border border-gray-300 rounded-lg p-4 bg-gray-50">
                            <div className="flex items-center gap-3 text-sm text-gray-600">
                                <Paperclip size={16} className="text-blue-600" />
                                <span>Invoice PDF will be automatically attached</span>
                                <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs font-medium">
                                    {invoice?.invoiceNo}.pdf
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="border-t border-gray-200 px-6 py-4 bg-gray-50 flex items-center justify-between">
                    <p className="text-sm text-gray-500">
                        Email will be sent via Mailtrap SMTP
                    </p>
                    <div className="flex gap-3">
                        <button
                            onClick={onClose}
                            disabled={loading}
                            className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg transition-colors disabled:opacity-50"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleSend}
                            disabled={loading || !to || !subject || !body}
                            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                        >
                            {loading ? (
                                <>
                                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                    Sending...
                                </>
                            ) : (
                                <>
                                    <Send size={16} />
                                    Send Email
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
