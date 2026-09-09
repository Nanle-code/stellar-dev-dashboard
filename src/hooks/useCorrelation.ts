import { useState, useEffect } from 'react';
import useAnalytics from './useAnalytics';

interface Node {
  id: string;
  label: string;
}

interface Link {
  source: string;
  target: string;
  value: number;
  explanation: string;
}

interface CorrelationData {
  nodes: Node[];
  links: Link[];
}

export function useCorrelation() {
  const analytics = useAnalytics();
  const [data, setData] = useState<CorrelationData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!analytics?.activity || analytics.activity.length === 0) return;

    const fetchCorrelations = async () => {
      setLoading(true);
      try {
        const response = await fetch('http://localhost:4001/api/correlation', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(analytics.activity)
        });

        if (!response.ok) {
          throw new Error('Failed to fetch correlations');
        }

        const result = await response.json();
        setData(result);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Unknown error'));
      } finally {
        setLoading(false);
      }
    };

    fetchCorrelations();
  }, [analytics?.activity]);

  return { data, loading, error };
}
