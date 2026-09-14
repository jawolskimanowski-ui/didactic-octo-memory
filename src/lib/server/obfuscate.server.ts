import { randomBytes } from "node:crypto";

const LUA_KEYWORDS = new Set([
  "and",
  "break",
  "do",
  "else",
  "elseif",
  "end",
  "false",
  "for",
  "function",
  "goto",
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
]);

const LUA_GLOBALS = new Set([
  "_G",
  "_VERSION",
  "assert",
  "bit32",
  "buffer",
  "collectgarbage",
  "coroutine",
  "debug",
  "delay",
  "Enum",
  "error",
  "game",
  "getfenv",
  "getmetatable",
  "Instance",
  "ipairs",
  "load",
  "loadstring",
  "math",
  "next",
  "os",
  "pairs",
  "pcall",
  "plugin",
  "print",
  "rawequal",
  "rawget",
  "rawlen",
  "rawset",
  "require",
  "script",
  "select",
  "setfenv",
  "setmetatable",
  "shared",
  "spawn",
  "string",
  "table",
  "task",
  "tick",
  "time",
  "tonumber",
  "tostring",
  "type",
  "typeof",
  "unpack",
  "utf8",
  "Vector2",
  "Vector3",
  "CFrame",
  "Color3",
  "UDim",
  "UDim2",
  "Ray",
  "Region3",
  "Rect",
  "BrickColor",
  "NumberSequence",
  "ColorSequence",
  "NumberRange",
  "wait",
  "warn",
  "workspace",
  "xpcall",
  "HttpService",
  "Players",
  "TweenService",
  "RunService",
  "ReplicatedStorage",
  "Lighting",
  "UserInputService",
  "TeleportService",
  "MarketplaceService",
  "DataStoreService",
  "SoundService",
  "StarterGui",
  "StarterPlayer",
  "Chat",
]);

function rand(n: number): number {
  return randomBytes(4).readUInt32BE(0) % n;
}

function ident(salt: number): string {
  const styles = rand(3);
  const n = 4 + rand(5);
  if (styles === 0) {
    return `_0x${randomBytes(3).toString("hex")}${salt.toString(16)}`;
  }
  if (styles === 1) {
    const alphabet = "IlO0l1i";
    let out = "_";
    for (let i = 0; i < n + 2; i += 1) out += alphabet[rand(alphabet.length)];
    return out + salt.toString(16);
  }
  const alphabet = "abcdefghjkmnpqrstuvwxyz";
  let out = "_";
  for (let i = 0; i < n; i += 1) out += alphabet[rand(alphabet.length)];
  return out;
}

function uniqueId(used: Set<string>, salt: number): string {
  for (let i = 0; i < 40; i += 1) {
    const id = ident(salt + i);
    if (!used.has(id) && !LUA_KEYWORDS.has(id) && !LUA_GLOBALS.has(id)) {
      used.add(id);
      return id;
    }
  }
  const fallback = `_n${randomBytes(6).toString("hex")}`;
  used.add(fallback);
  return fallback;
}

type Token =
  | { kind: "id"; value: string }
  | { kind: "str"; value: string; quote: '"' | "'" }
  | { kind: "num"; value: string }
  | { kind: "other"; value: string }
  | { kind: "comment"; value: string };

function tokenize(src: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  const n = src.length;
  while (i < n) {
    const c = src[i]!;
    if (c === "-" && src[i + 1] === "-") {
      if (src[i + 2] === "[" && src[i + 3] === "[") {
        const end = src.indexOf("]]", i + 4);
        const j = end === -1 ? n : end + 2;
        tokens.push({ kind: "comment", value: src.slice(i, j) });
        i = j;
        continue;
      }
      let j = i + 2;
      while (j < n && src[j] !== "\n") j += 1;
      tokens.push({ kind: "comment", value: src.slice(i, j) });
      i = j;
      continue;
    }
    if (c === "'" || c === '"') {
      const q = c;
      let j = i + 1;
      while (j < n) {
        if (src[j] === "\\" && j + 1 < n) {
          j += 2;
          continue;
        }
        if (src[j] === q) {
          j += 1;
          break;
        }
        j += 1;
      }
      tokens.push({ kind: "str", value: src.slice(i + 1, j - 1), quote: q });
      i = j;
      continue;
    }
    if (c === "[" && src[i + 1] === "[") {
      const end = src.indexOf("]]", i + 2);
      const j = end === -1 ? n : end + 2;
      tokens.push({ kind: "str", value: src.slice(i + 2, j - 2), quote: '"' });
      i = j;
      continue;
    }
    if (/[A-Za-z_]/.test(c)) {
      let j = i + 1;
      while (j < n && /[A-Za-z0-9_]/.test(src[j]!)) j += 1;
      tokens.push({ kind: "id", value: src.slice(i, j) });
      i = j;
      continue;
    }
    if (/[0-9]/.test(c) || (c === "." && /[0-9]/.test(src[i + 1] ?? ""))) {
      let j = i + 1;
      while (j < n && /[0-9A-Fa-fxX.]/.test(src[j]!)) j += 1;
      tokens.push({ kind: "num", value: src.slice(i, j) });
      i = j;
      continue;
    }
    tokens.push({ kind: "other", value: c });
    i += 1;
  }
  return tokens;
}

