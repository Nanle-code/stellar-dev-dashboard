import { useState } from 'react'; export default function useMultiSig(){ const [required,setRequired]=useState(2); return {required,setRequired}; }
