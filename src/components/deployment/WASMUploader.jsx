import React from 'react';
export default function WASMUploader({ onFile }) { return <input type='file' accept='.wasm' onChange={(e) => onFile?.(e.target.files?.[0] || null)} />; }
