// Node registry - mirrors the Python rule_engine node taxonomy exactly.
// This is the single source of truth for the frontend.

export type DType = "FLOAT" | "BOOL" | "INT" | "STR" | "LOB" | "ORDER" | "ANY";

export type PortDef = {
  name: string;
  dtype: DType;
  required?: boolean;
  default?: string | number | boolean | null;
  doc?: string;
};

export type ParamDef = {
  name: string;
  type: "string" | "number" | "boolean" | "select";
  default: string | number | boolean;
  options?: string[];   // for select
  doc?: string;
};

export type NodeDef = {
  type: string;
  category: "source" | "variable" | "math" | "condition" | "branch" | "aggregator" | "order";
  label: string;
  description: string;
  inputs: PortDef[];
  outputs: PortDef[];
  params: ParamDef[];
};

export const CATEGORIES = [
  { id: "source",     label: "Source",      color: "#0f766e" },   // teal
  { id: "variable",   label: "Variable",    color: "#7c3aed" },   // violet
  { id: "math",       label: "Math",        color: "#1d4ed8" },   // blue
  { id: "condition",  label: "Condition",   color: "#b45309" },   // amber
  { id: "branch",     label: "Branch",      color: "#be185d" },   // pink
  { id: "aggregator", label: "Aggregator",  color: "#0369a1" },   // sky
  { id: "order",      label: "Order",       color: "#b91c1c" },   // red
] as const;

export type CategoryId = typeof CATEGORIES[number]["id"];

// Dtype → edge/port colour
export const DTYPE_COLORS: Record<DType, string> = {
  FLOAT: "#3b82f6",   // blue
  BOOL:  "#f59e0b",   // amber
  INT:   "#8b5cf6",   // violet
  STR:   "#10b981",   // emerald
  LOB:   "#14b8a6",   // teal
  ORDER: "#ef4444",   // red
  ANY:   "#6b7280",   // gray
};

