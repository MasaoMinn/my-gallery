"use client";

import { Toaster as Sonner, type ToasterProps } from "sonner";

export function Toaster(props: ToasterProps) {
  return (
    <Sonner
      closeButton
      duration={4_000}
      position="top-center"
      richColors
      toastOptions={{
        className: "gallery-toast"
      }}
      {...props}
    />
  );
}
