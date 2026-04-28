import React from 'react'; export default function GlobalSearch({value,onChange}){return <input placeholder='Search transactions, ops...' value={value} onChange={(e)=>onChange(e.target.value)} />;}
