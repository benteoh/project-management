"use client";

import { useState } from "react";
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

const TABS = ["Programme", "Forecast"] as const;
type Tab = (typeof TABS)[number];

export default function ProjectPage() {
  const project = mockProject;
  const cvr: ProjectCVR = mockCVR;
  const [activeTab, setActiveTab] = useState<Tab>("Programme");

  return (
    <div className="flex min-h-screen flex-col bg-zinc-50 font-sans">
      {/* Header */}
      <div className="px-6 pt-6 pb-0">
        <p className="text-sm text-zinc-500">{project.client}</p>
        <h1 className="text-2xl font-semibold text-zinc-900">{project.name}</h1>
        <p className="mt-1 text-sm text-zinc-400">
          {formatDate(project.startDate)} – {formatDate(project.endDate)} ·{" "}
          {project.office} · {project.status}
        </p>

        {/* Chrome-style tabs */}
        <div className="mt-5 flex items-end gap-0.5">
          {TABS.map((tab) => {
            const isActive = tab === activeTab;
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`relative px-6 py-2.5 text-sm font-medium transition-colors focus:outline-none ${
                  isActive
                    ? "rounded-t-lg border border-b-0 border-zinc-200 bg-white text-zinc-900"
                    : "rounded-t-lg text-zinc-500 hover:text-zinc-700"
                }`}
              >
                {tab}
              </button>
            );
          })}
          {/* bottom border that tabs sit on */}
          <div className="flex-1 border-b border-zinc-200" />
        </div>
      </div>

      {/* Tab content */}
      <div className="flex flex-1 bg-white border-x border-b border-zinc-200 mx-6">
        {/* empty — content goes here */}
      </div>
    </div>
  );
}
