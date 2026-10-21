"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";

type Props = Readonly<{
  className: string;
  ariaLabel?: string;
  children: React.ReactNode;
}>;

export function CatchCardPreview({ className, ariaLabel, children }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <>
      <button className={className} type="button" aria-label={ariaLabel} onClick={() => setOpen(true)}>{children}</button>
      <dialog ref={dialogRef} className="card-dialog" aria-label="조과 카드 미리보기" onClose={() => setOpen(false)} onClick={(event) => { if (event.target === event.currentTarget) setOpen(false); }}>
        <button type="button" aria-label="미리보기 닫기" onClick={() => setOpen(false)}>×</button>
        <Image src="/images/catch-card.png" alt="넙치 42.5cm 조과 카드 크게 보기" width={996} height={1538} />
      </dialog>
    </>
  );
}
