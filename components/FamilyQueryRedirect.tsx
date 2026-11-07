"use client";

import { useEffect } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { familyBySlug } from "@/lib/positions";

/** Old links used `?posicao=`. Send them to the static `/{league}/{base}/{family}` page. */
export function FamilyQueryRedirect({ base }: { base: "scatter" | "comparar" }) {
  const params = useParams<{ league: string }>();
  const search = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    const family = familyBySlug(search.get("posicao") ?? "").slug;
    const next = new URLSearchParams(search);
    next.delete("posicao");
    const query = next.toString();
    router.replace(`/${params.league}/${base}/${family}${query ? `?${query}` : ""}`);
  }, [base, params.league, router, search]);

  return <div className="scout-root" />;
}
