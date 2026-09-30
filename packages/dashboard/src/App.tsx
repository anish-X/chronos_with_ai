import { useQuery } from '@tanstack/react-query';
import axios from 'axios';

interface HealthResponse {
  status: string;
  timestamp: string;
}

interface MetricsResponse {
  queueDepthPending: number;
  queueDepthClaimed: number;
  jobsCreatedTotal: number;
  jobsSucceededTotal: number;
  jobsFailedTotal: number;
  workerCount: number;
}

const api = axios.create({ baseURL: '/api' });

function App() {
  const { data: health } = useQuery<HealthResponse>({ 
    queryKey: ['health'], 
    queryFn: () => api.get('/health').then(r => r.data) 
  });
  const { data: metrics } = useQuery<MetricsResponse>({ 
    queryKey: ['metrics'], 
    queryFn: () => api.get('/metrics').then(r => r.data) 
  });

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Chronos Dashboard</h1>
        <p className="text-gray-600 mt-1">Distributed Job Scheduler</p>
      </header>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard title="Queue Pending" value={metrics?.queueDepthPending ?? '—'} color="blue" />
        <MetricCard title="Queue Claimed" value={metrics?.queueDepthClaimed ?? '—'} color="yellow" />
        <MetricCard title="Jobs Succeeded" value={metrics?.jobsSucceededTotal ?? '—'} color="green" />
        <MetricCard title="Jobs Failed" value={metrics?.jobsFailedTotal ?? '—'} color="red" />
      </div>

      <div className="mt-8">
        <h2 className="text-xl font-semibold mb-4">System Health</h2>
        <pre className="bg-gray-900 text-green-400 p-4 rounded overflow-x-auto">
          {JSON.stringify(health, null, 2)}
        </pre>
      </div>
    </div>
  );
}

function MetricCard({ title, value, color }: { title: string; value: string | number; color: string }) {
  const colors = {
    blue: 'bg-blue-500',
    yellow: 'bg-yellow-500',
    green: 'bg-green-500',
    red: 'bg-red-500',
  };
  return (
    <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
      <p className="text-sm text-gray-500">{title}</p>
      <p className="text-3xl font-bold text-gray-900 mt-1">{value}</p>
      <div className={`mt-3 h-2 rounded ${colors[color as keyof typeof colors] || 'bg-gray-500'}`} />
    </div>
  );
}

export default App;