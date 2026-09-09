import type { EmissionFactor } from "@/types/domain";

/** Shows exactly which sourced factors fed a calculation — the "clearly
 *  distinguish sourced factor from calculated result" requirement. Rendered
 *  inside a collapsible disclosure, so the heading itself lives there. */
export function ProvenanceList({ factors }: { factors: EmissionFactor[] }) {
  // De-duplicate by id (a factor can be reused across production/disposal, etc).
  const unique = Array.from(new Map(factors.map((f) => [f.id, f])).values());

  return (
    <div className="flex flex-col gap-2">
      <ul className="flex flex-col gap-2">
        {unique.map((f) => (
          <li key={f.id} className="text-xs text-muted-foreground">
            <span className="font-medium text-foreground">{f.material}</span>{" "}
            <span className="tabular-nums">
              ({f.value.toLocaleString(undefined, { maximumFractionDigits: 4 })} {f.unit})
            </span>
            {" — "}
            <a
              href={f.source.url}
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-2 hover:text-foreground"
            >
              {f.source.name}
            </a>
            {" "}
            <span>({f.source.publicationYear})</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
