// Fixed order: type -> palette slot + shape (shape is the second, color-independent channel).
export type NodeShapeName = "round-rectangle" | "rectangle" | "hexagon" | "ellipse" | "diamond" | "triangle";
export const KINDS: Array<{ kind: string; label: string; slot: string; shape: NodeShapeName; ring: number }> = [
  { kind: "company", label: "Company", slot: "--s1", shape: "round-rectangle", ring: 7 },
  { kind: "lobbying_firm", label: "Lobbying firm", slot: "--s2", shape: "rectangle", ring: 3 },
  { kind: "committee", label: "PAC / committee", slot: "--s3", shape: "hexagon", ring: 4 },
  { kind: "lobbyist", label: "Lobbyist", slot: "--s4", shape: "ellipse", ring: 1 },
  { kind: "official", label: "Official", slot: "--s5", shape: "diamond", ring: 5 },
  { kind: "decision", label: "Decision", slot: "--s6", shape: "triangle", ring: 6 },
];
