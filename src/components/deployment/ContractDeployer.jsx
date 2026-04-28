import React, { useState } from 'react';
import WASMUploader from './WASMUploader';
import ConstructorBuilder from './ConstructorBuilder';
import DeploymentTracker from './DeploymentTracker';
import { ContractDeployer } from '../../lib/deployment/ContractDeployer';

export default function ContractDeployerView() {
  const [file, setFile] = useState(null); const [args, setArgs] = useState([]); const [status, setStatus] = useState(null); const [cost, setCost] = useState(null);
  async function estimate() { if (!file) return; const bytes = new Uint8Array(await file.arrayBuffer()); const d = new ContractDeployer(); setCost(await d.estimateDeploymentCost(bytes, args)); }
  async function deploy() { if (!file) return; const bytes = new Uint8Array(await file.arrayBuffer()); const d = new ContractDeployer(); setStatus(await d.deployContract(bytes, args, 'local-user')); }
  return <div><h3>Deploy Contract</h3><WASMUploader onFile={setFile} /><ConstructorBuilder args={args} setArgs={setArgs} /><button onClick={estimate}>Estimate Cost</button><button onClick={deploy}>Deploy</button>{cost && <pre>{JSON.stringify(cost,null,2)}</pre>}<DeploymentTracker status={status} /></div>;
}
