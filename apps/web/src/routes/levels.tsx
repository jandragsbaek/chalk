import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

import { LevelBoard } from "../components/LevelBoard.tsx";

export const Route = createFileRoute("/levels")({ component: LevelsPage });

function LevelsPage() {
  const [today] = useState(() => new Date());
  return <LevelBoard today={today} />;
}
