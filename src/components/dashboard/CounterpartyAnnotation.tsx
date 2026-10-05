import React, { useState } from 'react';
import { Edit2, ShieldAlert, Check } from 'lucide-react';

export default function CounterpartyAnnotation({ 
  address, 
  initialNickname = '', 
  initialRisk = 'low', 
  onSave 
}: { 
  address: string, 
  initialNickname?: string, 
  initialRisk?: 'low' | 'medium' | 'high', 
  onSave: (data: { nickname: string, risk: string }) => Promise<void> 
}) {
  const [editing, setEditing] = useState(false);
  const [nickname, setNickname] = useState(initialNickname);
  const [risk, setRisk] = useState(initialRisk);
  const [error, setError] = useState('');

  const handleSave = async () => {
    if (nickname.length > 50) {
      setError('Nickname too long');
      return;
    }
    try {
      setError('');
      await onSave({ nickname, risk });
      setEditing(false);
    } catch (e: any) {
      setError(e.message || 'Save failed');
    }
  };

  if (!editing) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span>{nickname || address.slice(0, 8) + '...'}</span>
        {risk === 'high' && <ShieldAlert size={14} color="#ef4444" data-testid="risk-high" />}
        <button onClick={() => setEditing(true)} aria-label="Edit annotation" data-testid="edit-btn">
          <Edit2 size={12} />
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
      <input 
        data-testid="input-nickname"
        value={nickname} 
        onChange={(e) => setNickname(e.target.value)} 
        placeholder="Nickname" 
      />
      <select data-testid="select-risk" value={risk} onChange={(e) => setRisk(e.target.value as any)}>
        <option value="low">Low Risk</option>
        <option value="medium">Medium Risk</option>
        <option value="high">High Risk</option>
      </select>
      <button onClick={handleSave} data-testid="save-btn"><Check size={14} /> Save</button>
      {error && <span data-testid="annotation-error" style={{ color: 'red', fontSize: '12px' }}>{error}</span>}
    </div>
  );
}
