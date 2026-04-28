import React from 'react';
export default function ConstructorBuilder({ args, setArgs }) { return <textarea value={JSON.stringify(args)} onChange={(e) => setArgs(JSON.parse(e.target.value || '[]'))} rows={4} style={{width:'100%'}} />; }
