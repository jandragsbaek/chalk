import { MovementCategory, type CatalogMovement } from "@chalk/contracts";

import { MOVEMENT_CATEGORY_LABELS } from "../../lib/strength.ts";
import type { MovementFilter, ScalingFilter } from "../../lib/movements.ts";

const SCALING_TABS: ReadonlyArray<{
  readonly value: ScalingFilter | undefined;
  readonly label: string;
}> = [
  { value: undefined, label: "Any" },
  { value: "with", label: "Has scalings" },
  { value: "without", label: "None yet" },
];

function Tab({
  active,
  label,
  count,
  onClick,
}: {
  readonly active: boolean;
  readonly label: string;
  readonly count: number;
  readonly onClick: () => void;
}) {
  return (
    <li className="border-t">
      <button
        type="button"
        aria-pressed={active}
        className={
          active
            ? "flex min-h-9 w-full cursor-pointer items-center justify-between gap-2 bg-foreground pl-4 pr-3 text-sm font-semibold text-background"
            : "flex min-h-9 w-full cursor-pointer items-center justify-between gap-2 pl-4 pr-3 text-sm text-muted-foreground transition-colors duration-150 hover:bg-muted hover:text-foreground"
        }
        onClick={onClick}
      >
        <span className="py-1.5 text-left">{label}</span>
        <span className="tabular-nums">{count}</span>
      </button>
    </li>
  );
}

/** The catalog's index: categories with their counts, then whether a movement has scalings. */
export function MovementRail({
  catalog,
  filter,
  onFilter,
}: {
  readonly catalog: ReadonlyArray<CatalogMovement>;
  readonly filter: MovementFilter;
  readonly onFilter: (next: Partial<MovementFilter>) => void;
}) {
  const inCategory = catalog.filter(
    (movement) => filter.category === undefined || movement.category === filter.category,
  );
  const withScalings = inCategory.filter((movement) => (movement.scalings ?? []).length > 0);
  const scalingCount = (value: ScalingFilter | undefined) =>
    value === undefined
      ? inCategory.length
      : value === "with"
        ? withScalings.length
        : inCategory.length - withScalings.length;

  return (
    <nav aria-label="Catalog" className="min-h-0 overflow-y-auto border-r bg-background">
      <h2 className="protocol-title px-4 pb-1.5 pt-4 text-lg">Category</h2>
      <ul className="border-b">
        <Tab
          active={filter.category === undefined}
          label="All"
          count={catalog.length}
          onClick={() => onFilter({ category: undefined })}
        />
        {MovementCategory.literals.map((category) => (
          <Tab
            key={category}
            active={filter.category === category}
            label={MOVEMENT_CATEGORY_LABELS[category]}
            count={catalog.filter((movement) => movement.category === category).length}
            onClick={() => onFilter({ category })}
          />
        ))}
      </ul>
      <h2 className="protocol-title px-4 pb-1.5 pt-6 text-lg">Scalings</h2>
      <ul className="border-b">
        {SCALING_TABS.map((tab) => (
          <Tab
            key={tab.label}
            active={filter.scalings === tab.value}
            label={tab.label}
            count={scalingCount(tab.value)}
            onClick={() => onFilter({ scalings: tab.value })}
          />
        ))}
      </ul>
    </nav>
  );
}
