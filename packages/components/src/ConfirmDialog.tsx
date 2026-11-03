'use client';

import React, { useState, useEffect } from 'react';

export interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  description: string;
  confirmText?: string;
  confirmLabel?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'neutral';
  confirmMatchText?: string;
  confirmTextMatch?: string;
  matchPrompt?: string;
  requireReason?: boolean;
  reasonRequired?: boolean;
  reasonPrompt?: string;
  reasonPlaceholder?: string;
  isLoading?: boolean;
  onConfirm: (reason?: any) => void | Promise<void>;
  onCancel: () => void;
}

export function ConfirmDialog({
  isOpen,
  title,
  description,
  confirmText,
  confirmLabel,
  cancelText = 'Cancel',
  variant = 'danger',
  confirmMatchText,
  confirmTextMatch,
  matchPrompt,
  requireReason,
  reasonRequired,
  reasonPrompt,
  reasonPlaceholder,
  isLoading = false,
  onConfirm,
  onCancel
}: ConfirmDialogProps) {
  const [typedMatch, setTypedMatch] = useState('');
  const [reason, setReason] = useState('');

  const effectiveConfirmText = confirmLabel || confirmText || 'Confirm';
  const effectiveMatch = confirmTextMatch || confirmMatchText;
  const effectiveRequireReason = reasonRequired ?? requireReason ?? false;
  const effectivePrompt = reasonPlaceholder || reasonPrompt || 'Reason for this audit ledger action:';

  // Reset inputs when opened
  useEffect(() => {
    if (isOpen) {
      setTypedMatch('');
      setReason('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const isMatchValid = !effectiveMatch || typedMatch.trim() === effectiveMatch.trim();
  const isReasonValid = !effectiveRequireReason || reason.trim().length > 0;
  const canConfirm = isMatchValid && isReasonValid && !isLoading;

  const handleConfirm = () => {
    onConfirm(reason);
  };

  const variantButtonClasses =
    variant === 'danger'
      ? 'bg-rose-600 hover:bg-rose-500 text-white disabled:bg-rose-950/40 disabled:text-rose-400/40'
      : variant === 'warning'
        ? 'bg-amber-600 hover:bg-amber-500 text-white disabled:bg-amber-950/40 disabled:text-amber-400/40'
        : 'bg-[#ff6b35] hover:bg-[#fa5c20] text-white disabled:bg-[#333333] disabled:text-[#666666]';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs select-none">
      <div
        className="w-full max-w-md rounded-2xl border border-[#2b2b2b] bg-[#141414] shadow-2xl p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150"
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
      >
        <div className="space-y-1.5">
          <h2 id="confirm-dialog-title" className="text-base font-semibold text-[#fafafa] font-mono-code flex items-center gap-2">
            {variant === 'danger' && <span className="text-rose-500">⚠</span>}
            {title}
          </h2>
          <p className="text-xs text-[#898989] leading-relaxed">
            {description}
          </p>
        </div>

        {effectiveMatch && (
          <div className="space-y-1.5 pt-1">
            <label className="text-[11px] font-mono-code text-[#aaaaaa]">
              {matchPrompt || (
                <>
                  Type <span className="font-bold text-[#fafafa] select-all underline decoration-dotted">{effectiveMatch}</span> to confirm:
                </>
              )}
            </label>
            <input
              type="text"
              value={typedMatch}
              onChange={(e) => setTypedMatch(e.target.value)}
              placeholder={effectiveMatch}
              className="w-full px-3 py-2 text-xs font-mono-code rounded-lg bg-[#0e0e0e] border border-[#2e2e2e] text-[#fafafa] focus:outline-hidden focus:border-rose-500 transition-colors"
              autoFocus
            />
          </div>
        )}

        {effectiveRequireReason && (
          <div className="space-y-1.5 pt-1">
            <label className="text-[11px] font-mono-code text-[#aaaaaa]">
              {effectivePrompt} <span className="text-rose-500">*</span>
            </label>
            <textarea
              rows={2}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Audit log justification (required)"
              className="w-full px-3 py-2 text-xs font-mono-code rounded-lg bg-[#0e0e0e] border border-[#2e2e2e] text-[#fafafa] focus:outline-hidden focus:border-[#ff6b35] transition-colors resize-none"
            />
          </div>
        )}

        <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[#222222]">
          <button
            type="button"
            onClick={onCancel}
            disabled={isLoading}
            className="px-3.5 py-1.5 text-xs font-mono-code text-[#898989] hover:text-[#fafafa] hover:bg-[#1f1f1f] rounded-lg transition-colors"
          >
            {cancelText}
          </button>
          <button
            type="button"
            disabled={!canConfirm}
            onClick={handleConfirm}
            className={`px-4 py-1.5 text-xs font-mono-code font-semibold rounded-lg transition-all ${variantButtonClasses}`}
          >
            {isLoading ? 'Processing...' : effectiveConfirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