function collectLocals(tokens: Token[]): Set<string> {
  const locals = new Set<string>();
  for (let i = 0; i < tokens.length; i += 1) {
    const t = tokens[i]!;
    if (t.kind !== "id" || t.value !== "local") continue;
    let j = i + 1;
    while (j < tokens.length && tokens[j]!.kind === "other" && /\s/.test(tokens[j]!.value)) {
      j += 1;
    }
    const next = tokens[j];
    if (next?.kind === "id" && next.value === "function") {
      j += 1;
      while (j < tokens.length && tokens[j]!.kind === "other" && /\s/.test(tokens[j]!.value)) {
        j += 1;
      }
      const name = tokens[j];
      if (name?.kind === "id" && !LUA_KEYWORDS.has(name.value) && !LUA_GLOBALS.has(name.value)) {
        locals.add(name.value);
      }
      continue;
    }
    while (j < tokens.length) {
      const cur = tokens[j]!;
      if (cur.kind === "id") {
        if (!LUA_KEYWORDS.has(cur.value) && !LUA_GLOBALS.has(cur.value)) locals.add(cur.value);
        j += 1;
        continue;
      }
      if (cur.kind === "other" && (cur.value === "," || /\s/.test(cur.value))) {
        j += 1;
        continue;
      }
      break;
    }
  }
  return locals;
}

function b64(bytes: Buffer): string {
  return bytes.toString("base64");
}

function luaB64Decoder(fn: string, alpha: string): string {
  return `local function ${fn}(d)
	local b=${JSON.stringify(alpha)}
	d=d:gsub("[^"..b.."=]","")
	local o={}
	for i=1,#d,4 do
		local a=b:find(d:sub(i,i),1,true) or 1
		local c=b:find(d:sub(i+1,i+1),1,true) or 1
		local e=b:find(d:sub(i+2,i+2),1,true) or 1
		local f=b:find(d:sub(i+3,i+3),1,true) or 1
		a,c,e,f=a-1,c-1,e-1,f-1
		local n=a*262144+c*4096+math.max(e,0)*64+math.max(f,0)
		o[#o+1]=string.char(math.floor(n/65536)%256)
		if d:sub(i+2,i+2)~="=" then o[#o+1]=string.char(math.floor(n/256)%256) end
		if d:sub(i+3,i+3)~="=" then o[#o+1]=string.char(n%256) end
	end
	return table.concat(o)
end`;
}

function luaXor(fn: string): string {
  return `local function ${fn}(a,b)
	local r,p=0,1
	a=math.floor(a)
	b=math.floor(b)
	while a>0 or b>0 do
		local x,y=a%2,b%2
		if x~=y then r=r+p end
		a,b,p=(a-x)/2,(b-y)/2,p*2
	end
	return r
end`;
}

function scrambleAlpha(): { table: string; std: string } {
  const std = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  const chars = std.split("");
  for (let i = chars.length - 1; i > 0; i -= 1) {
    const j = rand(i + 1);
    const tmp = chars[i]!;
    chars[i] = chars[j]!;
    chars[j] = tmp;
  }
  return { table: chars.join(""), std };
}

function toCustomB64(buf: Buffer, table: string): string {
  const std = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  const raw = buf.toString("base64");
  let out = "";
  for (const ch of raw) {
    if (ch === "=") {
      out += "=";
      continue;
    }
    const idx = std.indexOf(ch);
    out += idx >= 0 ? table[idx]! : ch;
  }
  return out;
}

function encodeNumber(n: number): string {
  const a = 3 + rand(40);
  const b = n - a;
  if (rand(2) === 0) return `(${a}+${b})`;
  const x = n ^ (a & 255);
  return `(${x}+${a}-${a})`;
}

/**
 * Server-only Luau obfuscator. Random names, scrambled base64, XOR, junk
 * predicates. Intentionally slow to reverse; not a cryptographic guarantee.
 */
