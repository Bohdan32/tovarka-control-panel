// Minimal markdown for analyst reports: headings, bullets, bold, links, paragraphs.
function inline(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*|\[[^\]]+\]\([^)]+\))/g);
  return parts.map((p, i) => {
    if (p.startsWith("**") && p.endsWith("**")) return <strong key={i}>{p.slice(2, -2)}</strong>;
    const link = p.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    if (link) {
      const href = link[2];
      const safe = href.startsWith("http") || href.startsWith("/");
      return safe ? (
        <a key={i} href={href} className="text-sky-600 hover:underline" target={href.startsWith("http") ? "_blank" : undefined} rel="noreferrer">
          {link[1]}
        </a>
      ) : (
        link[1]
      );
    }
    return p;
  });
}

export function Markdown({ text }: { text: string }) {
  const blocks: React.ReactNode[] = [];
  let list: string[] = [];
  const flush = () => {
    if (list.length) {
      blocks.push(
        <ul key={blocks.length} className="ml-5 list-disc space-y-1">
          {list.map((l, i) => <li key={i}>{inline(l)}</li>)}
        </ul>,
      );
      list = [];
    }
  };
  for (const raw of text.split("\n")) {
    const line = raw.trimEnd();
    if (/^\s*[-*] /.test(line)) {
      list.push(line.replace(/^\s*[-*] /, ""));
      continue;
    }
    flush();
    if (!line.trim()) continue;
    const h = line.match(/^(#{1,3}) (.*)$/);
    if (h) blocks.push(<h3 key={blocks.length} className="mt-3 font-semibold">{inline(h[2])}</h3>);
    else blocks.push(<p key={blocks.length}>{inline(line)}</p>);
  }
  flush();
  return <div className="space-y-2 text-sm leading-relaxed">{blocks}</div>;
}
