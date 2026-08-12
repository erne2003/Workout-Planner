import React, { useState, useMemo } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  AreaChart,
  Area,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import {
  Dumbbell,
  TrendingUp,
  Flame,
  Trophy,
  Calendar,
  Plus,
  Activity,
  Scale,
  Target,
  Filter,
  CheckCircle2,
  ChevronRight,
  Sparkles,
  BarChart2,
  User,
  Award,
  Search,
  X,
  Zap,
  ArrowUpRight,
  Download,
  Info,
  Layers,
  ChevronDown,
} from 'lucide-react';
import { Toaster, toast } from 'sonner';

// Types
type WeightUnit = 'lbs' | 'kg';
type TimeRange = '4w' | '12w' | '6m' | '1y';
type MetricCategory = 'strength' | 'volume' | 'body' | 'radar';

interface WorkoutLog {
  id: string;
  date: string;
  exercise: string;
  weightLbs: number;
  reps: number;
  rpe: number;
  estimated1RM: number;
  notes: string;
  isPR?: boolean;
}

interface MetricCardData {
  title: string;
  valueLbs: string;
  valueKg: string;
  change: string;
  isPositive: boolean;
  subtext: string;
  icon: React.ElementType;
  accentColor: string;
}

// Initial Mock Data
const INITIAL_LOGS: WorkoutLog[] = [
  { id: '1', date: '2026-07-24', exercise: 'Barbell Squat', weightLbs: 385, reps: 3, rpe: 8.5, estimated1RM: 418, notes: 'Felt explosive on drive. Depth clean.', isPR: true },
  { id: '2', date: '2026-07-22', exercise: 'Bench Press', weightLbs: 275, reps: 4, rpe: 9.0, estimated1RM: 302, notes: 'Paused reps. Bar path solid.', isPR: true },
  { id: '3', date: '2026-07-20', exercise: 'Conventional Deadlift', weightLbs: 465, reps: 2, rpe: 8.0, estimated1RM: 492, notes: 'Hook grip locked. Smooth lockout.', isPR: false },
  { id: '4', date: '2026-07-18', exercise: 'Overhead Press', weightLbs: 175, reps: 5, rpe: 8.5, estimated1RM: 202, notes: 'Good core brace.', isPR: false },
  { id: '5', date: '2026-07-15', exercise: 'Barbell Squat', weightLbs: 375, reps: 4, rpe: 8.0, estimated1RM: 412, notes: 'Slight knee cave on final rep.', isPR: false },
  { id: '6', date: '2026-07-12', exercise: 'Bench Press', weightLbs: 265, reps: 5, rpe: 8.5, estimated1RM: 298, notes: 'Chest pump heavy.', isPR: false },
  { id: '7', date: '2026-07-10', exercise: 'Conventional Deadlift', weightLbs: 455, reps: 3, rpe: 8.5, estimated1RM: 489, notes: 'Fast off the floor.', isPR: false },
  { id: '8', date: '2026-07-05', exercise: 'Barbell Squat', weightLbs: 365, reps: 5, rpe: 8.0, estimated1RM: 401, notes: 'Warmup block peak.', isPR: false },
];

const STRENGTH_TREND_DATA = [
  { week: 'W1', date: 'May 04', bench: 250, squat: 345, deadlift: 420, ohp: 155, total: 1015 },
  { week: 'W2', date: 'May 11', bench: 255, squat: 350, deadlift: 425, ohp: 160, total: 1030 },
  { week: 'W3', date: 'May 18', bench: 255, squat: 360, deadlift: 435, ohp: 160, total: 1050 },
  { week: 'W4', date: 'May 25', bench: 260, squat: 365, deadlift: 440, ohp: 165, total: 1065 },
  { week: 'W5', date: 'Jun 01', bench: 265, squat: 370, deadlift: 445, ohp: 165, total: 1080 },
  { week: 'W6', date: 'Jun 08', bench: 270, squat: 375, deadlift: 450, ohp: 170, total: 1095 },
  { week: 'W7', date: 'Jun 15', bench: 270, squat: 380, deadlift: 455, ohp: 170, total: 1105 },
  { week: 'W8', date: 'Jun 22', bench: 275, squat: 390, deadlift: 465, ohp: 175, total: 1130 },
  { week: 'W9', date: 'Jun 29', bench: 280, squat: 395, deadlift: 470, ohp: 180, total: 1145 },
  { week: 'W10', date: 'Jul 06', bench: 285, squat: 405, deadlift: 480, ohp: 185, total: 1170 },
  { week: 'W11', date: 'Jul 13', bench: 290, squat: 410, deadlift: 485, ohp: 190, total: 1185 },
  { week: 'W12', date: 'Jul 20', bench: 300, squat: 418, deadlift: 495, ohp: 195, total: 1213 },
];

