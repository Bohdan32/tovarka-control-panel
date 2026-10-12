import { Fragment, type ReactNode } from "react";
import { TERM_RE, meaningOf } from "@/lib/glossary";
import { Term } from "./term";

// Підкреслює терміни зі словника. `seen` — щоб пояснювати кожен термін лише раз на блок тексту.
export function termify(text: string, seen: Set<string> = new Set()): ReactNode {
  const out: ReactNode[] = [];
  let last = 0;
  for (const m of text.matchAll(TERM_RE)) {
    const key = m[0].toLowerCase();
    const meaning = meaningOf(key);
    if (!meaning || seen.has(key)) continue;
    seen.add(key);
    out.push(text.slice(last, m.index), <Term key={`t${m.index}`} word={m[0]} meaning={meaning} />);
    last = m.index + m[0].length;
  }
  if (!out.length) return text;
  out.push(text.slice(last));
  return out.map((p, i) => <Fragment key={i}>{p}</Fragment>);
}
