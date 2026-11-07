import Link from "next/link";
import { POSITION_FAMILIES } from "@/lib/positions";
import type { PositionFamily } from "@/lib/types";

type Props = {
  active: PositionFamily;
  hrefFor: (slug: PositionFamily) => string;
};

/** Secondary nav: position families inside a section (perfil, comparar, scatter). */
export function PositionFamilyTabs({ active, hrefFor }: Props) {
  return (
    <nav className="position-tabs" aria-label="Posições">
      {POSITION_FAMILIES.map((item) => (
        <Link
          key={item.key}
          href={hrefFor(item.slug)}
          className={item.key === active ? "active" : ""}
          aria-current={item.key === active ? "page" : undefined}
        >
          <span className="tab-full">{item.label}</span>
          <span className="tab-short">{item.short}</span>
        </Link>
      ))}
    </nav>
  );
}
