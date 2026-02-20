'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';

interface BandDistributionChartProps {
  data?: any;
}

const BAND_COLORS = {
  EXPLORATORY: '#6b7280',
  INFORMED: '#3b82f6',
  CONFIDENT: '#22c55e',
  ACTIONABLE: '#facc15'
};

export default function BandDistributionChart({ data }: BandDistributionChartProps) {
  const distribution = data?.distribution || {};
  const revenueProjection = data?.revenue_projection || {};

  // Prepare data for pie chart
  const pieData = Object.entries(distribution).map(([band, info]: [string, any]) => ({
    name: band,
    value: info.count,
    color: BAND_COLORS[band as keyof typeof BAND_COLORS]
  }));

  // Prepare data for bar chart
  const barData = Object.entries(distribution).map(([band, info]: [string, any]) => ({
    band,
    count: info.count,
    percentage: info.percentage,
    revenue: revenueProjection[band] || 0
  }));

  return (
    <div className="space-y-6">
      {/* Pie Chart */}
      <Card className="bg-custom-box border-custom-border">
        <CardHeader>
          <CardTitle className="text-fm-white">Band Distribution</CardTitle>
          <CardDescription className="text-fm-muted">
            Entity distribution across confidence bands
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={400}>
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                outerRadius={120}
                fill="#8884d8"
                dataKey="value"
              >
                {pieData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1f2937',
                  border: '1px solid #374151',
                  borderRadius: '0.375rem',
                  color: '#ffffff'
                }}
              />
              <Legend
                wrapperStyle={{ color: '#ffffff' }}
              />
            </PieChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Bar Chart - Count and Revenue */}
      <Card className="bg-custom-box border-custom-border">
        <CardHeader>
          <CardTitle className="text-fm-white">Count and Revenue by Band</CardTitle>
          <CardDescription className="text-fm-muted">
            Entity count and monthly revenue projection
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={barData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis
                dataKey="band"
                stroke="#9ca3af"
                tick={{ fill: '#9ca3af' }}
              />
              <YAxis
                yAxisId="left"
                stroke="#9ca3af"
                tick={{ fill: '#9ca3af' }}
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                stroke="#9ca3af"
                tick={{ fill: '#9ca3af' }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1f2937',
                  border: '1px solid #374151',
                  borderRadius: '0.375rem',
                  color: '#ffffff'
                }}
              />
              <Legend
                wrapperStyle={{ color: '#ffffff' }}
              />
              <Bar
                yAxisId="left"
                dataKey="count"
                name="Entity Count"
                fill="#3b82f6"
              />
              <Bar
                yAxisId="right"
                dataKey="revenue"
                name="Revenue ($)"
                fill="#22c55e"
              />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Detailed Breakdown Table */}
      <Card className="bg-custom-box border-custom-border">
        <CardHeader>
          <CardTitle className="text-fm-white">Detailed Breakdown</CardTitle>
          <CardDescription className="text-fm-muted">
            Entity samples and revenue per band
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-custom-border">
                  <th className="text-left py-3 px-4 text-fm-white font-semibold">Band</th>
                  <th className="text-right py-3 px-4 text-fm-white font-semibold">Count</th>
                  <th className="text-right py-3 px-4 text-fm-white font-semibold">Percentage</th>
                  <th className="text-right py-3 px-4 text-fm-white font-semibold">Monthly Revenue</th>
                  <th className="text-left py-3 px-4 text-fm-white font-semibold">Sample Entities</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(distribution).map(([band, info]: [string, any]) => (
                  <tr key={band} className="border-b border-custom-border hover:bg-custom-border">
                    <td className="py-3 px-4">
                      <Badge
                        className={
                          band === 'EXPLORATORY'
                            ? 'bg-gray-600 text-white'
                            : band === 'INFORMED'
                            ? 'bg-fm-blue text-white'
                            : band === 'CONFIDENT'
                            ? 'bg-fm-green text-white'
                            : 'bg-fm-yellow text-gray-900'
                        }
                      >
                        {band}
                      </Badge>
                    </td>
                    <td className="text-right py-3 px-4 text-fm-white">{info.count}</td>
                    <td className="text-right py-3 px-4 text-fm-white">{info.percentage.toFixed(1)}%</td>
                    <td className="text-right py-3 px-4 text-fm-white">
                      ${(revenueProjection[band] || 0).toLocaleString()}
                    </td>
                    <td className="py-3 px-4 text-fm-muted text-sm">
                      {info.entities?.length > 0 ? info.entities.slice(0, 3).join(', ') + (info.entities.length > 3 ? '...' : '') : 'N/A'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
