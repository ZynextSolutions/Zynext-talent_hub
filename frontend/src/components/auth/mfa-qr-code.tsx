"use client";

import QRCode from "react-qr-code";

interface MfaQrCodeProps {
  value: string;
  size?: number;
}

export function MfaQrCode({ value, size = 160 }: MfaQrCodeProps) {
  return (
    <div className="rounded-md bg-white p-2">
      <QRCode value={value} size={size} level="M" />
    </div>
  );
}
