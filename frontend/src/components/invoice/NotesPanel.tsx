import { MessageSquare } from 'lucide-react'

interface NotesPanelProps {
    notes: string
    onChange: (notes: string) => void
    enabled: boolean
    onToggle: (enabled: boolean) => void
}

export default function NotesPanel({ notes, onChange, enabled, onToggle }: NotesPanelProps) {
    return (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            {/* Header with Toggle */}
            <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-gray-200">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center">
                        <MessageSquare size={16} className="text-blue-600" />
                    </div>
                    <div>
                        <h3 className="text-sm font-semibold text-gray-900">Notes / Comments</h3>
                        <p className="text-xs text-gray-500">Add notes to display on the invoice</p>
                    </div>
                </div>
                <button
                    type="button"
                    onClick={() => onToggle(!enabled)}
                    className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${enabled ? 'bg-blue-500' : 'bg-gray-200'
                        }`}
                >
                    <span
                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${enabled ? 'translate-x-5' : 'translate-x-0'
                            }`}
                    />
                </button>
            </div>

            {/* Content */}
            {enabled && (
                <div className="p-4">
                    <textarea
                        placeholder="Enter notes, terms, or special instructions..."
                        className="w-full px-3 py-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none min-h-[100px]"
                        value={notes}
                        onChange={(e) => onChange(e.target.value)}
                        rows={4}
                    />
                    <div className="flex justify-between items-center mt-2">
                        <span className="text-xs text-gray-400">{notes.length} characters</span>
                        {notes.length > 0 && (
                            <button
                                type="button"
                                onClick={() => onChange('')}
                                className="text-xs text-red-500 hover:text-red-600"
                            >
                                Clear
                            </button>
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}
