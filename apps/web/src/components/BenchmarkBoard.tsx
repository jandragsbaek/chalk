import {
  formatQuantity,
  type Benchmark,
  type BenchmarkItem,
  type MovementId,
} from "@chalk/contracts";

function ItemLine({
  item,
  nameOf,
}: {
  readonly item: BenchmarkItem;
  readonly nameOf: (id: MovementId) => string;
}) {
  return (
    <span className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
      <span className="font-semibold">{nameOf(item.movementId)}</span>
      {item.quantities.map((quantity) => (
        <span
          key={formatQuantity(quantity)}
          data-chip
          data-measure={quantity.measure}
          className="px-1.5 text-sm font-medium leading-6 tabular-nums"
        >
          {formatQuantity(quantity)}
        </span>
      ))}
      {item.note ? <span className="text-sm text-muted-foreground">{item.note}</span> : null}
    </span>
  );
}

/**
 * A benchmark as the board writes it: each block's format, then its movements with reps,
 * distances and loads in kilograms (male/female), then the instructions.
 */
export function BenchmarkBoard({
  benchmark,
  nameOf,
}: {
  readonly benchmark: Benchmark;
  readonly nameOf: (id: MovementId) => string;
}) {
  const blocks = benchmark.blocks.map((block, index) => ({
    ...block,
    key: `${index}`,
    keyed: block.items.map((item, itemIndex) => ({ item, key: `${index}.${itemIndex}` })),
  }));
  return (
    <div className="grid border-t">
      {blocks.map((block) => (
        <section key={block.key} aria-label={block.title} className="border-b">
          <h3 className="bg-muted px-4 py-1.5 text-sm font-bold uppercase tracking-wide font-stretch-condensed">
            {block.title}
          </h3>
          {block.items.length > 0 ? (
            <ol className="grid">
              {block.keyed.map(({ item, key }) => (
                <li
                  key={key}
                  data-board-item
                  className="grid gap-1 border-t px-4 py-2 first:border-t-0"
                >
                  <ItemLine item={item} nameOf={nameOf} />
                  {(item.alternatives ?? []).map((alternative) => (
                    <span
                      key={alternative.movementId}
                      className="flex items-baseline gap-2 text-sm"
                    >
                      <span className="form-label text-muted-foreground">or</span>
                      <ItemLine item={alternative} nameOf={nameOf} />
                    </span>
                  ))}
                </li>
              ))}
            </ol>
          ) : null}
          {block.intents.length > 0 ? (
            <ul className="grid gap-1 border-t px-4 py-2 text-sm text-muted-foreground">
              {block.intents.map((intent) => (
                <li key={intent} className="max-w-prose">
                  {intent}
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      ))}
    </div>
  );
}
