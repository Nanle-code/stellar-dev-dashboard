import React from 'react';
export default function DeploymentTracker({ status }) { return <pre>{JSON.stringify(status, null, 2)}</pre>; }
