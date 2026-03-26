import { useEffect, useState } from 'react';
import { getMyEngagement } from '../services/analytics';
import type { DailySummary } from '../services/analytics';
import TopBar from '../components/TopBar';
import BottomNav from '../components/BottomNav';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { Activity, BookOpen, MessageSquare, PlayCircle, Target, BrainCircuit } from 'lucide-react';
import './AnalyticsPage.css';

export default function AnalyticsPage() {
  const [data, setData] = useState<DailySummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    getMyEngagement(7)
      .then((res) => {
        setData(res.summary);
      })
      .catch((err) => {
        console.error(err);
        setError('Failed to load telemetry data. Connection to intelligence layer lost.');
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  // Calculate aggregates
  const totalMin = data.reduce((acc, curr) => acc + curr.total_min, 0);
  const lessonMin = data.reduce((acc, curr) => acc + curr.lesson_min, 0);
  const aiMessages = data.reduce((acc, curr) => acc + curr.ai_messages, 0);
  const assessmentMin = data.reduce((acc, curr) => acc + curr.assessment_min, 0);
  const liveMin = data.reduce((acc, curr) => acc + curr.live_min, 0);
  const flashcardMin = data.reduce((acc, curr) => acc + curr.flashcard_min, 0);

  // Format data for chart
  const chartData = data.map((d) => {
    // Attempt to format "YYYY-MM-DD" to "MMM DD"
    const dateObj = new Date(d.date);
    const dateLabel = dateObj.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    return {
      name: dateLabel,
      Total: Math.round(d.total_min),
      Lessons: Math.round(d.lesson_min),
      Live: Math.round(d.live_min),
      Assessments: Math.round(d.assessment_min),
    };
  });

  return (
    <div className="analytics-page layout-with-topbar layout-with-bottomnav dark-theme">
      <TopBar title="Telemetry Hub" />

      <main className="analytics-main">
        <header className="analytics-header">
          <div>
            <h1 className="analytics-title">Engagement Telemetry</h1>
            <p className="analytics-subtitle">7-Day Global Synchronicity Report</p>
          </div>
        </header>

        {loading ? (
          <div className="analytics-loading">
            <div className="loading-spinner" />
            <span>Establishing link...</span>
          </div>
        ) : error ? (
          <div className="analytics-error">
            <Activity className="error-icon" />
            <span>{error}</span>
          </div>
        ) : (
          <div className="analytics-content">
            {/* KPI Grid */}
            <div className="analytics-kpi-grid">
              <div className="kpi-card accent-blue">
                <div className="kpi-icon-wrapper"><Activity /></div>
                <div className="kpi-info">
                  <div className="kpi-value">{Math.round(totalMin)}M</div>
                  <div className="kpi-label">Total Sync Time</div>
                </div>
              </div>
              
              <div className="kpi-card accent-emerald">
                <div className="kpi-icon-wrapper"><BookOpen /></div>
                <div className="kpi-info">
                  <div className="kpi-value">{Math.round(lessonMin)}M</div>
                  <div className="kpi-label">Lesson Modules</div>
                </div>
              </div>

              <div className="kpi-card accent-amber">
                <div className="kpi-icon-wrapper"><MessageSquare /></div>
                <div className="kpi-info">
                  <div className="kpi-value">{aiMessages}</div>
                  <div className="kpi-label">AI Interactions</div>
                </div>
              </div>

              <div className="kpi-card accent-violet">
                <div className="kpi-icon-wrapper"><PlayCircle /></div>
                <div className="kpi-info">
                  <div className="kpi-value">{Math.round(liveMin)}M</div>
                  <div className="kpi-label">Live Broadcasts</div>
                </div>
              </div>

              <div className="kpi-card accent-rose">
                <div className="kpi-icon-wrapper"><Target /></div>
                <div className="kpi-info">
                  <div className="kpi-value">{Math.round(assessmentMin)}M</div>
                  <div className="kpi-label">Assessments</div>
                </div>
              </div>

              <div className="kpi-card accent-cyan">
                <div className="kpi-icon-wrapper"><BrainCircuit /></div>
                <div className="kpi-info">
                  <div className="kpi-value">{Math.round(flashcardMin)}M</div>
                  <div className="kpi-label">Flashcard Syncs</div>
                </div>
              </div>
            </div>

            {/* Chart Area */}
            <div className="analytics-chart-container">
              <h2 className="chart-title">Temporal Bandwidth (Minutes/Day)</h2>
              <div className="chart-wrapper">
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                    <XAxis 
                      dataKey="name" 
                      stroke="rgba(255,255,255,0.4)" 
                      fontSize={11}
                      tickLine={false}
                      axisLine={false}
                      dy={10}
                    />
                    <YAxis 
                      stroke="rgba(255,255,255,0.4)" 
                      fontSize={11}
                      tickLine={false}
                      axisLine={false}
                    />
                    <Tooltip 
                      contentStyle={{
                        backgroundColor: '#0a0a0f',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        borderRadius: '12px',
                        boxShadow: '0 8px 32px rgba(0,0,0,0.8)'
                      }}
                      itemStyle={{ color: '#fff', fontSize: '13px' }}
                      labelStyle={{ color: 'rgba(255,255,255,0.6)', marginBottom: '4px', fontSize: '12px' }}
                    />
                    <Line type="monotone" dataKey="Total" stroke="#3b82f6" strokeWidth={3} dot={{ r: 4, strokeWidth: 2 }} activeDot={{ r: 6 }} />
                    <Line type="monotone" dataKey="Lessons" stroke="#10b981" strokeWidth={2} dot={false} opacity={0.7} />
                    <Line type="monotone" dataKey="Live" stroke="#8b5cf6" strokeWidth={2} dot={false} opacity={0.7} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

          </div>
        )}
      </main>

      <BottomNav />
    </div>
  );
}
