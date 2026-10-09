import type { ReactNode } from "react";
import { X } from "lucide-react";
import { Dialog, Heading, Modal, ModalOverlay } from "react-aria-components";

interface SheetProps {
  title: string;
  description?: string;
  closeLabel: string;
  onClose: () => void;
  children: ReactNode;
}

/** Side sheet for secondary surfaces. react-aria supplies the focus trap, Escape and outside-press dismissal. */
export function Sheet({ title, description, closeLabel, onClose, children }: SheetProps) {
  return (
    <ModalOverlay className="tx-scope tx-sheet-overlay" isOpen isDismissable onOpenChange={(open) => { if (!open) onClose(); }}>
      <Modal className="tx-sheet">
        <Dialog className="tx-sheet-dialog">
          <header className="tx-sheet-header">
            <div>
              <Heading slot="title" className="tx-sheet-title">{title}</Heading>
              {description && <p className="tx-sheet-description">{description}</p>}
            </div>
            <button type="button" className="tx-icon-button" onClick={onClose} aria-label={closeLabel}>
              <X size={22} aria-hidden="true" />
            </button>
          </header>
          <div className="tx-sheet-body">{children}</div>
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
}