const VOLUME_DATA = [
  { week: 'Week 1', tonnage: 34200, sets: 68, avgRpe: 7.5, fatigue: 62 },
  { week: 'Week 2', tonnage: 36800, sets: 72, avgRpe: 7.8, fatigue: 68 },
  { week: 'Week 3', tonnage: 41000, sets: 78, avgRpe: 8.2, fatigue: 76 },
  { week: 'Week 4', tonnage: 28000, sets: 45, avgRpe: 6.5, fatigue: 40 }, // Deload
  { week: 'Week 5', tonnage: 38500, sets: 74, avgRpe: 7.9, fatigue: 70 },
  { week: 'Week 6', tonnage: 43200, sets: 80, avgRpe: 8.4, fatigue: 82 },
  { week: 'Week 7', tonnage: 45100, sets: 84, avgRpe: 8.7, fatigue: 88 },
  { week: 'Week 8', tonnage: 48250, sets: 88, avgRpe: 8.9, fatigue: 91 },
];

const BODY_COMP_DATA = [
  { date: 'May 1', weight: 192.5, bodyFat: 16.8, leanMass: 160.1, waist: 33.5 },
  { date: 'May 15', weight: 191.0, bodyFat: 16.2, leanMass: 160.0, waist: 33.2 },
  { date: 'Jun 1', weight: 189.2, bodyFat: 15.6, leanMass: 159.7, waist: 32.8 },
  { date: 'Jun 15', weight: 188.0, bodyFat: 15.1, leanMass: 159.6, waist: 32.5 },
  { date: 'Jul 1', weight: 186.4, bodyFat: 14.7, leanMass: 159.0, waist: 32.1 },
  { date: 'Jul 15', weight: 185.0, bodyFat: 14.3, leanMass: 158.5, waist: 31.8 },
  { date: 'Jul 24', weight: 184.2, bodyFat: 14.0, leanMass: 158.4, waist: 31.5 },
];

const MUSCLE_RADAR = [
  { subject: 'Chest', volume: 88, frequency: 90, target: 100 },
  { subject: 'Back / Lats', volume: 95, frequency: 95, target: 100 },
  { subject: 'Quads', volume: 90, frequency: 85, target: 100 },
  { subject: 'Hamstrings', volume: 82, frequency: 80, target: 100 },
  { subject: 'Shoulders', volume: 78, frequency: 85, target: 100 },
  { subject: 'Arms', volume: 75, frequency: 80, target: 100 },
  { subject: 'Core', volume: 65, frequency: 70, target: 100 },
];

const PR_MILESTONES = [
  { id: 'm1', name: '300 lb Bench Press Club', target: 300, current: 300, category: 'Bench Press', achieved: true, color: 'from-amber-500 to-yellow-300' },
  { id: 'm2', name: '400 lb Barbell Squat', target: 400, current: 418, category: 'Barbell Squat', achieved: true, color: 'from-emerald-400 to-teal-200' },
  { id: 'm3', name: '500 lb Deadlift Quest', target: 500, current: 495, category: 'Deadlift', achieved: false, color: 'from-cyan-500 to-blue-400' },
  { id: 'm4', name: '1,200 lb Big-3 Total', target: 1200, current: 1213, category: 'Combined', achieved: true, color: 'from-purple-500 to-indigo-300' },
];

