'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface CategoryPerformanceChartProps {
  data?: any;
}

export default function CategoryPerformanceChart({ data }: CategoryPerformanceChartProps) {
  const categories = data?.categories || {};
  const summary = data?.summary || {};

  // Prepare data for bar chart
  const chartData = Object.entries(categories).map(([category, stats]: [string, any]) => ({
    category: category.length > 20 ? category.substring(0, 20) + '...' : category,
    fullCategory: category,
    acceptRate: (stats.accept_rate * 100).toFixed(1),
    weakAcceptRate: (stats.weak_accept_rate * 100).toFixed(1),
    rejectRate: (stats.reject_rate * 100).toFixed(1),
    totalIterations: stats.total_iterations,
    roi: stats.roi
  }));

  const getROIColor = (roi: string) => {
    switch (roi) {
      case 'VERY_HIGH':
        return 'bg-green-600 text-white';
      case 'HIGH':
        return 'bg-blue-600 text-white';
      case 'MEDIUM':
        return 'bg-yellow-600 text-white';
      case 'LOW':
        return 'bg-red-600 text-white';
      default:
        return 'bg-gray-600 text-white';
    }
  };

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid gap-6 md:grid-cols-3">
        <Card className="bg-custom-box border-custom-border">
          <CardHeader>
            <CardTitle className="text-sm font-medium text-fm-muted">Total Categories</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-fm-white">{summary.total_categories}</div>
          </CardContent>
        </Card>

        <Card className="bg-custom-box border-custom-border">
          <CardHeader>
            <CardTitle className="text-sm font-medium text-fm-muted">Best Category</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm font-bold text-fm-green">{summary.best_category}</div>
          </CardContent>
        </Card>

        <Card className="bg-custom-box border-custom-border">
          <CardHeader>
            <CardTitle className="text-sm font-medium text-fm-muted">Worst Category</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm font-bold text-fm-yellow">{summary.worst_category}</div>
          </CardContent>
        </Card>
      </div>

      {/* Bar Chart */}
      <Card className="bg-custom-box border-custom-border">
        <CardHeader>
          <CardTitle className="text-fm-white">Category Performance</CardTitle>
          <CardDescription className="text-fm-muted">
            Accept, weak accept, and reject rates by category
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={400}>
            <BarChart
              data={chartData}
              layout="vertical"
              margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis
                type="number"
                stroke="#9ca3af"
                tick={{ fill: '#9ca3af' }}
              />
              <YAxis
                type="category"
                dataKey="category"
                stroke="#9ca3af"
                tick={{ fill: '#9ca3af' }}
                width={150}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1f2937',
                  border: '1px solid #374151',
                  borderRadius: '0.375rem',
                  color: '#ffffff'
                }}
                formatter={(value: any, name: string) => [`${value}%`, name]}
              />
              <Legend
                wrapperStyle={{ color: '#ffffff' }}
              />
              <Bar dataKey="acceptRate" name="Accept Rate" fill="#22c55e" />
              <Bar dataKey="weakAcceptRate" name="Weak Accept Rate" fill="#3b82f6" />
              <Bar dataKey="rejectRate" name="Reject Rate" fill="#ef4444" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Detailed Table */}
      <Card className="bg-custom-box border-custom-border">
        <CardHeader>
          <CardTitle className="text-fm-white">Detailed Category Metrics</CardTitle>
          <CardDescription className="text-fm-muted">
            Full breakdown with ROI indicators and recommendations
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-custom-border">
                  <th className="text-left py-3 px-4 text-fm-white font-semibold">Category</th>
                  <th className="text-right py-3 px-4 text-fm-white font-semibold">Iterations</th>
                  <th className="text-right py-3 px-4 text-fm-white font-semibold">Accepts</th>
                  <th className="text-right py-3 px-4 text-fm-white font-semibold">Weak Accepts</th>
                  <th className="text-right py-3 px-4 text-fm-white font-semibold">Rejects</th>
                  <th className="text-right py-3 px-4 text-fm-white font-semibold">Accept Rate</th>
                  <th className="text-center py-3 px-4 text-fm-white font-semibold">ROI</th>
                  <th className="text-left py-3 px-4 text-fm-white font-semibold">Recommendation</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(categories).map(([category, stats]: [string, any]) => (
                  <tr key={category} className="border-b border-custom-border hover:bg-custom-border">
                    <td className="py-4 px-4 text-fm-white">{category}</td>
                    <td className="text-right py-4 px-4 text-fm-white">{stats.total_iterations}</td>
                    <td className="text-right py-4 px-4 text-fm-white">{stats.accepts}</td>
                    <td className="text-right py-4 px-4 text-fm-white">{stats.weak_accepts}</td>
                    <td className="text-right py-4 px-4 text-fm-white">{stats.rejects}</td>
                    <td className="text-right py-4 px-4 text-fm-white">
                      {(stats.accept_rate * 100).toFixed(1)}%
                    </td>
                    <td className="text-center py-4 px-4">
                      <Badge className={getROIColor(stats.roi)}>
                        {stats.roi}
                      </Badge>
                    </td>
                    <td className="py-4 px-4 text-fm-muted text-sm max-w-md truncate">
                      {stats.recommendation}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {Object.keys(categories).length === 0 && (
            <div className="text-center py-8 text-fm-muted">
              No category data available
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
