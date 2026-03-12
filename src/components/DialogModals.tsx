import { useState } from 'react';
import { motion } from 'framer-motion';

export function InputModal({
  title,
  message,
  defaultValue = '',
  inputType = 'text',
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  onConfirm,
  onCancel,
}: {
  title: string;
  message: string;
  defaultValue?: string;
  inputType?: 'text' | 'password';
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: (value: string) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState(defaultValue);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm"
      onClick={e => e.target === e.currentTarget && onCancel()}
    >
      <motion.div
        initial={{ scale: 0.92, y: 16 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.92, y: 16 }}
        transition={{ type: 'spring', stiffness: 360, damping: 36 }}
        className="w-[460px] rounded-3xl shadow-[0_60px_120px_rgba(0,0,0,0.8)] overflow-hidden"
        style={{ background: 'var(--panel-bg)', border: '1px solid var(--panel-border)' }}
      >
        <div className="px-7 pt-7 pb-5 border-b border-white/5">
          <h2 className="text-lg font-semibold text-white">{title}</h2>
        </div>
        <div className="px-7 py-6 space-y-4">
          <p className="text-sm text-gray-300 whitespace-pre-wrap break-words">{message}</p>
          <input
            autoFocus
            type={inputType}
            value={value}
            onChange={(event) => setValue(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                onConfirm(value);
              }
            }}
            className="w-full bg-[#06060C] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-violet-500/50 focus:ring-2 focus:ring-violet-500/10 transition-all"
          />
        </div>
        <div className="px-7 pb-7 flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 py-2.5 rounded-xl text-sm text-gray-300 bg-white/5 border border-white/10 hover:bg-white/10 transition-all"
          >
            {cancelLabel}
          </button>
          <button
            onClick={() => onConfirm(value)}
            className="flex-1 py-2.5 rounded-xl text-sm font-medium text-white bg-violet-600 hover:bg-violet-500 transition-all shadow-md"
          >
            {confirmLabel}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

export function ConfirmModal({
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  onConfirm,
  onCancel,
}: {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm"
      onClick={e => e.target === e.currentTarget && onCancel()}
    >
      <motion.div
        initial={{ scale: 0.92, y: 16 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.92, y: 16 }}
        transition={{ type: 'spring', stiffness: 360, damping: 36 }}
        className="w-[460px] rounded-3xl shadow-[0_60px_120px_rgba(0,0,0,0.8)] overflow-hidden"
        style={{ background: 'var(--panel-bg)', border: '1px solid var(--panel-border)' }}
      >
        <div className="px-7 pt-7 pb-5 border-b border-white/5">
          <h2 className="text-lg font-semibold text-white">{title}</h2>
        </div>
        <div className="px-7 py-6">
          <p className="text-sm text-gray-300 whitespace-pre-wrap break-words">{message}</p>
        </div>
        <div className="px-7 pb-7 flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 py-2.5 rounded-xl text-sm text-gray-300 bg-white/5 border border-white/10 hover:bg-white/10 transition-all"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 py-2.5 rounded-xl text-sm font-medium text-white bg-violet-600 hover:bg-violet-500 transition-all shadow-md"
          >
            {confirmLabel}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
