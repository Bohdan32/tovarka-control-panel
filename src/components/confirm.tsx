"use client";

import type { ReactNode } from "react";

// Кнопка видалення, що питає підтвердження: на телефоні легко натиснути випадково.
export function ConfirmButton({ children, message = "Точно видалити? Відновити не вийде.", className }: {
  children: ReactNode; message?: string; className?: string;
}) {
  return (
    <button type="submit" className={className} onClick={(e) => { if (!window.confirm(message)) e.preventDefault(); }}>
      {children}
    </button>
  );
}
