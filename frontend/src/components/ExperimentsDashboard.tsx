import React, { useState, useEffect, useRef } from 'react';
import type {
  ScenarioSummary,
  ExperimentResult,
  ExperimentJobStatus,
} from '../types/simulation';
import { api } from '../services/api';
import {
  Play,
  RotateCcw,
  Download,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Users,
  Activity,
  Award,
  Sparkles,
  Info,
  MemoryStick,
  ShieldCheck,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

interface ExperimentsDashboardProps {
  scenarios: ScenarioSummary[];
  onOpenDemonstration: () => void;
}

export const ExperimentsDashboard: React.FC<ExperimentsDashboardProps> = ({
  scenarios,
  onOpenDemonstration,
}) => {
  // Configuration State
  const [selectedScenarioId, setSelectedScenarioId] = useState<string>('scenario_congested_corridor');
  const [occupantCount, setOccupantCount] = useState<number>(200);
  const [seedCount, setSeedCount] = useState<number>(20);
  const [startSeed, setStartSeed] = useState<number>(101);

  // Job Execution & Polling State
  const [jobStatus, setJobStatus] = useState<ExperimentJobStatus | null>(null);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [result, setResult] = useState<ExperimentResult | null>(null);
  const [loadedFromSaved, setLoadedFromSaved] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const pollingRef = useRef<number | null>(null);

  // Load saved Scenario B verified evidence on mount + clean polling interval on unmount
  useEffect(() => {
    let cancelled = false;
    api
      .getSavedExperiment('scenario_congested_corridor')
      .then((saved) => {
        if (!cancelled) {
          setResult((prev) => {
            if (prev) return prev;
            setLoadedFromSaved(true);
            return saved;
          });
        }
      })
      .catch(() => {
        // Optional preload if saved benchmark is unavailable
      });

    return () => {
      cancelled = true;
      if (pollingRef.current) {
        window.clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, []);

  // Poll job status
  const startPolling = (jobId: string) => {
    if (pollingRef.current) {
      window.clearInterval(pollingRef.current);
    }

    pollingRef.current = window.setInterval(async () => {
      try {
        const statusObj = await api.getExperimentStatus(jobId);
        setJobStatus(statusObj);

        if (statusObj.status === 'completed' && statusObj.result) {
          setResult(statusObj.result);
          setIsRunning(false);
          if (pollingRef.current) {
            window.clearInterval(pollingRef.current);
            pollingRef.current = null;
          }
        } else if (statusObj.status === 'failed') {
          setErrorMessage(statusObj.error || 'Experiment execution failed.');
          setIsRunning(false);
          if (pollingRef.current) {
            window.clearInterval(pollingRef.current);
            pollingRef.current = null;
          }
        }
      } catch (err) {
        console.error('Failed to poll experiment status:', err);
      }
    }, 1000);
  };

  // Trigger batch experiment
  const handleRunExperiment = async () => {
    try {
      setIsRunning(true);
      setErrorMessage(null);
      setLoadedFromSaved(false);
      setResult(null);

      const seedsList = Array.from({ length: seedCount }, (_, i) => startSeed + i);

      const res = await api.triggerBatchExperiment({
        scenario_id: selectedScenarioId,
        occupant_count: occupantCount,
        seeds: seedsList,
        max_sim_time_sec: 300.0,
        dt: 0.5,
      });

      setJobStatus({
        job_id: res.job_id,
        status: 'running',
        progress_pct: 0.0,
        completed_trials: 0,
        total_trials: seedsList.length,
        scenario_id: selectedScenarioId,
        occupant_count: occupantCount,
      });

      startPolling(res.job_id);
    } catch (err: unknown) {
      console.error('Trigger experiment error:', err);
      setIsRunning(false);
      setErrorMessage(err instanceof Error ? err.message : 'Failed to launch experiment.');
    }
  };

  // Prepare chart data
  const chartData = (result?.trials || []).map((t) => ({
    seed: `Seed ${t.seed}`,
    BaselineTime: t.baseline_metrics.total_evacuation_time_sec || 0,
    AdaptiveTime: t.adaptive_metrics.total_evacuation_time_sec || 0,
    BaselineQueue: t.baseline_metrics.max_exit_queue_length,
    AdaptiveQueue: t.adaptive_metrics.max_exit_queue_length,
    BaselineDensity: t.baseline_metrics.max_crowd_density,
    AdaptiveDensity: t.adaptive_metrics.max_crowd_density,
    Winner: t.winner,
  }));

  const summary = result?.summary;

  return (
    <div className="flex h-full w-full flex-col space-y-4 overflow-y-auto rounded-xl bg-slate-50 p-3 text-slate-800 sm:p-4">
      {/* 1. Page Header & Control Card */}
      <div className="bg-white rounded-lg border border-slate-200 p-4 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div>
            <div className="flex items-center space-x-2">
              <span className="bg-emerald-600 text-white font-mono font-bold text-xs px-2 py-0.5 rounded">
                PHASE 5
              </span>
              <h2 className="text-base font-bold text-slate-900">
                Reproducible Evidence Lab
              </h2>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Run paired-seed comparisons on identical initial conditions. Results are labelled by evidence strength and exported with explicit uncertainty and memory methodology.
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={onOpenDemonstration}
              className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-md shadow-sm transition flex items-center space-x-1.5"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>Interactive Demonstration</span>
            </button>
          </div>
        </div>

        <div className="mt-3 grid gap-3 border-t border-slate-100 pt-3 md:grid-cols-3">
          <div className="rounded-lg border border-emerald-200 bg-emerald-50/70 p-3">
            <div className="flex items-center gap-2 text-xs font-bold text-emerald-900">
              <ShieldCheck className="h-4 w-4" /> Paired fairness
            </div>
            <p className="mt-1 text-[11px] leading-relaxed text-emerald-800">Same geometry, spawn coordinates, mobility classes, free speeds, hazard schedule, physical engine, and seed.</p>
          </div>
          <div className="rounded-lg border border-amber-200 bg-amber-50/70 p-3">
            <div className="flex items-center gap-2 text-xs font-bold text-amber-900">
              <Info className="h-4 w-4" /> Sample-size rule
            </div>
            <p className="mt-1 text-[11px] leading-relaxed text-amber-800">Fewer than 10 completed pairs are preliminary. Use 20 paired seeds for the principal hackathon claim.</p>
          </div>
          <div className="rounded-lg border border-blue-200 bg-blue-50/70 p-3">
            <div className="flex items-center gap-2 text-xs font-bold text-blue-900">
              <MemoryStick className="h-4 w-4" /> Honest memory labels
            </div>
            <p className="mt-1 text-[11px] leading-relaxed text-blue-800">Python heap and total process RSS are reported separately; neither is relabelled as the other.</p>
          </div>
        </div>

        {/* Experiment Configuration Form */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mt-3 text-xs">
          {/* Scenario Selector */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">
              Scenario Selection
            </label>
            <select
              aria-label="Scenario for benchmark"
              value={selectedScenarioId}
              onChange={(e) => setSelectedScenarioId(e.target.value)}
              disabled={isRunning}
              className="w-full bg-slate-50 border border-slate-200 rounded p-1.5 text-xs text-slate-800 font-medium focus:ring-1 focus:ring-emerald-500"
            >
              {scenarios.map((sc) => (
                <option key={sc.id} value={sc.id}>
                  {sc.name}
                </option>
              ))}
            </select>
          </div>

          {/* Population Size */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">
              Population Size (N)
            </label>
            <select
              aria-label="Occupant population size"
              value={occupantCount}
              onChange={(e) => setOccupantCount(Number(e.target.value))}
              disabled={isRunning}
              className="w-full bg-slate-50 border border-slate-200 rounded p-1.5 text-xs text-slate-800 font-medium focus:ring-1 focus:ring-emerald-500"
            >
              <option value={100}>100 Occupants (Light)</option>
              <option value={150}>150 Occupants (Standard)</option>
              <option value={200}>200 Occupants (High)</option>
              <option value={250}>250 Occupants (Dense Stress)</option>
              <option value={500}>500 Occupants (Extreme Scale)</option>
            </select>
          </div>

          {/* Seeds Count & Start Seed */}
          <div className="flex space-x-2">
            <div className="flex-1">
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                Paired Seeds
              </label>
              <select
                aria-label="Paired seed count"
                value={seedCount}
                onChange={(e) => setSeedCount(Number(e.target.value))}
                disabled={isRunning}
                className="w-full bg-slate-50 border border-slate-200 rounded p-1.5 text-xs text-slate-800 font-medium focus:ring-1 focus:ring-emerald-500"
              >
                <option value={3}>3 Seeds (Quick)</option>
                <option value={5}>5 Seeds</option>
                <option value={10}>10 Seeds</option>
                <option value={20}>20 Seeds</option>
                <option value={30}>30 Seeds</option>
              </select>
            </div>
            <div className="w-20">
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                Base Seed
              </label>
              <input
                type="number"
                value={startSeed}
                onChange={(e) => setStartSeed(parseInt(e.target.value) || 1)}
                disabled={isRunning}
                className="w-full bg-slate-50 border border-slate-200 rounded p-1.5 text-xs text-slate-800 font-mono text-center focus:ring-1 focus:ring-emerald-500"
              />
            </div>
          </div>

          {/* Action Button */}
          <div className="flex items-end">
            <button
              onClick={handleRunExperiment}
              disabled={isRunning}
              className={`w-full py-1.5 px-3 rounded text-xs font-semibold shadow-sm transition flex items-center justify-center space-x-1.5 ${
                isRunning
                  ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                  : 'bg-emerald-600 hover:bg-emerald-700 text-white'
              }`}
            >
              {isRunning ? (
                <>
                  <RotateCcw className="w-3.5 h-3.5 animate-spin" />
                  <span>
                    Running ({jobStatus?.completed_trials || 0}/{jobStatus?.total_trials || seedCount})...
                  </span>
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5" />
                  <span>Execute Benchmark</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Live Progress Bar */}
        {isRunning && jobStatus && (
          <div className="mt-3 pt-3 border-t border-slate-100">
            <div className="flex justify-between items-center text-xs mb-1">
              <span className="text-slate-600 font-medium flex items-center space-x-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                <span>
                  Executing paired seed simulations ({jobStatus.completed_trials} of {jobStatus.total_trials})
                </span>
              </span>
              <span className="font-mono font-bold text-emerald-600">{jobStatus.progress_pct}%</span>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
              <div
                className="bg-emerald-500 h-2 rounded-full transition-all duration-300"
                style={{ width: `${jobStatus.progress_pct}%` }}
              ></div>
            </div>
          </div>
        )}

        {/* Error Advisory */}
        {errorMessage && (
          <div className="mt-3 bg-red-50 border border-red-200 text-red-800 p-2.5 rounded text-xs flex items-center space-x-2">
            <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}
      </div>

      {/* 2. Statistical Evidence Cards */}
      {summary && (
        <>
        <div
          className={`flex flex-col gap-2 rounded-lg border p-3 text-xs sm:flex-row sm:items-center sm:justify-between ${
            summary.evidence_tier === 'replicated'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
              : 'border-amber-200 bg-amber-50 text-amber-900'
          }`}
          role="status"
        >
          <div>
            <span className="font-bold uppercase tracking-wide">{summary.evidence_tier} evidence</span>
            {loadedFromSaved && (
              <span className="ml-2 rounded bg-emerald-100 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-emerald-900">
                Preloaded Verified Artifact ({result?.job_id})
              </span>
            )}
            <span className="ml-2">{summary.uncertainty_note}</span>
          </div>
          <span className="font-mono text-[11px]">{summary.completed_sample_size}/{summary.sample_size} completed pairs</span>
        </div>
        <div className="grid grid-cols-1 gap-3 text-xs md:grid-cols-2 xl:grid-cols-4">
          {/* Card 1: Time Improvement Delta */}
          <div className="bg-white rounded-lg border border-slate-200 p-3.5 shadow-sm">
            <div className="flex items-center justify-between text-slate-500 pb-1 border-b border-slate-50">
              <span className="text-[11px] font-semibold">Mean Evacuation Delta</span>
              <Clock className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="mt-2">
              <div className="flex items-baseline space-x-2">
                <span className="text-2xl font-bold font-mono text-slate-900">
                  {summary.mean_time_difference_sec !== null && summary.mean_time_difference_sec !== undefined
                    ? `${summary.mean_time_difference_sec > 0 ? '+' : ''}${summary.mean_time_difference_sec.toFixed(2)}s`
                    : 'N/A'}
                </span>
                {summary.mean_relative_improvement_pct !== null && summary.mean_relative_improvement_pct !== undefined && (
                  <span
                    className={`text-xs font-bold font-mono ${
                      summary.mean_relative_improvement_pct >= 0 ? 'text-emerald-600' : 'text-red-600'
                    }`}
                  >
                    ({summary.mean_relative_improvement_pct >= 0 ? '+' : ''}
                    {summary.mean_relative_improvement_pct.toFixed(2)}%)
                  </span>
                )}
              </div>
              <p className="text-[10px] text-slate-500 mt-1">
                Baseline: {summary.baseline_mean_time_sec?.toFixed(2) ?? 'N/A'}s · Adaptive:{' '}
                {summary.adaptive_mean_time_sec?.toFixed(2) ?? 'N/A'}s
              </p>
            </div>
          </div>

          {/* Card 2: 95% Confidence Interval */}
          <div className="bg-white rounded-lg border border-slate-200 p-3.5 shadow-sm">
            <div className="flex items-center justify-between text-slate-500 pb-1 border-b border-slate-50">
              <span className="text-[11px] font-semibold">95% Bootstrap CI</span>
              <Award className="w-4 h-4 text-blue-600" />
            </div>
            <div className="mt-2">
              <div className="text-base font-bold font-mono text-slate-900">
                [{summary.ci_95_lower?.toFixed(1) ?? 'N/A'}, {summary.ci_95_upper?.toFixed(1) ?? 'N/A'}] s
              </div>
              <p className="text-[10px] text-slate-500 mt-1">
                Percentile bootstrap (N=2000 resamples, seed=2026).
              </p>
            </div>
          </div>

          {/* Card 3: Permutation Test & Significance */}
          <div className="bg-white rounded-lg border border-slate-200 p-3.5 shadow-sm">
            <div className="flex items-center justify-between text-slate-500 pb-1 border-b border-slate-50">
              <span className="text-[11px] font-semibold">Adaptive benefit test</span>
              <CheckCircle2
                className={`w-4 h-4 ${summary.is_statistically_significant ? 'text-emerald-600' : 'text-slate-400'}`}
              />
            </div>
            <div className="mt-2">
              <div className="flex items-center space-x-2">
                <span className="text-xl font-bold font-mono text-slate-900">
                  p = {summary.p_value !== null && summary.p_value !== undefined ? summary.p_value.toFixed(4) : 'N/A'}
                </span>
                <span
                  className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                    summary.is_statistically_significant
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {summary.is_statistically_significant ? 'SUPPORTED' : 'NOT SUPPORTED'}
                </span>
              </div>
              <p className="text-[10px] text-slate-500 mt-1">Requires p&lt;0.05 and a confidence interval entirely above zero.</p>
            </div>
          </div>

          {/* Card 4: Win / Loss Record */}
          <div className="bg-white rounded-lg border border-slate-200 p-3.5 shadow-sm">
            <div className="flex items-center justify-between text-slate-500 pb-1 border-b border-slate-50">
              <span className="text-[11px] font-semibold">Head-to-Head Outcomes</span>
              <Activity className="w-4 h-4 text-amber-600" />
            </div>
            <div className="mt-2">
              <div className="flex items-center space-x-2 font-mono text-sm">
                <span className="text-emerald-700 font-bold">{summary.adaptive_wins} Wins</span>
                <span className="text-slate-300">|</span>
                <span className="text-slate-600">{summary.ties} Ties</span>
                <span className="text-slate-300">|</span>
                <span className="text-red-600 font-bold">{summary.baseline_wins} Loss</span>
              </div>
              <p className="text-[10px] text-slate-500 mt-1">Across {summary.sample_size} paired random seeds.</p>
            </div>
          </div>
        </div>
        <div className="grid gap-3 text-xs md:grid-cols-2">
          <div className="rounded-lg border border-slate-200 bg-white p-3.5 shadow-sm">
            <div className="font-semibold text-slate-700">Memory measurement</div>
            <div className="mt-2 flex flex-wrap gap-5 font-mono text-sm">
              <span>Python heap <strong>{summary.peak_python_heap_mb.toFixed(2)} MB</strong></span>
              <span>Process RSS <strong>{summary.peak_process_rss_mb.toFixed(2)} MB</strong></span>
            </div>
            <p className="mt-1 text-[10px] text-slate-500">{summary.memory_measurement_note}</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-3.5 shadow-sm">
            <div className="font-semibold text-slate-700">Wheelchair outcome</div>
            {summary.mean_wheelchair_time_difference_sec !== null && summary.mean_wheelchair_time_difference_sec !== undefined ? (
              <div className="mt-2">
                <span className={`font-mono text-lg font-bold ${summary.mean_wheelchair_time_difference_sec >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                  {summary.mean_wheelchair_time_difference_sec >= 0 ? '+' : ''}{summary.mean_wheelchair_time_difference_sec.toFixed(2)}s
                </span>
                <p className="mt-1 text-[10px] text-slate-500">Mean of per-seed wheelchair mean evacuation times; positive favors EXIT-ZERO.</p>
              </div>
            ) : <p className="mt-2 text-[11px] text-slate-500">Not available for this result. No accessibility benefit is inferred.</p>}
          </div>
        </div>
        </>
      )}

      {/* 3. Recharts Comparative Visualizations */}
      {result && chartData.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Chart 1: Evacuation Time Comparison per Seed */}
          <div className="bg-white rounded-lg border border-slate-200 p-4 shadow-sm">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 mb-3">
              <div className="flex items-center space-x-1.5">
                <Clock className="w-4 h-4 text-emerald-600" />
                <h3 className="font-semibold text-xs text-slate-900">
                  Total Evacuation Time by Seed (s)
                </h3>
              </div>
              <span className="text-[10px] text-slate-400 font-mono">Lower is faster</span>
            </div>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="seed" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} unit="s" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'rgba(15, 23, 42, 0.95)',
                      borderColor: '#334155',
                      color: '#ffffff',
                      fontSize: 11,
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="BaselineTime" name="Baseline (Shortest-Path)" fill="#94a3b8" radius={[2, 2, 0, 0]} />
                  <Bar dataKey="AdaptiveTime" name="EXIT-ZERO (Adaptive)" fill="#10b981" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Chart 2: Peak Exit Queue Length Comparison */}
          <div className="bg-white rounded-lg border border-slate-200 p-4 shadow-sm">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 mb-3">
              <div className="flex items-center space-x-1.5">
                <Users className="w-4 h-4 text-amber-600" />
                <h3 className="font-semibold text-xs text-slate-900">
                  Peak Exit Bottleneck Queue Length
                </h3>
              </div>
              <span className="text-[10px] text-slate-400 font-mono">Lower queue is better</span>
            </div>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="seed" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} unit=" pers" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'rgba(15, 23, 42, 0.95)',
                      borderColor: '#334155',
                      color: '#ffffff',
                      fontSize: 11,
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="BaselineQueue" name="Baseline Peak Queue" fill="#cbd5e1" radius={[2, 2, 0, 0]} />
                  <Bar dataKey="AdaptiveQueue" name="EXIT-ZERO Peak Queue" fill="#f59e0b" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* 4. Per-Seed Detailed Outcomes Table */}
      {result && result.trials.length > 0 && (
        <div className="bg-white rounded-lg border border-slate-200 p-4 shadow-sm">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 pb-3 border-b border-slate-100 mb-3">
            <div>
              <h3 className="font-semibold text-xs text-slate-900">
                Per-Seed Paired Experimental Trials ({result.trials.length} Runs)
              </h3>
              <p className="text-[10px] text-slate-500">
                Every row reflects paired simulations with 100% identical initial agent locations and physics.
              </p>
            </div>

            {/* Export Action Buttons */}
            <div className="flex items-center space-x-2">
              <a
                href={api.getExportCsvUrl(result.job_id)}
                download={`exit_zero_${result.scenario_id}_N${result.occupant_count}.csv`}
                className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded border border-slate-300 transition flex items-center space-x-1"
              >
                <Download className="w-3.5 h-3.5 text-slate-500" />
                <span>Export CSV</span>
              </a>
              <a
                href={api.getExportJsonUrl(result.job_id)}
                download={`exit_zero_${result.scenario_id}_N${result.occupant_count}.json`}
                className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded border border-slate-300 transition flex items-center space-x-1"
              >
                <Download className="w-3.5 h-3.5 text-slate-500" />
                <span>Export JSON</span>
              </a>
            </div>
          </div>

          <div className="overflow-x-auto max-h-80 overflow-y-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 text-slate-600 font-semibold text-[11px] border-b border-slate-200 sticky top-0">
                  <th className="p-2">Seed</th>
                  <th className="p-2">Outcome</th>
                  <th className="p-2 font-mono">Baseline Time</th>
                  <th className="p-2 font-mono">Adaptive Time</th>
                  <th className="p-2 font-mono">Delta (Time)</th>
                  <th className="p-2 font-mono">Gain %</th>
                  <th className="p-2 font-mono">Peak Queue</th>
                  <th className="p-2 font-mono">Peak Density</th>
                  <th className="p-2 font-mono">Reroutes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                {result.trials.map((t) => {
                  const isAdaptiveWin = t.winner === 'adaptive';
                  const isBaselineWin = t.winner === 'baseline';

                  return (
                    <tr key={t.seed} className="hover:bg-slate-50 transition">
                      <td className="p-2 font-bold text-slate-800">Seed {t.seed}</td>
                      <td className="p-2">
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-sans font-semibold ${
                            isAdaptiveWin
                              ? 'bg-emerald-100 text-emerald-800'
                              : isBaselineWin
                              ? 'bg-red-100 text-red-800'
                              : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {t.winner.toUpperCase()}
                        </span>
                      </td>
                      <td className="p-2 text-slate-600">
                        {t.baseline_metrics.total_evacuation_time_sec?.toFixed(1) ?? 'Timeout'}s
                      </td>
                      <td className="p-2 text-emerald-700 font-semibold">
                        {t.adaptive_metrics.total_evacuation_time_sec?.toFixed(1) ?? 'Timeout'}s
                      </td>
                      <td className="p-2 font-bold">
                        {t.diff_evacuation_time_sec !== null && t.diff_evacuation_time_sec !== undefined ? (
                          <span className={t.diff_evacuation_time_sec >= 0 ? 'text-emerald-600' : 'text-red-600'}>
                            {t.diff_evacuation_time_sec >= 0 ? '+' : ''}
                            {t.diff_evacuation_time_sec.toFixed(1)}s
                          </span>
                        ) : (
                          'N/A'
                        )}
                      </td>
                      <td className="p-2">
                        {t.relative_time_improvement_pct !== null && t.relative_time_improvement_pct !== undefined ? (
                          <span
                            className={
                              t.relative_time_improvement_pct >= 0 ? 'text-emerald-600' : 'text-red-600'
                            }
                          >
                            {t.relative_time_improvement_pct >= 0 ? '+' : ''}
                            {t.relative_time_improvement_pct.toFixed(1)}%
                          </span>
                        ) : (
                          'N/A'
                        )}
                      </td>
                      <td className="p-2 text-slate-700">
                        {t.baseline_metrics.max_exit_queue_length} → {t.adaptive_metrics.max_exit_queue_length}
                      </td>
                      <td className="p-2 text-slate-700">
                        {t.baseline_metrics.max_crowd_density.toFixed(2)} → {t.adaptive_metrics.max_crowd_density.toFixed(2)}
                      </td>
                      <td className="p-2 text-slate-600 font-sans">
                        {t.adaptive_metrics.total_reroutes || 0}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 5. Scientific Disclaimer & Limitations Footer */}
      <div className="bg-slate-100 rounded-lg border border-slate-200 p-3 text-slate-500 text-[11px] leading-relaxed">
        <span className="font-semibold text-slate-700">Methodology & Empirical Notice: </span>
        {result?.methodology_notes ||
          'All simulations use deterministic random seeds and continuous Weidmann speed-density deceleration. Density thresholds indicate local spatial concentration and do not represent clinically validated injury or crush criteria.'}
      </div>
    </div>
  );
};
