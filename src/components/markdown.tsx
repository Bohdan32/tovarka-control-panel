import { termify } from "./terms";

// Minimal markdown for analyst reports and the launch plan: headings, lists, tables, bold, links, paragraphs.
function inline(text: string, seen?: Set<string>) {
  const parts = text.split(/(\*\*[^*]+\*\*|\[[^\]]+\]\([^)]+\))/g);
  return parts.map((p, i) => {
    if (p.startsWith("**") && p.endsWith("**")) return <strong key={i} className="font-semibold">{p.slice(2, -2)}</strong>;
    const link = p.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    if (link) {
      const href = link[2];
      const safe = href.startsWith("http") || href.startsWith("/");
      return safe ? (
        <a key={i} href={href} className="text-indigo-600 hover:underline dark:text-indigo-400" target={href.startsWith("http") ? "_blank" : undefined} rel="noreferrer">
          {link[1]}
        </a>
      ) : (
        link[1]
      );
    }
    return seen ? <span key={i}>{termify(p, seen)}</span> : p;
  });
}

const cells = (line: string) => line.trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim());

export function Markdown({ text, terms = true }: { text: string; terms?: boolean }) {
  const seen = terms ? new Set<string>() : undefined;
  const blocks: React.ReactNode[] = [];
  const lines = text.split("\n");
  let list: { ordered: boolean; items: string[] } | null = null;
  const flush = () => {
    if (!list) return;
    const Tag = list.ordered ? "ol" : "ul";
    blocks.push(
      <Tag key={blocks.length} className={`ml-5 space-y-1 ${list.ordered ? "list-decimal" : "list-disc"}`}>
        {list.items.map((l, i) => <li key={i}>{inline(l, seen)}</li>)}
      </Tag>,
    );
    list = null;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trimEnd();
    const bullet = line.match(/^\s*[-*] (.*)$/);
    const numbered = line.match(/^\s*\d+[.)] (.*)$/);
    if (bullet || numbered) {
      const ordered = Boolean(numbered);
      if (list && list.ordered !== ordered) flush();
      list ??= { ordered, items: [] };
      list.items.push((bullet ?? numbered)![1]);
      continue;
    }
    flush();
    if (!line.trim()) continue;

    // Таблиця: рядок з | і наступний рядок-роздільник.
    if (line.trim().startsWith("|") && /^\s*\|?\s*:?-{3,}/.test(lines[i + 1] ?? "")) {
      const head = cells(line);
      const rows: string[][] = [];
      i += 2;
      while (i < lines.length && lines[i].trim().startsWith("|")) rows.push(cells(lines[i++]));
      i--;
      blocks.push(
        <div key={blocks.length} className="-mx-1 overflow-x-auto px-1">
          <table className="rt w-full border-collapse text-[13px] sm:min-w-[28rem]">
            <thead>
              <tr className="border-b border-black/10 text-left text-xs text-zinc-500 dark:border-white/10">
                {head.map((h, k) => <th key={k} className="px-2 py-1.5 font-medium">{inline(h)}</th>)}
              </tr>
            </thead>
            <tbody className="divide-y divide-black/[.05] dark:divide-white/5">
              {rows.map((r, k) => (
                <tr key={k}>{r.map((c, m) => <td key={m} data-label={head[m]?.replace(/\*\*/g, "") || undefined} className={`px-2 py-1.5 align-top ${m === 0 ? "font-medium" : ""}`}>{inline(c)}</td>)}</tr>
              ))}
            </tbody>
          </table>
        </div>,
      );
      continue;
    }

    const h = line.match(/^(#{1,3}) (.*)$/);
    if (h) blocks.push(<h3 key={blocks.length} className="mt-3 font-semibold">{inline(h[2])}</h3>);
    else blocks.push(<p key={blocks.length}>{inline(line, seen)}</p>);
  }
  flush();
  return <div className="space-y-2.5 text-sm leading-relaxed">{blocks}</div>;
}
