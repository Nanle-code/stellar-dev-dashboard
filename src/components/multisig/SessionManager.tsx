import React, { useEffect, useState } from 'react';
import { loadSessions, createSession, deleteSession } from '../../lib/multisig';
import SignatureCollector from './SignatureCollector';
import { useNotifications } from '../../hooks/useNotifications';

export default function SessionManager() {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('list'); // 'list', 'new', 'detail'
  const [activeSession, setActiveSession] = useState(null);
  const { success } = useNotifications();

  // Form state
  const [description, setDescription] = useState('');
  const [txXdr, setTxXdr] = useState('');
  const [requiredSigners, setRequiredSigners] = useState('');

  useEffect(() => {
    async function fetchSessions() {
      const data = await loadSessions();
      setSessions(data);
      setLoading(false);
    }
    fetchSessions();
  }, [view]);

  const handleDelete = async (id) => {
    await deleteSession(id);
    const data = await loadSessions();
    setSessions(data);
  };

  const handleCreate = async () => {
    const signersArray = requiredSigners.split(',').map(s => {
      const [key, weight] = s.split(':');
      return { key: key.trim(), weight: parseInt(weight) || 1 };
    });

    await createSession({
      txXdr,
      description,
      requiredSigners: signersArray,
      threshold: 1, // Defaulting threshold for UI mock
      network: 'testnet',
    });
    
    success('Session Created', 'New multisig session has been initiated.');
    setView('list');
    setDescription('');
    setTxXdr('');
    setRequiredSigners('');
  };

  if (loading) return <div>Loading multisig sessions from IndexedDB...</div>;

  if (view === 'new') {
    return (
      <div className="session-manager">
        <h2>New Signature Session</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <label>
            Description
            <input 
              placeholder="Treasury Payment" 
              value={description} 
              onChange={e => setDescription(e.target.value)} 
            />
          </label>
          <label>
            Transaction XDR
            <textarea 
              value={txXdr} 
              onChange={e => setTxXdr(e.target.value)} 
            />
          </label>
          <label>
            Required Signers (G...:weight)
            <input 
              value={requiredSigners} 
              onChange={e => setRequiredSigners(e.target.value)} 
            />
          </label>
          <div>
            <button className="btn-primary" onClick={handleCreate} aria-label="Create Session">Create Session</button>
            <button className="btn-secondary" onClick={() => setView('list')}>Cancel</button>
          </div>
        </div>
      </div>
    );
  }

  if (view === 'detail' && activeSession) {
    return (
      <div className="session-manager">
        <button className="btn-secondary" aria-label="← Back" onClick={() => { setView('list'); setActiveSession(null); }}>← Back</button>
        <h2>{activeSession.description}</h2>
        <SignatureCollector 
          session={activeSession} 
          onSessionUpdate={(updated) => {
            setActiveSession(updated);
          }} 
        />
      </div>
    );
  }

  return (
    <div className="session-manager">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2>Active Multisig Sessions</h2>
        <button className="btn-primary" onClick={() => setView('new')}>+ New Session</button>
      </div>
      
      {sessions.length === 0 ? (
        <p>No sessions yet.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {sessions.map(session => (
            <div key={session.id} className="session-card" style={{ padding: '15px', border: '1px solid var(--border)', borderRadius: '8px' }}>
              <p><strong>{session.description}</strong></p>
              <p>Status: {session.status.toUpperCase()}</p>
              <div style={{ marginTop: '10px', display: 'flex', gap: '10px' }}>
                <button className="btn-secondary" aria-label="Open" onClick={() => { setActiveSession(session); setView('detail'); }}>Open</button>
                <button className="btn-secondary" style={{ color: 'var(--red)' }} aria-label="Delete" onClick={() => handleDelete(session.id)}>Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}