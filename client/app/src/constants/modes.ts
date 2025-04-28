interface Mode {
  id: string;
  name: string;
  icon: string;
  color: string;
}

export const modes: Mode[] = [
  { id: "slot", name: "777 슬롯머신", icon: "🎰", color: "#864046" },
  { id: "roulette", name: "운명의 룰렛", icon: "🎯", color: "#8b6d3f" },
  { id: "curtain", name: "커튼콜", icon: "🎪", color: "#3d5a7d" },
  { id: "scanner", name: "사우론의 눈", icon: "👁️", color: "#3d7a5f" },
  { id: "race", name: "스피드 레이서", icon: "🏎️", color: "#6b4975" },
  { id: "handpick", name: "연기대상", icon: "🎭", color: "#574b8b" },
];