export const NodeRegistry: NodeDef[] = [
  // ─── SOURCE ────────────────────────────────────────────────────────────────
  {
    type: "LOBSource",
    category: "source",
    label: "LOB Source",
    description: "Entry point - exposes all LOB fields for the current tick.",
    inputs: [],
    outputs: [
      { name: "lob",        dtype: "LOB",   doc: "Full LOB snapshot" },
      { name: "mid",        dtype: "FLOAT", doc: "(best_bid + best_ask) / 2" },
      { name: "best_bid",   dtype: "FLOAT", doc: "Top-of-book bid price" },
      { name: "best_ask",   dtype: "FLOAT", doc: "Top-of-book ask price" },
      { name: "spread",     dtype: "FLOAT", doc: "best_ask − best_bid" },
      { name: "imbalance",  dtype: "FLOAT", doc: "(bid_depth − ask_depth) / total" },
      { name: "bid_depth",  dtype: "FLOAT", doc: "Total size on bid side" },
      { name: "ask_depth",  dtype: "FLOAT", doc: "Total size on ask side" },
      { name: "last_price", dtype: "FLOAT", doc: "Last trade price" },
      { name: "last_size",  dtype: "FLOAT", doc: "Last trade size" },
      { name: "timestamp",  dtype: "FLOAT", doc: "Unix seconds" },
      { name: "tick_index", dtype: "INT",   doc: "Monotonic tick counter" },
    ],
    params: [],
  },
  {
    type: "LevelExtractor",
    category: "source",
    label: "Level Extractor",
    description: "Extract price/size from a specific LOB depth level.",
    inputs:  [{ name: "lob", dtype: "LOB", required: true }],
    outputs: [
      { name: "price", dtype: "FLOAT" },
      { name: "size",  dtype: "FLOAT" },
    ],
    params: [
      { name: "side",  type: "select", default: "bid", options: ["bid", "ask"], doc: "Book side" },
      { name: "level", type: "number", default: 0, doc: "Level index (0 = best)" },
    ],
  },
  {
    type: "Constant",
    category: "source",
    label: "Constant",
    description: "Emits a fixed float value every tick.",
    inputs:  [],
    outputs: [{ name: "value", dtype: "FLOAT" }],
    params:  [{ name: "value", type: "number", default: 1.0, doc: "The constant value" }],
  },
  {
    type: "TickCounter",
    category: "source",
    label: "Tick Counter",
    description: "Outputs tick index and a period-hit flag.",
    inputs:  [],
    outputs: [
      { name: "tick",       dtype: "INT" },
      { name: "period_hit", dtype: "BOOL", doc: "True when tick_index % period == 0" },
    ],
    params: [{ name: "period", type: "number", default: 10, doc: "Period in ticks" }],
  },

  // ─── VARIABLE ──────────────────────────────────────────────────────────────
  {
    type: "Variable",
    category: "variable",
    label: "Float Variable",
    description: "Cross-tick stateful float. Reads last tick's value; writes are deferred (cycle-safe).",
    inputs: [
      { name: "update",       dtype: "FLOAT", required: false, default: null, doc: "New value to write" },
      { name: "write_enable", dtype: "BOOL",  required: false, default: true, doc: "Write gate" },
    ],
    outputs: [
      { name: "value", dtype: "FLOAT", doc: "Current stored value (start of tick)" },
      { name: "prev",  dtype: "FLOAT", doc: "Value from previous tick" },
    ],
    params: [{ name: "initial", type: "number", default: 0.0, doc: "Initial value" }],
  },
  {
    type: "BoolVariable",
    category: "variable",
    label: "Bool Variable",
    description: "Cross-tick boolean flag (e.g. position_open). Cycle-safe deferred write.",
    inputs: [
      { name: "set",   dtype: "BOOL", required: false, default: null, doc: "Set to True" },
      { name: "clear", dtype: "BOOL", required: false, default: null, doc: "Clear to False" },
    ],
    outputs: [
      { name: "value", dtype: "BOOL" },
      { name: "rose",  dtype: "BOOL", doc: "True on tick flag became True" },
      { name: "fell",  dtype: "BOOL", doc: "True on tick flag became False" },
    ],
    params: [{ name: "initial", type: "boolean", default: false, doc: "Initial state" }],
  },

  // ─── MATH ──────────────────────────────────────────────────────────────────
  {
    type: "BinaryOp",
    category: "math",
    label: "Binary Op",
    description: "Two-input arithmetic operation.",
    inputs:  [{ name: "a", dtype: "FLOAT" }, { name: "b", dtype: "FLOAT" }],
    outputs: [{ name: "result", dtype: "FLOAT" }],
    params:  [{
      name: "op", type: "select", default: "add",
      options: ["add", "sub", "mul", "div", "mod", "pow", "min", "max"],
    }],
  },
  {
    type: "UnaryOp",
    category: "math",
    label: "Unary Op",
    description: "Single-input math transform.",
    inputs:  [{ name: "x", dtype: "FLOAT" }],
    outputs: [{ name: "result", dtype: "FLOAT" }],
    params:  [{
      name: "op", type: "select", default: "abs",
      options: ["abs", "neg", "sqrt", "log", "exp", "floor", "ceil", "sign"],
    }],
  },
  {
    type: "Clamp",
    category: "math",
    label: "Clamp",
    description: "Clamp value to [lo, hi].",
    inputs: [
      { name: "x",  dtype: "FLOAT", required: true },
      { name: "lo", dtype: "FLOAT", required: false, default: 0.0 },
      { name: "hi", dtype: "FLOAT", required: false, default: 1.0 },
    ],
    outputs: [{ name: "result", dtype: "FLOAT" }],
    params:  [],
  },
  {
    type: "Select",
    category: "math",
    label: "Select (Mux)",
    description: "Output a when condition=True, else b.",
    inputs: [
      { name: "condition", dtype: "BOOL" },
      { name: "a",         dtype: "FLOAT", doc: "Value when True" },
      { name: "b",         dtype: "FLOAT", doc: "Value when False" },
    ],
    outputs: [{ name: "result", dtype: "FLOAT" }],
    params:  [],
  },

  // ─── CONDITION ─────────────────────────────────────────────────────────────
  {
    type: "Compare",
    category: "condition",
    label: "Compare",
    description: "Compare a to b. Outputs bool.",
    inputs:  [{ name: "a", dtype: "FLOAT" }, { name: "b", dtype: "FLOAT" }],
    outputs: [{ name: "result", dtype: "BOOL" }],
    params:  [{ name: "op", type: "select", default: "gt", options: ["gt", "ge", "lt", "le", "eq", "ne"] }],
  },
  {
    type: "Threshold",
    category: "condition",
    label: "Threshold (Hysteresis)",
    description: "State-aware threshold with separate entry/exit levels to prevent chatter.",
    inputs: [
      { name: "value",           dtype: "FLOAT" },
      { name: "upper_threshold", dtype: "FLOAT", required: false, default: 1.0 },
      { name: "lower_threshold", dtype: "FLOAT", required: false, default: 0.0 },
    ],
    outputs: [
      { name: "above",      dtype: "BOOL" },
      { name: "crossed_up", dtype: "BOOL" },
      { name: "crossed_dn", dtype: "BOOL" },
    ],
    params: [],
  },
  {
    type: "InRange",
    category: "condition",
    label: "In Range",
    description: "True when lo ≤ value ≤ hi.",
    inputs: [
      { name: "value", dtype: "FLOAT" },
      { name: "lo",    dtype: "FLOAT", required: false, default: 0.0 },
      { name: "hi",    dtype: "FLOAT", required: false, default: 1.0 },
    ],
    outputs: [{ name: "result", dtype: "BOOL" }],
    params:  [],
  },
  {
    type: "LogicGate",
    category: "condition",
    label: "Logic Gate",
    description: "Boolean logic: and/or/xor/nand/nor/not.",
    inputs: [
      { name: "a", dtype: "BOOL" },
      { name: "b", dtype: "BOOL", required: false, default: false },
    ],
    outputs: [{ name: "result", dtype: "BOOL" }],
    params:  [{ name: "op", type: "select", default: "and", options: ["and", "or", "xor", "nand", "nor", "not"] }],
  },
  {
    type: "Cooldown",
    category: "condition",
    label: "Cooldown",
    description: "Edge-triggered one-shot: fires once, then blocks for n_ticks.",
    inputs:  [{ name: "trigger", dtype: "BOOL" }],
    outputs: [
      { name: "fire",        dtype: "BOOL" },
      { name: "in_cooldown", dtype: "BOOL" },
      { name: "ticks_left",  dtype: "FLOAT" },
    ],
    params: [{ name: "n_ticks", type: "number", default: 10, doc: "Cooldown duration in ticks" }],
  },

  // ─── BRANCH ────────────────────────────────────────────────────────────────
  {
    type: "BranchGate",
    category: "branch",
    label: "Branch Gate",
    description: "Routes a float value onto true_out or false_out based on a gate signal.",
    inputs: [
      { name: "value",         dtype: "FLOAT" },
      { name: "gate",          dtype: "BOOL" },
      { name: "default_value", dtype: "FLOAT", required: false, default: NaN },
    ],
    outputs: [
      { name: "true_out",  dtype: "FLOAT" },
      { name: "false_out", dtype: "FLOAT" },
      { name: "active",    dtype: "BOOL" },
    ],
    params: [],
  },
  {
    type: "StateMachine",
    category: "branch",
    label: "State Machine",
    description: "N-state FSM. Transition inputs t0…tN are wired to bool triggers.",
    inputs:  [],   // dynamic - generated from transitions param
    outputs: [],   // dynamic - generated from n_states + state_labels
    params:  [
      { name: "n_states",      type: "number", default: 2, doc: "Number of states" },
      { name: "initial_state", type: "number", default: 0, doc: "Initial state index" },
      { name: "state_labels",  type: "string", default: "flat,long,short", doc: "Comma-separated state names" },
      { name: "transitions",   type: "string", default: "0→1,1→0", doc: "Comma-separated from→to pairs" },
    ],
  },

  // ─── AGGREGATOR ────────────────────────────────────────────────────────────
  {
    type: "RollingWindow",
    category: "aggregator",
    label: "Rolling Window",
    description: "Fixed-length FIFO buffer. Emits SMA, std, min, max.",
    inputs:  [{ name: "value", dtype: "FLOAT" }],
    outputs: [
      { name: "sma",   dtype: "FLOAT" },
      { name: "std",   dtype: "FLOAT" },
      { name: "min",   dtype: "FLOAT" },
      { name: "max",   dtype: "FLOAT" },
      { name: "value", dtype: "FLOAT", doc: "Passthrough" },
      { name: "full",  dtype: "BOOL",  doc: "True once window is full" },
    ],
    params: [{ name: "window", type: "number", default: 20, doc: "Window length in ticks" }],
  },
  {
    type: "EWMA",
    category: "aggregator",
    label: "EWMA",
    description: "Exponentially weighted moving average. alpha = 2/(span+1).",
    inputs:  [{ name: "value", dtype: "FLOAT" }],
    outputs: [
      { name: "ewma",        dtype: "FLOAT" },
      { name: "delta",       dtype: "FLOAT", doc: "ewma − prev_ewma" },
      { name: "initialized", dtype: "BOOL" },
    ],
    params: [
      { name: "span",  type: "number", default: 20, doc: "EMA span (alpha = 2/(span+1))" },
      { name: "alpha", type: "number", default: 0,  doc: "Override alpha directly (0 = use span)" },
    ],
  },
  {
    type: "Crossover",
    category: "aggregator",
    label: "Crossover",
    description: "Detects when signal a crosses signal b (e.g. fast MA vs slow MA).",
    inputs: [
      { name: "a", dtype: "FLOAT", doc: "Fast/primary signal" },
      { name: "b", dtype: "FLOAT", doc: "Slow/reference signal" },
    ],
    outputs: [
      { name: "cross_up",   dtype: "BOOL" },
      { name: "cross_down", dtype: "BOOL" },
      { name: "a_above_b",  dtype: "BOOL" },
    ],
    params: [],
  },

  // ─── ORDER ─────────────────────────────────────────────────────────────────
  {
    type: "LimitOrderGen",
    category: "order",
    label: "Limit Order",
    description: "Emits a limit order when trigger fires.",
    inputs: [
      { name: "trigger", dtype: "BOOL" },
      { name: "price",   dtype: "FLOAT" },
      { name: "size",    dtype: "FLOAT" },
      { name: "enabled", dtype: "BOOL", required: false, default: true, doc: "Additional gate" },
    ],
    outputs: [{ name: "fired", dtype: "BOOL" }],
    params:  [
      { name: "side",   type: "select", default: "buy",  options: ["buy", "sell"] },
      { name: "symbol", type: "string", default: "SIM" },
      { name: "tag",    type: "string", default: "",     doc: "Debug label" },
    ],
  },
  {
    type: "MarketOrderGen",
    category: "order",
    label: "Market Order",
    description: "Emits a market order (no price) when trigger fires.",
    inputs: [
      { name: "trigger", dtype: "BOOL" },
      { name: "size",    dtype: "FLOAT" },
      { name: "enabled", dtype: "BOOL", required: false, default: true },
    ],
    outputs: [{ name: "fired", dtype: "BOOL" }],
    params:  [
      { name: "side",   type: "select", default: "buy", options: ["buy", "sell"] },
      { name: "symbol", type: "string", default: "SIM" },
    ],
  },
  {
    type: "CancelOrderGen",
    category: "order",
    label: "Cancel Order",
    description: "Emits a cancel instruction for a given order_id.",
    inputs: [
      { name: "trigger",  dtype: "BOOL" },
      { name: "order_id", dtype: "FLOAT", doc: "Order ID (float-encoded int)" },
      { name: "enabled",  dtype: "BOOL", required: false, default: true },
    ],
    outputs: [{ name: "fired", dtype: "BOOL" }],
    params:  [{ name: "symbol", type: "string", default: "SIM" }],
  },
  {
    type: "QuoteGen",
    category: "order",
    label: "Quote (MM)",
    description: "Emits bid + ask simultaneously. Canonical market-making sink.",
    inputs: [
      { name: "trigger",     dtype: "BOOL" },
      { name: "mid",         dtype: "FLOAT" },
      { name: "half_spread", dtype: "FLOAT" },
      { name: "size",        dtype: "FLOAT" },
      { name: "enabled",     dtype: "BOOL", required: false, default: true },
    ],
    outputs: [
      { name: "fired",     dtype: "BOOL" },
      { name: "bid_price", dtype: "FLOAT" },
      { name: "ask_price", dtype: "FLOAT" },
    ],
    params: [{ name: "symbol", type: "string", default: "SIM" }],
  },
];

export const NODE_BY_TYPE = Object.fromEntries(
  NodeRegistry.map(n => [n.type, n])
) as Record<string, NodeDef>;

export const NODES_BY_CATEGORY = CATEGORIES.map(cat => ({
  ...cat,
  nodes: NodeRegistry.filter(n => n.category === cat.id),
}));
