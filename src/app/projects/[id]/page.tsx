"use client";

import {
  mockProject,
  mockScopes,
  mockActivities,
  mockCVR,
} from "@/mocks/projects";
import { ProjectCVR, WeeklyTrendPoint } from "@/types/api";
import { Scope, Activity } from "@/types/project";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

function formatCurrency(value: number) {
  return `£${value.toLocaleString("en-GB")}`;
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-GB", {
    month: "short",
    year: "numeric",
  });
}

function SummaryCard({
  label,
  value,
  sub,
  alert,
}: {
  label: string;
  value: string;
  sub?: string;
  alert?: boolean;
}) {
  return (
    <div
      className={`rounded-lg border bg-white p-4 ${
        alert ? "border-red-300 bg-red-50" : "border-zinc-200"
      }`}
    >
      <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
        {label}
      </p>
      <p
        className={`mt-1 text-2xl font-semibold ${
          alert ? "text-red-700" : "text-zinc-900"
        }`}
      >
        {value}
      </p>
      {sub && <p className="mt-0.5 text-sm text-zinc-500">{sub}</p>}
    </div>
  );
}

function CVRChart({ data }: { data: WeeklyTrendPoint[] }) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4">
      <h2 className="mb-4 text-sm font-semibold text-zinc-700">
        CVR Trend — Progress vs Budget Consumed
      </h2>
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={data} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
          <XAxis
            dataKey="week"
            tickFormatter={(v) => formatDate(v)}
            tick={{ fontSize: 11 }}
            tickLine={false}
          />
          <YAxis
            unit="%"
            domain={[0, 100]}
            tick={{ fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            width={36}
          />
          <Tooltip
            formatter={(value, name) => [
              `${value}%`,
              name === "progressPercent" ? "Progress" : "Budget Consumed",
            ]}
            labelFormatter={(label) => formatDate(label)}
          />
          <Legend
            formatter={(value) =>
              value === "progressPercent" ? "Progress" : "Budget Consumed"
            }
            wrapperStyle={{ fontSize: 12 }}
          />
          <Line
            type="monotone"
            dataKey="progressPercent"
            stroke="#2563eb"
            strokeWidth={2}
            dot={false}
          />
          <Line
            type="monotone"
            dataKey="budgetConsumedPercent"
            stroke="#dc2626"
            strokeWidth={2}
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function ActivityRow({ activity }: { activity: Activity }) {
  const variance = activity.estimatedHours - activity.actualHours;
  const isOver = variance < 0;
  return (
    <tr className="border-b border-zinc-100 last:border-0 hover:bg-zinc-50">
      <td className="py-2 pl-10 pr-4 text-sm text-zinc-700">
        <span className="mr-1.5 text-zinc-300">└</span>
        {activity.title}
      </td>
      <td className="py-2 pr-4 text-sm capitalize text-zinc-500">
        {activity.activityType.replace(/_/g, " ")}
      </td>
      <td className="py-2 pr-4 text-right text-sm text-zinc-700">
        {activity.estimatedHours}h
      </td>
      <td className="py-2 pr-4 text-right text-sm text-zinc-700">
        {activity.actualHours}h
      </td>
      <td
        className={`py-2 pr-4 text-right text-sm font-medium ${
          isOver ? "text-red-600" : "text-green-700"
        }`}
      >
        {isOver ? "" : "+"}
        {variance}h
      </td>
      <td className="py-2 pl-4">
        <div className="flex items-center gap-2">
          <div className="h-1.5 w-16 overflow-hidden rounded-full bg-zinc-100">
            <div
              className="h-full rounded-full bg-blue-500"
              style={{ width: `${activity.progress}%` }}
            />
          </div>
          <span className="text-xs text-zinc-500">{activity.progress}%</span>
        </div>
      </td>
    </tr>
  );
}

function ScopeRow({
  scope,
  activities,
}: {
  scope: Scope;
  activities: Activity[];
}) {
  const variance = scope.estimatedHours - scope.actualHours;
  const isOver = variance < 0;
  return (
    <>
      <tr className="border-b border-zinc-200 bg-zinc-50">
        <td className="py-2.5 pr-4 text-sm font-medium text-zinc-900">
          {scope.title}
        </td>
        <td className="py-2.5 pr-4 text-sm capitalize text-zinc-400">
          {scope.status.replace(/_/g, " ")}
        </td>
        <td className="py-2.5 pr-4 text-right text-sm font-medium text-zinc-700">
          {scope.estimatedHours}h
        </td>
        <td className="py-2.5 pr-4 text-right text-sm font-medium text-zinc-700">
          {scope.actualHours}h
        </td>
        <td
          className={`py-2.5 pr-4 text-right text-sm font-medium ${
            isOver ? "text-red-600" : "text-green-700"
          }`}
        >
          {isOver ? "" : "+"}
          {variance}h
        </td>
        <td className="py-2.5 pl-4">
          <div className="flex items-center gap-2">
            <div className="h-1.5 w-16 overflow-hidden rounded-full bg-zinc-200">
              <div
                className="h-full rounded-full bg-blue-500"
                style={{ width: `${scope.progress}%` }}
              />
            </div>
            <span className="text-xs text-zinc-500">{scope.progress}%</span>
          </div>
        </td>
      </tr>
      {activities.map((a) => (
        <ActivityRow key={a.id} activity={a} />
      ))}
    </>
  );
}

export default function ProjectPage() {
  const project = mockProject;
  const scopes = mockScopes;
  const cvr: ProjectCVR = mockCVR;

  const overspending = cvr.budgetConsumedPercent > cvr.progressPercent;

  return (
    <div className="min-h-screen bg-zinc-50 p-6 font-sans">
      {/* Header */}
      <div className="mb-6">
        <p className="text-sm text-zinc-500">{project.client}</p>
        <h1 className="text-2xl font-semibold text-zinc-900">{project.name}</h1>
        <p className="mt-1 text-sm text-zinc-400">
          {formatDate(project.startDate)} – {formatDate(project.endDate)} ·{" "}
          {project.office} · {project.status}
        </p>
      </div>

      {/* Summary cards */}
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <SummaryCard label="Fixed Fee" value={formatCurrency(cvr.fixedFee)} />
        <SummaryCard
          label="Spent to Date"
          value={formatCurrency(cvr.totalSpent)}
          sub={`${cvr.budgetConsumedPercent}% of fee`}
          alert={overspending}
        />
        <SummaryCard
          label="Profit"
          value={formatCurrency(cvr.profit)}
          sub={`${cvr.profitPercent}% margin`}
        />
        <SummaryCard
          label="EAC"
          value={formatCurrency(cvr.eac)}
          sub={`${formatCurrency(cvr.costToComplete)} to complete`}
        />
      </div>

      {/* CVR Chart */}
      <div className="mb-6">
        <CVRChart data={cvr.weeklyTrend} />
      </div>

      {/* WBS Table */}
      <div className="rounded-lg border border-zinc-200 bg-white">
        <div className="border-b border-zinc-200 px-4 py-3">
          <h2 className="text-sm font-semibold text-zinc-700">
            Work Breakdown
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-zinc-100 text-left">
                <th className="py-2 pr-4 text-xs font-medium uppercase tracking-wide text-zinc-400">
                  Scope / Activity
                </th>
                <th className="py-2 pr-4 text-xs font-medium uppercase tracking-wide text-zinc-400">
                  Type / Status
                </th>
                <th className="py-2 pr-4 text-right text-xs font-medium uppercase tracking-wide text-zinc-400">
                  Est.
                </th>
                <th className="py-2 pr-4 text-right text-xs font-medium uppercase tracking-wide text-zinc-400">
                  Actual
                </th>
                <th className="py-2 pr-4 text-right text-xs font-medium uppercase tracking-wide text-zinc-400">
                  Variance
                </th>
                <th className="py-2 pl-4 text-xs font-medium uppercase tracking-wide text-zinc-400">
                  Progress
                </th>
              </tr>
            </thead>
            <tbody>
              {scopes.map((scope) => (
                <ScopeRow
                  key={scope.id}
                  scope={scope}
                  activities={mockActivities[scope.id] ?? []}
                />
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
