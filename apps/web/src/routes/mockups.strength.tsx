import { Label, NativeSelect } from "@chalk/ui/components/field.tsx";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

import "../mockups/viz.css";
import { AllLifts } from "../mockups/AllLifts.tsx";
import { Segmented } from "../mockups/chartKit.tsx";
import { EstimateTrail } from "../mockups/EstimateTrail.tsx";
import { RepMaxLadder } from "../mockups/RepMaxLadder.tsx";
import { MOCK_LIFTS, RANGES, type RangeId } from "../mockups/strengthData.ts";
import { WeeklyRange } from "../mockups/WeeklyRange.tsx";

export const Route = createFileRoute("/mockups/strength")({ component: StrengthMockups });

function StrengthMockups() {
  const [movementId, setMovementId] = useState("back-squat");
  const [range, setRange] = useState<RangeId>("1y");
  const liftName = MOCK_LIFTS.find((lift) => lift.id === movementId)?.name ?? movementId;

  return (
    <main className="grid gap-6">
      <header className="grid gap-1">
        <h2 className="text-lg font-semibold">Strength progress mockups</h2>
        <p className="text-sm text-muted-foreground">
          Four ways to chart estimated 1RM over time. Synthetic data: one made-up year of training,
          not your logged sets.
        </p>
      </header>

      <div className="sticky top-0 z-20 -mx-4 flex flex-wrap items-end gap-3 border-b bg-background/95 px-4 py-3 backdrop-blur-sm">
        <div className="grid gap-1.5">
          <Label htmlFor="mockup-lift">Lift</Label>
          <NativeSelect
            id="mockup-lift"
            className="w-44"
            value={movementId}
            onChange={(event) => setMovementId(event.target.value)}
          >
            {MOCK_LIFTS.map((lift) => (
              <option key={lift.id} value={lift.id}>
                {lift.name}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="grid gap-1.5">
          <span className="text-sm font-medium">Range</span>
          <Segmented
            label="Range"
            size="md"
            value={range}
            onChange={setRange}
            options={RANGES.map((option) => ({ value: option.id, label: option.label }))}
          />
        </div>
      </div>

      <EstimateTrail movementId={movementId} liftName={liftName} range={range} />
      <RepMaxLadder movementId={movementId} liftName={liftName} range={range} />
      <WeeklyRange movementId={movementId} liftName={liftName} range={range} />
      <AllLifts range={range} selected={movementId} onSelect={setMovementId} />
    </main>
  );
}
