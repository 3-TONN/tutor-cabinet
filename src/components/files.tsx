"use client";

// Материалы: тип файла по расширению и встроенный просмотр кода с подсветкой —
// чтобы ученик мог перечитать программу с занятия прямо с телефона.

import { useEffect, useState, type ReactNode } from "react";
import { Attachment } from "@/lib/types";
import { useStore } from "@/lib/store";
import { cls } from "@/lib/utils";
import { Button, Modal } from "./ui";

const CODE_EXT = ["py", "pyw", "txt", "c", "cpp", "h", "java", "js", "ts", "pas", "cs", "go", "rb", "sql", "csv", "json", "md", "html", "css", "xml"];

/** Расширение вложения: из имени файла, у ссылки — «URL» */
export function fileKind(a: Attachment): { label: string; code: boolean; link: boolean } {
  const isLink = !!a.url && !a.url.startsWith("data:") && !a.path;
  const m = a.name.toLowerCase().match(/\.([a-z0-9]{1,5})$/);
  const ext = m?.[1] ?? "";
  if (isLink && !ext) return { label: "URL", code: false, link: true };
  return { label: (ext || "файл").toUpperCase(), code: CODE_EXT.includes(ext), link: isLink };
}

// ---------------------------------------------------------------- подсветка Python (и похожих языков)

const KEYWORDS = new Set([
  "def", "class", "return", "if", "elif", "else", "for", "while", "in", "not", "and", "or", "import", "from", "as", "with",
  "try", "except", "finally", "lambda", "yield", "break", "continue", "pass", "global", "nonlocal", "assert", "raise", "del", "is",
  "True", "False", "None", "int", "float", "str", "list", "dict", "set", "tuple", "bool",
]);
const BUILTINS = new Set(["print", "range", "len", "input", "open", "sorted", "map", "sum", "min", "max", "abs", "enumerate", "zip", "bin", "oct", "hex", "ord", "chr", "round", "reversed", "any", "all"]);
const TOKEN = /(#[^\n]*|\/\/[^\n]*)|("""[\s\S]*?"""|'''[\s\S]*?'''|"(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*')|\b(\d+(?:\.\d+)?)\b|\b([A-Za-z_]\w*)\b/g;

function highlight(line: string): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  let k = 0;
  for (const m of line.matchAll(TOKEN)) {
    const i = m.index ?? 0;
    if (i > last) out.push(line.slice(last, i));
    const [t, comment, str, num, word] = m;
    if (comment) out.push(<span key={k++} className="text-graphite italic">{t}</span>);
    else if (str) out.push(<span key={k++} className="text-signal">{t}</span>);
    else if (num) out.push(<span key={k++} className="text-accent">{t}</span>);
    else if (word && KEYWORDS.has(word)) out.push(<span key={k++} className="font-medium text-accent">{t}</span>);
    else if (word && BUILTINS.has(word)) out.push(<span key={k++} className="underline decoration-ink/25 underline-offset-[3px]">{t}</span>);
    else out.push(t);
    last = i + t.length;
  }
  if (last < line.length) out.push(line.slice(last));
  return out;
}

export function CodeViewer({ attachment, onClose }: { attachment: Attachment; onClose: () => void }) {
  const { backend } = useStore();
  const [text, setText] = useState<string | null>(null);
  const [href, setHref] = useState("");
  const [downloadHref, setDownloadHref] = useState("");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const u = await backend!.fileUrl(attachment);
        if (!alive) return;
        setHref(u);
        setDownloadHref(await backend!.fileUrl(attachment, true));
        const res = await fetch(u);
        if (!res.ok) throw new Error(`Файл не открылся (код ${res.status}). Скачайте его кнопкой ниже.`);
        const t = await res.text();
        if (alive) setText(t.replace(/\r\n/g, "\n"));
      } catch (e) {
        if (alive) setError((e as Error).message);
      }
    })();
    return () => {
      alive = false;
    };
  }, [attachment, backend]);
  const lines = (text ?? "").split("\n");
  if (lines.length > 1 && lines[lines.length - 1] === "") lines.pop();
  return (
    <Modal open wide onClose={onClose} title={<span className="flex items-center gap-2"><span className="num rounded-md bg-ink px-1.5 py-0.5 text-xs text-paper">{fileKind(attachment).label}</span>{attachment.name}</span>}
      footer={<>
        {text != null && <span className="num mr-auto self-center text-xs text-graphite">{lines.length} строк</span>}
        {text != null && <Button variant="secondary" icon={copied ? "check" : "copy"} onClick={async () => { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1800); }}>{copied ? "Скопировано" : "Копировать код"}</Button>}
        {downloadHref && <a href={downloadHref} download={attachment.name} target="_blank" rel="noreferrer"><Button icon="download">Скачать</Button></a>}
      </>}>
      {error ? <p className="text-sm text-signal">{error}</p> : text == null ? (
        <p className="num text-sm text-graphite">Загружаю файл…</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-line bg-paper">
          <table className="num w-full border-collapse text-[13px] leading-6">
            <tbody>
              {lines.map((l, i) => (
                <tr key={i} className="hover:bg-accent/[0.06]">
                  <td className="select-none border-r border-line px-3 text-right align-top text-graphite/70">{i + 1}</td>
                  <td className="whitespace-pre px-4">{highlight(l)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Modal>
  );
}

/** Метка типа файла: моноширинный ярлык, код — инверсный */
export function KindTag({ a, className }: { a: Attachment; className?: string }) {
  const k = fileKind(a);
  return (
    <span className={cls("num inline-flex h-6 min-w-[2.75rem] shrink-0 items-center justify-center rounded-md px-1.5 text-[11px] font-medium",
      k.code ? "bg-ink text-paper" : k.link ? "text-accent ring-1 ring-inset ring-accent/50" : "text-ink ring-1 ring-inset ring-ink/40", className)}>
      {k.label}
    </span>
  );
}