export default function App() {
  // State
  const [unit, setUnit] = useState<WeightUnit>('lbs');
  const [timeRange, setTimeRange] = useState<TimeRange>('12w');
  const [activeTab, setActiveTab] = useState<MetricCategory>('strength');
  const [selectedExercise, setSelectedExercise] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [logs, setLogs] = useState<WorkoutLog[]>(INITIAL_LOGS);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);

  // New workout form state
  const [newExercise, setNewExercise] = useState<string>('Barbell Squat');
  const [newWeight, setNewWeight] = useState<string>('395');
  const [newReps, setNewReps] = useState<string>('3');
  const [newRpe, setNewRpe] = useState<string>('8.5');
  const [newNotes, setNewNotes] = useState<string>('Peak week double.');

  // Helper conversions
  const convertWeight = (valInLbs: number, toUnit: WeightUnit): number => {
    if (toUnit === 'kg') {
      return Math.round(valInLbs * 0.45359237);
    }
    return valInLbs;
  };

  const formatWeight = (valInLbs: number): string => {
    const val = convertWeight(valInLbs, unit);
    return `${val.toLocaleString()} ${unit}`;
  };

  // Unit toggle handler
  const toggleUnit = (newUnit: WeightUnit) => {
    setUnit(newUnit);
    toast.success(`Switched weight display to ${newUnit.toUpperCase()}`);
  };

  // Filtered Logs
  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      const matchesExercise =
        selectedExercise === 'all' || log.exercise.toLowerCase().includes(selectedExercise.toLowerCase());
      const matchesSearch =
        log.exercise.toLowerCase().includes(searchQuery.toLowerCase()) ||
        log.notes.toLowerCase().includes(searchQuery.toLowerCase()) ||
        log.date.includes(searchQuery);
      return matchesExercise && matchesSearch;
    });
  }, [logs, selectedExercise, searchQuery]);

  // Chart Data with Unit support
  const strengthChartData = useMemo(() => {
    return STRENGTH_TREND_DATA.map((item) => ({
      ...item,
      benchDisplay: convertWeight(item.bench, unit),
      squatDisplay: convertWeight(item.squat, unit),
      deadliftDisplay: convertWeight(item.deadlift, unit),
      ohpDisplay: convertWeight(item.ohp, unit),
      totalDisplay: convertWeight(item.total, unit),
    }));
  }, [unit]);

  const volumeChartData = useMemo(() => {
    return VOLUME_DATA.map((item) => ({
      ...item,
      tonnageDisplay: convertWeight(item.tonnage, unit),
    }));
  }, [unit]);

  const bodyChartData = useMemo(() => {
    return BODY_COMP_DATA.map((item) => ({
      ...item,
      weightDisplay: convertWeight(item.weight, unit),
      leanMassDisplay: convertWeight(item.leanMass, unit),
    }));
  }, [unit]);

  // Submit New Log Entry
  const handleAddWorkout = (e: React.FormEvent) => {
    e.preventDefault();
    const weightNum = parseFloat(newWeight) || 0;
    const repsNum = parseInt(newReps) || 1;
    const rpeNum = parseFloat(newRpe) || 8;

    // Weight input assumes current selected unit
    const weightInLbs = unit === 'kg' ? Math.round(weightNum / 0.45359237) : weightNum;

    // Brzycki 1RM Formula: W * (36 / (37 - reps))
    const e1RM = Math.round(weightInLbs * (36 / (37 - Math.min(repsNum, 10))));

    const newLog: WorkoutLog = {
      id: Date.now().toString(),
      date: new Date().toISOString().split('T')[0],
      exercise: newExercise,
      weightLbs: weightInLbs,
      reps: repsNum,
      rpe: rpeNum,
      estimated1RM: e1RM,
      notes: newNotes,
      isPR: e1RM > 300,
    };

    setLogs([newLog, ...logs]);
    setIsModalOpen(false);
    toast.success('Workout logged successfully!', {
      description: `New Estimated 1RM for ${newExercise}: ${convertWeight(e1RM, unit)} ${unit}`,
    });
  };

  return (
    <div className="min-h-screen bg-[#090d14] text-slate-100 flex flex-col font-sans selection:bg-[#ccff00] selection:text-black">
      <Toaster position="top-right" theme="dark" />

      {/* HEADER BAR */}
      <header className="border-b border-slate-800/80 bg-[#0d131f]/90 backdrop-blur sticky top-0 z-30 px-4 lg:px-8 py-3.5 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="size-10 rounded-xl bg-[#ccff00] text-black flex items-center justify-center font-black text-xl tracking-wider shadow-[0_0_20px_rgba(204,255,0,0.3)]">
            <Zap className="size-6 fill-black" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold tracking-wider text-lg uppercase bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
                APEX ATHLETICS
              </span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[#ccff00]/10 text-[#ccff00] border border-[#ccff00]/30 font-semibold uppercase tracking-widest">
                PRO ENGINE v3.4
              </span>
            </div>
            <p className="text-xs text-slate-400 font-mono">ATHLETE // MARCUS VANCE — POWERBUILDING PROGRAM</p>
          </div>
        </div>

        {/* CONTROLS & UTILITIES */}
        <div className="flex items-center gap-3">
          {/* Unit Switcher */}
          <div className="flex items-center bg-slate-900/90 border border-slate-800 rounded-lg p-1">
            <button
              onClick={() => toggleUnit('lbs')}
              className={`px-3 py-1 rounded-md text-xs font-mono font-bold transition-all ${
                unit === 'lbs'
                  ? 'bg-[#ccff00] text-black shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              LBS
            </button>
            <button
              onClick={() => toggleUnit('kg')}
              className={`px-3 py-1 rounded-md text-xs font-mono font-bold transition-all ${
                unit === 'kg'
                  ? 'bg-[#ccff00] text-black shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              KG
            </button>
          </div>

          {/* Timeframe Selector */}
          <div className="hidden sm:flex items-center bg-slate-900/90 border border-slate-800 rounded-lg p-1">
            {(['4w', '12w', '6m', '1y'] as TimeRange[]).map((range) => (
              <button
                key={range}
                onClick={() => setTimeRange(range)}
                className={`px-2.5 py-1 rounded-md text-xs font-mono transition-all ${
                  timeRange === range
                    ? 'bg-slate-800 text-[#ccff00] font-semibold border border-slate-700'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {range.toUpperCase()}
              </button>
            ))}
          </div>

          {/* Quick Action button */}
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 bg-[#ccff00] hover:bg-[#b8e600] text-black font-bold text-sm px-4 py-2 rounded-xl transition-all shadow-[0_0_20px_rgba(204,255,0,0.25)] hover:shadow-[0_0_30px_rgba(204,255,0,0.4)] active:scale-95"
          >
            <Plus className="size-4 stroke-[3]" />
            <span>LOG SESSION</span>
          </button>
        </div>
      </header>

      {/* MAIN CONTAINER */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-6 lg:p-8 space-y-8">
        
        {/* KPI METRIC CARDS */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          
          {/* Card 1: Estimated Big 3 Total */}
          <div className="bg-[#111827] border border-slate-800 rounded-2xl p-5 relative overflow-hidden group hover:border-[#ccff00]/40 transition-all duration-300">
            <div className="absolute top-0 right-0 w-32 h-32 bg-[#ccff00]/5 rounded-full blur-2xl group-hover:bg-[#ccff00]/10 transition-all" />
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-mono text-slate-400 tracking-wider uppercase flex items-center gap-1.5">
                <Trophy className="size-4 text-[#ccff00]" />
                BIG-3 TOTAL 1RM
              </span>
              <span className="text-xs font-mono font-bold text-emerald-400 bg-emerald-950/60 border border-emerald-800/50 px-2 py-0.5 rounded-full flex items-center gap-0.5">
                <ArrowUpRight className="size-3" /> +45 {unit}
              </span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-extrabold font-mono tracking-tight text-white">
                {formatWeight(1213)}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-2 flex items-center gap-1">
              <span className="text-[#ccff00] font-semibold">98.2%</span> of 1,200 {unit} target
            </p>
            <div className="mt-3 w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
              <div className="bg-gradient-to-r from-yellow-400 to-[#ccff00] h-full w-[98.2%]" />
            </div>
          </div>

          {/* Card 2: Peak Bench Press 1RM */}
          <div className="bg-[#111827] border border-slate-800 rounded-2xl p-5 relative overflow-hidden group hover:border-cyan-500/40 transition-all duration-300">
            <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/5 rounded-full blur-2xl group-hover:bg-cyan-500/10 transition-all" />
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-mono text-slate-400 tracking-wider uppercase flex items-center gap-1.5">
                <Dumbbell className="size-4 text-cyan-400" />
                PEAK BENCH 1RM
              </span>
              <span className="text-xs font-mono font-bold text-cyan-400 bg-cyan-950/60 border border-cyan-800/50 px-2 py-0.5 rounded-full flex items-center gap-0.5">
                <ArrowUpRight className="size-3" /> +15 {unit}
              </span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-extrabold font-mono tracking-tight text-white">
                {formatWeight(300)}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-2 flex items-center gap-1">
              <span className="text-cyan-400 font-semibold">PR Reached</span> 4 days ago
            </p>
            <div className="mt-3 w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
              <div className="bg-gradient-to-r from-cyan-500 to-blue-400 h-full w-[100%]" />
            </div>
          </div>

          {/* Card 3: Weekly Training Tonnage */}
          <div className="bg-[#111827] border border-slate-800 rounded-2xl p-5 relative overflow-hidden group hover:border-purple-500/40 transition-all duration-300">
            <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/5 rounded-full blur-2xl group-hover:bg-purple-500/10 transition-all" />
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-mono text-slate-400 tracking-wider uppercase flex items-center gap-1.5">
                <Flame className="size-4 text-purple-400" />
                WEEKLY TONNAGE
              </span>
              <span className="text-xs font-mono font-bold text-purple-400 bg-purple-950/60 border border-purple-800/50 px-2 py-0.5 rounded-full flex items-center gap-0.5">
                +12.4% Vol
              </span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-extrabold font-mono tracking-tight text-white">
                {formatWeight(48250)}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-2 flex items-center gap-1">
              88 Working sets logged this week
            </p>
            <div className="mt-3 w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
              <div className="bg-gradient-to-r from-purple-500 to-indigo-400 h-full w-[88%]" />
            </div>
          </div>

          {/* Card 4: Body Comp & Lean Mass */}
          <div className="bg-[#111827] border border-slate-800 rounded-2xl p-5 relative overflow-hidden group hover:border-emerald-500/40 transition-all duration-300">
            <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-2xl group-hover:bg-emerald-500/10 transition-all" />
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-mono text-slate-400 tracking-wider uppercase flex items-center gap-1.5">
                <Scale className="size-4 text-emerald-400" />
                BODY COMP
              </span>
              <span className="text-xs font-mono font-bold text-emerald-400 bg-emerald-950/60 border border-emerald-800/50 px-2 py-0.5 rounded-full">
                14.0% BF
              </span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-extrabold font-mono tracking-tight text-white">
                {formatWeight(184.2)}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-2 flex items-center gap-1">
              Lean Mass: <span className="text-white font-medium">{formatWeight(158.4)}</span> (-2.8% Fat)
            </p>
            <div className="mt-3 w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
              <div className="bg-gradient-to-r from-emerald-500 to-teal-300 h-full w-[78%]" />
            </div>
          </div>

        </section>

        {/* PRIMARY INTERACTIVE CHART SECTION */}
        <section className="bg-[#111827] border border-slate-800 rounded-2xl p-5 lg:p-6 shadow-xl space-y-6">
          
          {/* CHART TAB NAVIGATION & FILTERS */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-5">
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => setActiveTab('strength')}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-mono text-xs font-bold transition-all ${
                  activeTab === 'strength'
                    ? 'bg-[#ccff00] text-black shadow-[0_0_15px_rgba(204,255,0,0.2)]'
                    : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                }`}
              >
                <TrendingUp className="size-4" />
                <span>1RM PROGRESSION</span>
              </button>

              <button
                onClick={() => setActiveTab('volume')}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-mono text-xs font-bold transition-all ${
                  activeTab === 'volume'
                    ? 'bg-[#ccff00] text-black shadow-[0_0_15px_rgba(204,255,0,0.2)]'
                    : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                }`}
              >
                <BarChart2 className="size-4" />
                <span>VOLUME & INTENSITY</span>
              </button>

              <button
                onClick={() => setActiveTab('body')}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-mono text-xs font-bold transition-all ${
                  activeTab === 'body'
                    ? 'bg-[#ccff00] text-black shadow-[0_0_15px_rgba(204,255,0,0.2)]'
                    : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                }`}
              >
                <Scale className="size-4" />
                <span>BODY COMPOSITION</span>
              </button>

              <button
                onClick={() => setActiveTab('radar')}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-mono text-xs font-bold transition-all ${
                  activeTab === 'radar'
                    ? 'bg-[#ccff00] text-black shadow-[0_0_15px_rgba(204,255,0,0.2)]'
                    : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                }`}
              >
                <Target className="size-4" />
                <span>MUSCLE RADAR</span>
              </button>
            </div>

            {/* Quick Chart Filter / Sub-controls */}
            {activeTab === 'strength' && (
              <div className="flex items-center gap-2">
                <Filter className="size-4 text-slate-500" />
                <select
                  value={selectedExercise}
                  onChange={(e) => setSelectedExercise(e.target.value)}
                  className="bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs font-mono text-slate-200 focus:outline-none focus:border-[#ccff00]"
                >
                  <option value="all">Show All Lifts (Overlay)</option>
                  <option value="bench">Bench Press Only</option>
                  <option value="squat">Barbell Squat Only</option>
                  <option value="deadlift">Deadlift Only</option>
                  <option value="ohp">Overhead Press Only</option>
                </select>
              </div>
            )}
          </div>

          {/* TAB 1: STRENGTH PROGRESSION CHART */}
          {activeTab === 'strength' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between text-xs text-slate-400 font-mono">
                <span className="flex items-center gap-2">
                  <span className="size-2 rounded-full bg-[#ccff00] inline-block animate-pulse" />
                  Estimated 1 Rep Max over 12 Weeks Block ({unit.toUpperCase()})
                </span>
                <span className="hidden sm:inline-block">Updated via Brzycki formula calculations</span>
              </div>

              <div className="h-[360px] w-full pt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={strengthChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="benchGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="squatGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#ccff00" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#ccff00" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="deadliftGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#a855f7" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#a855f7" stopOpacity={0} />
                      </linearGradient>
                    </defs>

                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                    <XAxis dataKey="date" stroke="#64748b" tickLine={false} style={{ fontSize: '12px', fontFamily: 'JetBrains Mono' }} />
                    <YAxis stroke="#64748b" tickLine={false} style={{ fontSize: '12px', fontFamily: 'JetBrains Mono' }} domain={['dataMin - 20', 'dataMax + 20']} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#0d131f',
                        borderColor: '#334155',
                        borderRadius: '12px',
                        boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
                        fontFamily: 'JetBrains Mono',
                        fontSize: '12px',
                      }}
                      formatter={(val: number) => [`${val} ${unit}`, '']}
                    />
                    <Legend wrapperStyle={{ fontFamily: 'JetBrains Mono', fontSize: '12px', paddingTop: '15px' }} />

                    {(selectedExercise === 'all' || selectedExercise === 'bench') && (
                      <Area
                        type="monotone"
                        dataKey="benchDisplay"
                        name="Bench Press"
                        stroke="#06b6d4"
                        strokeWidth={3}
                        fillOpacity={1}
                        fill="url(#benchGrad)"
                        activeDot={{ r: 6, fill: '#06b6d4', stroke: '#ffffff' }}
                      />
                    )}

                    {(selectedExercise === 'all' || selectedExercise === 'squat') && (
                      <Area
                        type="monotone"
                        dataKey="squatDisplay"
                        name="Barbell Squat"
                        stroke="#ccff00"
                        strokeWidth={3}
                        fillOpacity={1}
                        fill="url(#squatGrad)"
                        activeDot={{ r: 6, fill: '#ccff00', stroke: '#000000' }}
                      />
                    )}

                    {(selectedExercise === 'all' || selectedExercise === 'deadlift') && (
                      <Area
                        type="monotone"
                        dataKey="deadliftDisplay"
                        name="Conventional Deadlift"
                        stroke="#a855f7"
                        strokeWidth={3}
                        fillOpacity={1}
                        fill="url(#deadliftGrad)"
                        activeDot={{ r: 6, fill: '#a855f7', stroke: '#ffffff' }}
                      />
                    )}

                    {(selectedExercise === 'all' || selectedExercise === 'ohp') && (
                      <Line
                        type="monotone"
                        dataKey="ohpDisplay"
                        name="Overhead Press"
                        stroke="#f97316"
                        strokeWidth={2}
                        dot={{ r: 3 }}
                      />
                    )}
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* TAB 2: VOLUME & INTENSITY CHART */}
          {activeTab === 'volume' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between text-xs text-slate-400 font-mono">
                <span>Weekly Tonnage ({unit.toUpperCase()}) vs Average Session RPE (Rating of Perceived Exertion)</span>
                <span className="text-[#ccff00]">Deload occurred in Week 4</span>
              </div>

              <div className="h-[360px] w-full pt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={volumeChartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                    <XAxis dataKey="week" stroke="#64748b" style={{ fontSize: '12px', fontFamily: 'JetBrains Mono' }} />
                    <YAxis yAxisId="left" stroke="#ccff00" style={{ fontSize: '12px', fontFamily: 'JetBrains Mono' }} />
                    <YAxis yAxisId="right" orientation="right" stroke="#f97316" domain={[0, 10]} style={{ fontSize: '12px', fontFamily: 'JetBrains Mono' }} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#0d131f',
                        borderColor: '#334155',
                        borderRadius: '12px',
                        fontFamily: 'JetBrains Mono',
                        fontSize: '12px',
                      }}
                    />
                    <Legend wrapperStyle={{ fontFamily: 'JetBrains Mono', fontSize: '12px', paddingTop: '15px' }} />
                    <Bar yAxisId="left" dataKey="tonnageDisplay" name={`Volume Tonnage (${unit})`} fill="#ccff00" radius={[6, 6, 0, 0]} />
                    <Line yAxisId="right" type="monotone" dataKey="avgRpe" name="Average RPE" stroke="#f97316" strokeWidth={3} dot={{ r: 5, fill: '#f97316' }} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* TAB 3: BODY COMPOSITION CHART */}
          {activeTab === 'body' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between text-xs text-slate-400 font-mono">
                <span>Body Weight & Lean Mass Trajectory ({unit.toUpperCase()}) vs Body Fat %</span>
                <span className="text-emerald-400">Recomposition Goal in Progress</span>
              </div>

              <div className="h-[360px] w-full pt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={bodyChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                    <XAxis dataKey="date" stroke="#64748b" style={{ fontSize: '12px', fontFamily: 'JetBrains Mono' }} />
                    <YAxis yAxisId="left" stroke="#64748b" style={{ fontSize: '12px', fontFamily: 'JetBrains Mono' }} domain={['dataMin - 5', 'dataMax + 5']} />
                    <YAxis yAxisId="right" orientation="right" stroke="#22c55e" style={{ fontSize: '12px', fontFamily: 'JetBrains Mono' }} domain={[10, 20]} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#0d131f',
                        borderColor: '#334155',
                        borderRadius: '12px',
                        fontFamily: 'JetBrains Mono',
                        fontSize: '12px',
                      }}
                    />
                    <Legend wrapperStyle={{ fontFamily: 'JetBrains Mono', fontSize: '12px', paddingTop: '15px' }} />
                    <Line yAxisId="left" type="monotone" dataKey="weightDisplay" name={`Body Weight (${unit})`} stroke="#38bdf8" strokeWidth={3} dot={{ r: 4 }} />
                    <Line yAxisId="left" type="monotone" dataKey="leanMassDisplay" name={`Lean Mass (${unit})`} stroke="#a855f7" strokeWidth={2} strokeDasharray="5 5" />
                    <Line yAxisId="right" type="monotone" dataKey="bodyFat" name="Body Fat %" stroke="#22c55e" strokeWidth={3} dot={{ r: 5 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* TAB 4: MUSCLE RADAR CHART */}
          {activeTab === 'radar' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
              <div className="h-[340px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart cx="50%" cy="50%" outerRadius="80%" data={MUSCLE_RADAR}>
                    <PolarGrid stroke="#1e293b" />
                    <PolarAngleAxis dataKey="subject" stroke="#94a3b8" style={{ fontSize: '12px', fontFamily: 'JetBrains Mono' }} />
                    <PolarRadiusAxis angle={30} domain={[0, 100]} stroke="#475569" />
                    <Radar name="Current Volume Score" dataKey="volume" stroke="#ccff00" fill="#ccff00" fillOpacity={0.3} />
                    <Radar name="Frequency Balance" dataKey="frequency" stroke="#06b6d4" fill="#06b6d4" fillOpacity={0.2} />
                    <Tooltip contentStyle={{ backgroundColor: '#0d131f', borderColor: '#334155', fontFamily: 'JetBrains Mono' }} />
                    <Legend wrapperStyle={{ fontFamily: 'JetBrains Mono', fontSize: '12px' }} />
                  </RadarChart>
                </ResponsiveContainer>
              </div>

              <div className="space-y-4 bg-slate-900/60 p-5 rounded-xl border border-slate-800">
                <h3 className="text-sm font-mono font-bold text-[#ccff00] flex items-center gap-2">
                  <Sparkles className="size-4" />
                  MUSCLE GROUP VOLUME ANALYSIS
                </h3>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Your training distribution indicates high recovery efficiency on <strong className="text-white">Chest & Back</strong> with full weekly stimulus coverage.
                </p>
                <div className="space-y-3 pt-2">
                  {MUSCLE_RADAR.slice(0, 4).map((item) => (
                    <div key={item.subject} className="space-y-1">
                      <div className="flex justify-between text-xs font-mono">
                        <span className="text-slate-300">{item.subject}</span>
                        <span className="text-[#ccff00]">{item.volume}% Optimal</span>
                      </div>
                      <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                        <div className="bg-[#ccff00] h-full" style={{ width: `${item.volume}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

        </section>

        {/* PR MILESTONES & TARGET GOALS */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold font-mono tracking-tight flex items-center gap-2 text-white">
              <Award className="size-5 text-[#ccff00]" />
              PERSONAL RECORD (PR) MILESTONES
            </h2>
            <span className="text-xs font-mono text-slate-400">3 of 4 Targets Achieved</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {PR_MILESTONES.map((milestone) => {
              const currentDisplay = convertWeight(milestone.current, unit);
              const targetDisplay = convertWeight(milestone.target, unit);
              const percent = Math.min(100, Math.round((currentDisplay / targetDisplay) * 100));

              return (
                <div
                  key={milestone.id}
                  className="bg-[#111827] border border-slate-800 rounded-xl p-4 space-y-3 relative overflow-hidden"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="text-[10px] font-mono uppercase text-slate-400">{milestone.category}</span>
                      <h4 className="text-sm font-bold text-white font-mono mt-0.5">{milestone.name}</h4>
                    </div>
                    {milestone.achieved ? (
                      <span className="px-2 py-0.5 text-[10px] font-mono font-bold bg-emerald-950 text-emerald-400 border border-emerald-800 rounded-full flex items-center gap-1">
                        <CheckCircle2 className="size-3" /> UNLOCKED
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 text-[10px] font-mono text-slate-400 bg-slate-900 border border-slate-800 rounded-full">
                        IN PROGRESS
                      </span>
                    )}
                  </div>

                  <div className="flex items-baseline justify-between font-mono">
                    <span className="text-xs text-slate-400">Current / Target:</span>
                    <span className="text-sm font-bold text-white">
                      {currentDisplay} / <span className="text-[#ccff00]">{targetDisplay} {unit}</span>
                    </span>
                  </div>

                  <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all duration-500 bg-gradient-to-r ${milestone.color}`}
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* WORKOUT LOGS HISTORY TABLE */}
        <section className="bg-[#111827] border border-slate-800 rounded-2xl p-5 lg:p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold font-mono tracking-tight text-white flex items-center gap-2">
                <Calendar className="size-5 text-[#ccff00]" />
                WORKOUT LOG & SET HISTORY
              </h2>
              <p className="text-xs text-slate-400 font-mono">Real-time session records with estimated 1RM calculations</p>
            </div>

            {/* Search Input */}
            <div className="relative w-full sm:w-64">
              <Search className="size-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search exercise, notes..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-4 py-2 text-xs font-mono text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-[#ccff00]"
              />
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto rounded-xl border border-slate-800/80 bg-slate-900/40">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-800 text-[11px] font-mono text-slate-400 bg-slate-900/80">
                  <th className="py-3 px-4 uppercase">Date</th>
                  <th className="py-3 px-4 uppercase">Exercise Name</th>
                  <th className="py-3 px-4 uppercase">Top Load</th>
                  <th className="py-3 px-4 uppercase">Reps</th>
                  <th className="py-3 px-4 uppercase">RPE</th>
                  <th className="py-3 px-4 uppercase">Estimated 1RM</th>
                  <th className="py-3 px-4 uppercase">Notes & Form</th>
                  <th className="py-3 px-4 uppercase text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-xs font-mono">
                {filteredLogs.length > 0 ? (
                  filteredLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-3.5 px-4 text-slate-400 whitespace-nowrap">{log.date}</td>
                      <td className="py-3.5 px-4 font-bold text-white whitespace-nowrap flex items-center gap-2">
                        <Dumbbell className="size-3.5 text-[#ccff00]" />
                        {log.exercise}
                      </td>
                      <td className="py-3.5 px-4 text-slate-200 font-bold whitespace-nowrap">
                        {formatWeight(log.weightLbs)}
                      </td>
                      <td className="py-3.5 px-4 text-slate-300">{log.reps} reps</td>
                      <td className="py-3.5 px-4">
                        <span className="px-2 py-0.5 rounded bg-slate-800 text-amber-400 font-semibold border border-slate-700">
                          @{log.rpe}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-[#ccff00] font-bold">
                        {formatWeight(log.estimated1RM)}
                      </td>
                      <td className="py-3.5 px-4 text-slate-400 max-w-xs truncate">{log.notes}</td>
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        {log.isPR ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#ccff00]/10 text-[#ccff00] border border-[#ccff00]/30">
                            <Sparkles className="size-3" /> NEW PR
                          </span>
                        ) : (
                          <span className="text-slate-500 text-[11px]">Logged</span>
                        )}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-slate-500 font-mono text-xs">
                      No matching workout logs found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

      </main>

      {/* FOOTER */}
      <footer className="border-t border-slate-800/80 bg-[#0d131f] py-6 px-4 lg:px-8 mt-12 text-center text-xs font-mono text-slate-500 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Zap className="size-4 text-[#ccff00]" />
          <span>APEX ATHLETICS // GYM PERFORMANCE ANALYTICS ENGINE</span>
        </div>
        <p>Built for high-performance fitness tracking & powerbuilding</p>
      </footer>

      {/* LOG WORKOUT MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#111827] border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-5 shadow-2xl relative">
            <button
              onClick={() => setIsModalOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
            >
              <X className="size-5" />
            </button>

            <div>
              <h3 className="text-lg font-bold font-mono text-white flex items-center gap-2">
                <Plus className="size-5 text-[#ccff00]" />
                LOG WORKOUT SESSION
              </h3>
              <p className="text-xs text-slate-400 font-mono mt-1">Enter set data to update your 1RM progression chart</p>
            </div>

            <form onSubmit={handleAddWorkout} className="space-y-4 text-xs font-mono">
              <div>
                <label className="block text-slate-300 mb-1">Exercise Name</label>
                <select
                  value={newExercise}
                  onChange={(e) => setNewExercise(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2.5 text-white focus:outline-none focus:border-[#ccff00]"
                >
                  <option value="Barbell Squat">Barbell Squat</option>
                  <option value="Bench Press">Bench Press</option>
                  <option value="Conventional Deadlift">Conventional Deadlift</option>
                  <option value="Overhead Press">Overhead Press</option>
                  <option value="Incline Dumbbell Press">Incline Dumbbell Press</option>
                  <option value="Weighted Pull-up">Weighted Pull-up</option>
                  <option value="Barbell Row">Barbell Row</option>
                </select>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-300 mb-1">Weight ({unit})</label>
                  <input
                    type="number"
                    value={newWeight}
                    onChange={(e) => setNewWeight(e.target.value)}
                    required
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-[#ccff00]"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 mb-1">Reps Completed</label>
                  <input
                    type="number"
                    value={newReps}
                    onChange={(e) => setNewReps(e.target.value)}
                    required
                    min="1"
                    max="30"
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-[#ccff00]"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 mb-1">RPE Rate (1-10)</label>
                  <input
                    type="number"
                    step="0.5"
                    value={newRpe}
                    onChange={(e) => setNewRpe(e.target.value)}
                    required
                    min="5"
                    max="10"
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-[#ccff00]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 mb-1">Session Form & Notes</label>
                <textarea
                  rows={3}
                  value={newNotes}
                  onChange={(e) => setNewNotes(e.target.value)}
                  placeholder="e.g. Good leg drive, smooth lockout..."
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3 text-white focus:outline-none focus:border-[#ccff00]"
                />
              </div>

              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold py-2.5 rounded-xl transition-all"
                >
                  CANCEL
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-[#ccff00] hover:bg-[#b8e600] text-black font-extrabold py-2.5 rounded-xl transition-all shadow-[0_0_20px_rgba(204,255,0,0.25)]"
                >
                  SAVE & UPDATE
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
