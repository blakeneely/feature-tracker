'use client';

import { useEffect, useRef } from 'react';

interface ConfirmDialogProps {
  title: string;
  confirmLabel: string; // names the action exactly: "Delete feature", "Stop server"
  danger?: boolean; // filled danger confirm for destructive actions
  onConfirm: () => void;
  onCancel: () => void;
  children: React.ReactNode; // body copy
}

// The app's replacement for window.confirm: a small modal on the same glass
// surface as the ticket dialog (it reuses .ticket-dialog and .dialog-actions
// wholesale). Cancel is autofocused so Enter never triggers the destructive
// action by accident; Escape and backdrop-free native close both cancel.
export default function ConfirmDialog({
  title,
  confirmLabel,
  danger = false,
  onConfirm,
  onCancel,
  children,
}: ConfirmDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    dialogRef.current?.showModal();
  }, []);

  return (
    <dialog ref={dialogRef} className="ticket-dialog confirm-dialog" onClose={onCancel}>
      <h2>{title}</h2>
      <div className="confirm-dialog-body">{children}</div>
      <div className="dialog-actions">
        <button type="button" className="quiet" autoFocus onClick={onCancel}>
          Cancel
        </button>
        <button
          type="button"
          className={danger ? 'danger' : 'primary'}
          onClick={onConfirm}
        >
          {confirmLabel}
        </button>
      </div>
    </dialog>
  );
}
