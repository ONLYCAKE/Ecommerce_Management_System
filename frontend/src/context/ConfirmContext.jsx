import { createContext, useCallback, useContext, useMemo, useState } from 'react'

const ConfirmCtx = createContext(null)

export function ConfirmProvider({ children }) {
  const [state, setState] = useState({
    open: false,
    title: '',
    description: '',
    resolve: null,
    confirmText: 'OK',
    cancelText: 'Cancel'
  })

  const confirm = useCallback(({ title = 'Are you sure?', description = '', confirmText = 'OK', cancelText = 'Cancel' } = {}) => {
    return new Promise(resolve => {
      setState({ open: true, title, description, resolve, confirmText, cancelText })
    })
  }, [])

  const onClose = useCallback((result) => {
    if (state.resolve) state.resolve(result)
    setState(s => ({ ...s, open: false, resolve: null }))
  }, [state.resolve])

  const value = useMemo(() => ({ confirm }), [confirm])

  return (
    <ConfirmCtx.Provider value={value}>
      {children}
      {state.open && (
        <div className="fixed inset-0 z-50 bg-black/30 flex items-center justify-center p-4">
          <div className="card w-full max-w-sm p-5 animate-fadeIn shadow-lg rounded-xl bg-white">
            {state.title && <h3 className="text-lg font-semibold mb-2">{state.title}</h3>}
            {state.description && <p className="text-sm text-gray-600 mb-4">{state.description}</p>}
            
            <div className="flex justify-end gap-2">
              {/* Cancel button */}
              <button
                className="px-4 py-2 rounded-md bg-gray-200 text-gray-800 hover:bg-gray-300 transition"
                onClick={() => onClose(false)}
              >
                {state.cancelText}
              </button>

              {/* OK button (modern blue gradient) */}
              <button
                className="px-4 py-2 rounded-md text-white font-medium bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 transition"
                onClick={() => onClose(true)}
              >
                {state.confirmText}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmCtx.Provider>
  )
}

export function useConfirm() {
  const ctx = useContext(ConfirmCtx)
  if (!ctx) throw new Error('useConfirm must be used within ConfirmProvider')
  return ctx.confirm
}
