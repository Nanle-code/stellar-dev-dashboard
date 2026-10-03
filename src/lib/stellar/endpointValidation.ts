export interface EndpointValidationResult {
  isValid: boolean;
  latencyMs?: number;
  protocolCompatible: boolean;
  error?: string;
  details?: Record<string, any>;
}

export async function validateHorizonEndpoint(url: string): Promise<EndpointValidationResult> {
  if (!url || !url.trim()) return { isValid: false, protocolCompatible: false, error: 'URL is required' };
  
  const start = performance.now();
  try {
    const formattedUrl = url.replace(/\/$/, '');
    const res = await fetch(formattedUrl, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(5000),
    });
    
    const latencyMs = Math.round(performance.now() - start);
    
    if (!res.ok) {
      return { isValid: false, latencyMs, protocolCompatible: false, error: `HTTP ${res.status}` };
    }
    
    const data = await res.json();
    const protocolCompatible = !!data.horizon_version && !!data.core_version;
    
    if (!protocolCompatible) {
      return { isValid: false, latencyMs, protocolCompatible: false, error: 'Not a compatible Horizon endpoint' };
    }
    
    return {
      isValid: true,
      latencyMs,
      protocolCompatible: true,
      details: {
        horizonVersion: data.horizon_version,
        coreVersion: data.core_version,
        networkPassphrase: data.network_passphrase
      }
    };
  } catch (err) {
    return {
      isValid: false,
      protocolCompatible: false,
      error: err instanceof Error ? err.message : 'Connection failed',
    };
  }
}

export async function validateSorobanEndpoint(url: string): Promise<EndpointValidationResult> {
  if (!url || !url.trim()) return { isValid: false, protocolCompatible: false, error: 'URL is required' };

  const start = performance.now();
  try {
    const formattedUrl = url.replace(/\/$/, '');
    const res = await fetch(formattedUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'getHealth'
      }),
      signal: AbortSignal.timeout(5000),
    });
    
    const latencyMs = Math.round(performance.now() - start);
    
    if (!res.ok) {
      return { isValid: false, latencyMs, protocolCompatible: false, error: `HTTP ${res.status}` };
    }
    
    const data = await res.json();
    const protocolCompatible = data.jsonrpc === '2.0' && data.result?.status === 'healthy';
    
    if (!protocolCompatible) {
      return { isValid: false, latencyMs, protocolCompatible: false, error: 'Not a compatible Soroban RPC endpoint or unhealthy' };
    }
    
    return {
      isValid: true,
      latencyMs,
      protocolCompatible: true,
      details: data.result
    };
  } catch (err) {
    return {
      isValid: false,
      protocolCompatible: false,
      error: err instanceof Error ? err.message : 'Connection failed',
    };
  }
}
