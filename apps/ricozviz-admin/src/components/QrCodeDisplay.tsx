'use client';

import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';

interface QrCodeDisplayProps {
  otpauthUri: string;
  secret: string;
}

export function QrCodeDisplay({ otpauthUri, secret }: QrCodeDisplayProps) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [showSecret, setShowSecret] = useState(false);

  useEffect(() => {
    let mounted = true;
    QRCode.toDataURL(otpauthUri, {
      width: 240,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#ffffff'
      }
    })
      .then((url) => {
        if (mounted) setDataUrl(url);
      })
      .catch((err) => {
        console.error('Failed to generate QR code:', err);
      });

    return () => {
      mounted = false;
    };
  }, [otpauthUri]);

  const handleCopy = () => {
    navigator.clipboard.writeText(secret);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex flex-col items-center gap-4 bg-[#141414] border border-[#2a2a2a] p-6 rounded-xl text-center">
      <div className="bg-white p-3 rounded-lg shadow-md">
        {dataUrl ? (
          <img src={dataUrl} alt="2FA QR Code" className="w-56 h-56 block rounded" />
        ) : (
          <div className="w-56 h-56 flex items-center justify-center text-sm text-gray-500">
            Generating QR Code...
          </div>
        )}
      </div>

      <div className="w-full text-left space-y-1.5">
        <div className="flex items-center justify-between">
          <label className="text-xs font-medium text-gray-400">Manual Setup Secret</label>
          <button
            type="button"
            onClick={() => setShowSecret(!showSecret)}
            className="text-xs text-[#ff6b35] hover:underline cursor-pointer"
          >
            {showSecret ? 'Hide' : 'Reveal'}
          </button>
        </div>

        <div className="flex items-center gap-2">
          <input
            type={showSecret ? 'text' : 'password'}
            readOnly
            value={secret}
            className="flex-1 px-3 py-1.5 text-xs font-mono bg-[#0d0d0d] border border-[#2a2a2a] rounded text-gray-200 focus:outline-none select-all"
          />
          <button
            type="button"
            onClick={handleCopy}
            className="px-3 py-1.5 text-xs font-medium bg-[#ff6b35]/15 text-[#ff6b35] border border-[#ff6b35]/30 rounded hover:bg-[#ff6b35]/25 transition cursor-pointer"
          >
            {copied ? 'Copied!' : 'Copy'}
          </button>
        </div>
      </div>
    </div>
  );
}
