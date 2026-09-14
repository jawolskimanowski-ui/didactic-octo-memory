const KEYWORDS = new Set([
  "and",
  "break",
  "do",
  "else",
  "elseif",
  "end",
  "false",
  "for",
  "function",
  "if",
  "in",
  "local",
  "nil",
  "not",
  "or",
  "repeat",
  "return",
  "then",
  "true",
  "until",
  "while",
  "continue",
  "export",
  "type",
]);

const BUILTINS = new Set([
  "game",
  "script",
  "workspace",
  "plugin",
  "shared",
  "task",
  "typeof",
  "pcall",
  "xpcall",
  "pairs",
  "ipairs",
  "next",
  "select",
  "unpack",
  "tonumber",
  "tostring",
  "print",
  "warn",
  "error",
  "assert",
  "Instance",
  "Vector3",
  "Vector2",
  "CFrame",
  "Color3",
  "UDim2",
  "UDim",
  "Enum",
  "RaycastParams",
  "TweenInfo",
  "Players",
  "HttpService",
  "TweenService",
  "RunService",
  "UserInputService",
  "ReplicatedStorage",
  "ServerStorage",
  "Lighting",
  "wait",
  "spawn",
  "delay",
  "tick",
  "time",
]);

const HTML_ESC: Record<string, string> = {
  "&": "\u0026amp;",
  "<": "\u0026lt;",
  ">": "\u0026gt;",
  '"': "\u0026quot;",
};

function escapeHtml(s: string): string {
  return s.replace(/[&<>"]/g, (ch) => HTML_ESC[ch] ?? ch);
}

export function highlightLuau(source: string): string {
  let i = 0;
  const out: string[] = [];
  const push = (cls: string | null, text: string) => {
    const safe = escapeHtml(text);
    out.push(cls ? `<span class="${cls}">${safe}</span>` : safe);
  };

  while (i < source.length) {
    const ch = source[i]!;

    if (ch === "-" && source[i + 1] === "-") {
      if (source.slice(i, i + 4) === "--[[") {
        const end = source.indexOf("]]", i + 4);
        const close = end === -1 ? source.length : end + 2;
        push("token-cm", source.slice(i, close));
        i = close;
        continue;
      }
      const end = source.indexOf("\n", i);
      const close = end === -1 ? source.length : end;
      push("token-cm", source.slice(i, close));
      i = close;
      continue;
    }

    if (ch === '"' || ch === "'") {
      let j = i + 1;
      while (j < source.length) {
        if (source[j] === "\\") {
          j += 2;
          continue;
        }
        if (source[j] === ch) {
          j += 1;
          break;
        }
        j += 1;
      }
      push("token-str", source.slice(i, j));
      i = j;
      continue;
    }

    if (ch === "[" && source[i + 1] === "[") {
      const end = source.indexOf("]]", i + 2);
      const close = end === -1 ? source.length : end + 2;
      push("token-str", source.slice(i, close));
      i = close;
      continue;
    }

    if (/[0-9]/.test(ch) || (ch === "." && /[0-9]/.test(source[i + 1] ?? ""))) {
      let j = i + 1;
      while (j < source.length && /[0-9a-fxA-FX._]/.test(source[j]!)) j += 1;
      push("token-num", source.slice(i, j));
      i = j;
      continue;
    }

    if (/[A-Za-z_]/.test(ch)) {
      let j = i + 1;
      while (j < source.length && /[A-Za-z0-9_]/.test(source[j]!)) j += 1;
      const word = source.slice(i, j);
      const nextNonSpace = source.slice(j).match(/^\s*/)?.[0].length ?? 0;
      const after = source[j + nextNonSpace];
      if (KEYWORDS.has(word)) push("token-kw", word);
      else if (BUILTINS.has(word)) push("token-builtin", word);
      else if (after === "(") push("token-fn", word);
      else push(null, word);
      i = j;
      continue;
    }

    push(null, ch);
    i += 1;
  }

  return out.join("");
}

export type DiffLine = {
  type: "same" | "add" | "del";
  text: string;
  left?: number;
  right?: number;
};

export function diffLines(a: string, b: string): DiffLine[] {
  const left = a.split("\n");
  const right = b.split("\n");
  const n = left.length;
  const m = right.length;
  const dp: number[][] = Array.from({ length: n + 1 }, () => Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i -= 1) {
    for (let j = m - 1; j >= 0; j -= 1) {
      dp[i]![j] =
        left[i] === right[j]
          ? (dp[i + 1]![j + 1] ?? 0) + 1
          : Math.max(dp[i + 1]![j] ?? 0, dp[i]![j + 1] ?? 0);
    }
  }
  const out: DiffLine[] = [];
  let i = 0;
  let j = 0;
  let ln = 1;
  let rn = 1;
  while (i < n && j < m) {
    if (left[i] === right[j]) {
      out.push({ type: "same", text: left[i]!, left: ln, right: rn });
      i += 1;
      j += 1;
      ln += 1;
      rn += 1;
    } else if ((dp[i + 1]![j] ?? 0) >= (dp[i]![j + 1] ?? 0)) {
      out.push({ type: "del", text: left[i]!, left: ln });
      i += 1;
      ln += 1;
    } else {
      out.push({ type: "add", text: right[j]!, right: rn });
      j += 1;
      rn += 1;
    }
  }
  while (i < n) {
    out.push({ type: "del", text: left[i]!, left: ln });
    i += 1;
    ln += 1;
  }
  while (j < m) {
    out.push({ type: "add", text: right[j]!, right: rn });
    j += 1;
    rn += 1;
  }
  return out;
}
