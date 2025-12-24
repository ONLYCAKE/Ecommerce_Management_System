import { useState } from 'react'
import { XCircle } from 'lucide-react'

interface Permission {
    id: number
    key: string
    name: string
}

interface Override {
    key: string
    mode: 'GRANT' | 'DENY'
}

interface AddOverrideModalProps {
    permissions: Permission[]
    existingOverrides: Override[]
    onAdd: (key: string, mode: 'GRANT' | 'DENY') => void
    onClose: () => void
}

export default function AddOverrideModal({ permissions, existingOverrides, onAdd, onClose }: AddOverrideModalProps) {
    const [selectedKey, setSelectedKey] = useState('')
    const [selectedMode, setSelectedMode] = useState<'GRANT' | 'DENY'>('GRANT')

    const existingKeys = new Set(existingOverrides.map(o => o.key))
    const availablePermissions = permissions.filter(p => !existingKeys.has(p.key))

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        if (!selectedKey) {
            alert('Please select a permission')
            return
        }
        onAdd(selectedKey, selectedMode)
    }

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
                <div className="flex items-center justify-between p-4 border-b">
                    <h3 className="text-lg font-semibold text-gray-800">Add Permission Override</h3>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-600"
                    >
                        <XCircle size={24} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-4 space-y-4">
                    <div className="bg-yellow-50 border border-yellow-200 rounded p-3 text-sm text-yellow-800">
                        <strong>⚠️ Important:</strong> Overrides apply only to this user and do not change the role.
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Permission *
                        </label>
                        <select
                            className="input w-full"
                            value={selectedKey}
                            onChange={(e) => setSelectedKey(e.target.value)}
                            required
                        >
                            <option value="">Select a permission...</option>
                            {availablePermissions.map((perm) => (
                                <option key={perm.id} value={perm.key}>
                                    {perm.key} - {perm.name}
                                </option>
                            ))}
                        </select>
                        {availablePermissions.length === 0 && (
                            <p className="text-sm text-gray-500 mt-1">
                                All permissions already have overrides
                            </p>
                        )}
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Override Mode *
                        </label>
                        <div className="grid grid-cols-2 gap-3">
                            <button
                                type="button"
                                className={`p-3 rounded border-2 text-center transition-all ${selectedMode === 'GRANT'
                                        ? 'border-green-500 bg-green-50 text-green-700'
                                        : 'border-gray-200 bg-white text-gray-600 hover:border-green-300'
                                    }`}
                                onClick={() => setSelectedMode('GRANT')}
                            >
                                <div className="font-semibold">✅ GRANT</div>
                                <div className="text-xs mt-1">Add permission</div>
                            </button>
                            <button
                                type="button"
                                className={`p-3 rounded border-2 text-center transition-all ${selectedMode === 'DENY'
                                        ? 'border-red-500 bg-red-50 text-red-700'
                                        : 'border-gray-200 bg-white text-gray-600 hover:border-red-300'
                                    }`}
                                onClick={() => setSelectedMode('DENY')}
                            >
                                <div className="font-semibold">❌ DENY</div>
                                <div className="text-xs mt-1">Remove permission</div>
                            </button>
                        </div>
                    </div>

                    <div className="flex justify-end gap-3 pt-4">
                        <button
                            type="button"
                            className="btn-secondary"
                            onClick={onClose}
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="btn-primary"
                            disabled={!selectedKey}
                        >
                            Add Override
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}