export function obfuscateLuau(source: string): string {
  const used = new Set<string>();
  const tokens = tokenize(source);
  const locals = collectLocals(tokens);
  const map = new Map<string, string>();
  let salt = 1;
  for (const name of locals) {
    if (name.startsWith("_0x") || name.length < 2) continue;
    map.set(name, uniqueId(used, salt++));
  }

  const decodeStr = uniqueId(used, salt++);
  const pieces: string[] = [];
  for (const t of tokens) {
    if (t.kind === "comment") continue;
    if (t.kind === "id") {
      pieces.push(map.get(t.value) ?? t.value);
      continue;
    }
    if (t.kind === "str") {
      if (t.value.length === 0) {
        pieces.push(`${t.quote}${t.quote}`);
        continue;
      }
      const encoded = Buffer.from(t.value, "utf8").toString("base64");
      pieces.push(`${decodeStr}("${encoded}")`);
      continue;
    }
    if (t.kind === "num") {
      const n = Number(t.value);
      if (Number.isInteger(n) && n >= 0 && n < 100000 && t.value.indexOf(".") === -1 && t.value.indexOf("x") === -1) {
        pieces.push(encodeNumber(n));
        continue;
      }
    }
    pieces.push(t.value);
  }

  const stdAlpha = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  const inner = `${luaB64Decoder(decodeStr, stdAlpha)}\n${pieces.join("")}`;

  const key = randomBytes(16 + rand(16));
  const plain = Buffer.from(inner, "utf8");
  const cipher = Buffer.alloc(plain.length);
  for (let i = 0; i < plain.length; i += 1) {
    cipher[i] = plain[i]! ^ key[i % key.length]! ^ ((i * 37 + 91) % 256);
  }
  const { table } = scrambleAlpha();
  const encoded = toCustomB64(cipher, table);
  const chunk = 96 + rand(48);
  const chunks: string[] = [];
  for (let i = 0; i < encoded.length; i += chunk) {
    chunks.push(encoded.slice(i, i + chunk));
  }

  const ids = {
    dec: uniqueId(used, salt++),
    xor: uniqueId(used, salt++),
    bag: uniqueId(used, salt++),
    blob: uniqueId(used, salt++),
    raw: uniqueId(used, salt++),
    key: uniqueId(used, salt++),
    out: uniqueId(used, salt++),
    i: uniqueId(used, salt++),
    k: uniqueId(used, salt++),
    m: uniqueId(used, salt++),
    src: uniqueId(used, salt++),
    fn: uniqueId(used, salt++),
    err: uniqueId(used, salt++),
    ld: uniqueId(used, salt++),
    junk: uniqueId(used, salt++),
    acc: uniqueId(used, salt++),
  };

  const keyLit = `{${Array.from(key).join(",")}}`;
  const chunkLit = chunks.map((c) => JSON.stringify(c)).join(",");
  const junkPred = encodeNumber(2);

  return `-- protected payload
return(function()
	if ${junkPred}~=2 then return end
${luaB64Decoder(ids.dec, table)}
${luaXor(ids.xor)}
	local ${ids.bag}={${chunkLit}}
	local ${ids.blob}=${ids.dec}(table.concat(${ids.bag}))
	local ${ids.key}=${keyLit}
	local ${ids.out}={}
	local ${ids.acc}=0
	for ${ids.i}=1,#${ids.blob} do
		local ${ids.k}=${ids.key}[((${ids.i}-1)%#${ids.key})+1]
		local ${ids.m}=(${ids.i}*37+91)%256
		${ids.out}[${ids.i}]=string.char(${ids.xor}(${ids.xor}(${ids.blob}:byte(${ids.i}),${ids.k}),${ids.m}))
		${ids.acc}=${ids.acc}+1
	end
	local ${ids.junk}=${ids.acc}>0
	if not ${ids.junk} then error("init failed") end
	local ${ids.src}=table.concat(${ids.out})
	for ${ids.i}=1,#${ids.out} do ${ids.out}[${ids.i}]=nil end
	${ids.blob}=nil
	${ids.bag}=nil
	local ${ids.ld}
	do
		local ok,res=pcall(function() return loadstring end)
		if ok and type(res)=="function" then ${ids.ld}=res else
			ok,res=pcall(function() return load end)
			if ok and type(res)=="function" then ${ids.ld}=res end
		end
	end
	if type(${ids.ld})~="function" then error("init failed") end
	local ${ids.fn},${ids.err}=${ids.ld}(${ids.src})
	${ids.src}=nil
	if not ${ids.fn} then error(${ids.err}) end
	return ${ids.fn}()
end)()
`;
}

export function looksObfuscated(source: string): boolean {
  return source.includes("protected payload") && source.includes("return(function()");
}
