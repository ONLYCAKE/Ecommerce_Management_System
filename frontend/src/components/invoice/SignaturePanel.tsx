import { useRef, useState } from 'react'

interface SignaturePanelProps {
    signature: string | null
    onChange: (signature: string | null) => void
}

export default function SignaturePanel({ signature, onChange }: SignaturePanelProps) {
    const fileInputRef = useRef<HTMLInputElement>(null)
    const [showUploadModal, setShowUploadModal] = useState(false)

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        // Validate file type
        if (!file.type.startsWith('image/')) {
            alert('Please select an image file')
            return
        }

        // Validate file size (max 2MB)
        if (file.size > 2 * 1024 * 1024) {
            alert('Image size should be less than 2MB')
            return
        }

        // Read file and convert to base64
        const reader = new FileReader()
        reader.onload = (event) => {
            const dataURL = event.target?.result as string
            onChange(dataURL)
            setShowUploadModal(false)
        }
        reader.readAsDataURL(file)
    }

    const removeSignature = () => {
        onChange(null)
        if (fileInputRef.current) {
            fileInputRef.current.value = ''
        }
    }

    const openFileDialog = () => {
        fileInputRef.current?.click()
    }

    return (
        <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-3">
            <h3 className="font-semibold text-gray-800 text-sm border-b pb-2">Signature</h3>

            {signature ? (
                <div className="space-y-2">
                    <div className="border border-gray-300 rounded p-2 bg-gray-50">
                        <img src={signature} alt="Signature" className="max-w-full h-auto max-h-32 object-contain" />
                    </div>
                    <div className="flex gap-2">
                        <button
                            type="button"
                            className="btn-secondary text-sm flex-1"
                            onClick={openFileDialog}
                        >
                            Change
                        </button>
                        <button
                            type="button"
                            className="btn-secondary text-sm text-red-600"
                            onClick={removeSignature}
                        >
                            Remove
                        </button>
                    </div>
                </div>
            ) : (
                <button
                    type="button"
                    className="btn-primary w-full text-sm flex items-center justify-center gap-2"
                    onClick={openFileDialog}
                >
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    Upload Signature Image
                </button>
            )}

            {/* Hidden file input */}
            <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileSelect}
            />

            <div className="text-xs text-gray-500 mt-2">
                Upload a PNG, JPG, or GIF image (max 2MB)
            </div>
        </div>
    )
}
