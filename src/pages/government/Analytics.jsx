import { useState, useEffect } from 'react';
import { Bar, Doughnut } from 'react-chartjs-2';
import { Chart as ChartJS, ArcElement, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } from 'chart.js';
import { Hs_familyhistoriesService } from '../../generated/services/Hs_familyhistoriesService';

ChartJS.register(ArcElement, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

export default function GovAnalytics() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Hs_familyhistoriesService.getAll().then(r => {
      const counts = {};
      for (const f of (r.data || [])) {
        if (!f.hs_conditionname) continue;
        counts[f.hs_conditionname] = (counts[f.hs_conditionname] || 0) + 1;
      }
      const conditions = Object.entries(counts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([condition_name, count]) => ({ condition_name, count }));
      setData({ conditions, ageDistribution: [], monthlyTrends: [] });
    }).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="loading"><div className="spinner" /></div>;

  const ageData = {
    labels: data?.ageDistribution?.map(a => a.age_group) || [],
    datasets: [{
      data: data?.ageDistribution?.map(a => a.count) || [],
      backgroundColor: ['#1565C0','#00B4D8','#16A34A','#D97706','#dc2626'],
    }],
  };

  const conditionsData = {
    labels: data?.conditions?.slice(0,10).map(c => c.condition_name) || [],
    datasets: [{
      label: 'Cases', data: data?.conditions?.slice(0,10).map(c => c.count) || [],
      backgroundColor: '#1565C0', borderRadius: 6,
    }],
  };

  return (
    <div>
      <div className="alert alert-info mb-4">
        🔒 All data displayed is fully anonymised per UK GDPR Article 17 requirements.
      </div>
      <div className="grid grid-2 gap-4">
        <div className="card">
          <div className="card-header"><h3>Population Age Distribution</h3></div>
          <div className="card-body" style={{ display: 'flex', justifyContent: 'center' }}>
            <div style={{ maxWidth: 280 }}>
              <Doughnut data={ageData} options={{ responsive: true, plugins: { legend: { position: 'bottom' } } }} />
            </div>
          </div>
        </div>
        <div className="card">
          <div className="card-header"><h3>Top 10 Reported Conditions</h3></div>
          <div className="card-body">
            <Bar data={conditionsData} options={{ responsive: true, plugins: { legend: { display: false } }, indexAxis: 'y' }} />
          </div>
        </div>
      </div>
    </div>
  );
}
