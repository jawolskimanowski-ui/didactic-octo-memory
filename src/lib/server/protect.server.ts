import { createHash, randomUUID } from "node:crypto";
import { obfuscateLuau } from "./obfuscate.server";

export const PAYLOAD_CREDIT = "-- hosted by loadstring.lua";

export function newUuid(): string {
  return randomUUID();
}

export function deriveWrapKey(wrapSeed: string, versionId: string): Buffer {
  return createHash("sha256").update(`${wrapSeed}:${versionId}`, "utf8").digest();
}

export function mixByte(index1: number): number {
  return (index1 * 131 + 17) % 256;
}

export function encryptSource(plainUtf8: Buffer, key: Buffer): Buffer {
  const out = Buffer.alloc(plainUtf8.length);
  const klen = key.length;
  for (let i = 0; i < plainUtf8.length; i += 1) {
    out[i] = plainUtf8[i]! ^ key[i % klen]! ^ mixByte(i + 1);
  }
  return out;
}

export function decryptSource(cipher: Buffer, key: Buffer): Buffer {
  return encryptSource(cipher, key);
}

export function checksum(plainUtf8: Buffer): number {
  let sum = 0;
  for (let i = 0; i < plainUtf8.length; i += 1) {
    sum = (sum + plainUtf8[i]!) % 65521;
  }
  return sum;
}

export function formatKeyChunk(key: Buffer): string {
  return `return{${Array.from(key).join(",")}}`;
}

export function parseKeyChunk(chunk: string): Buffer {
  const match = chunk.trim().match(/^return\{([\d,]+)\}$/);
  if (!match) throw new Error("invalid key chunk");
  const bytes = match[1]!.split(",").map((n) => Number.parseInt(n, 10));
  if (bytes.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) {
    throw new Error("invalid key chunk");
  }
  return Buffer.from(bytes);
}

function ident(runtimeId: string, salt: string): string {
  const hex = createHash("sha256")
    .update(`${runtimeId}:${salt}`, "utf8")
    .digest("hex");
  return `_${hex.slice(0, 8)}`;
}

function packCharCodes(value: string, perCall = 48): string {
  const codes = Array.from(Buffer.from(value, "utf8"));
  const parts: string[] = [];
  for (let i = 0; i < codes.length; i += perCall) {
    parts.push(`string.char(${codes.slice(i, i + perCall).join(",")})`);
  }
  return parts.join("..");
}

function packHexChunks(hex: string, size = 180): string {
  const chunks: string[] = [];
  for (let i = 0; i < hex.length; i += size) {
    chunks.push(`"${hex.slice(i, i + size)}"`);
  }
  if (chunks.length === 0) return '""';
  if (chunks.length === 1) return chunks[0]!;
  return `table.concat({${chunks.join(",")}})`;
}

export type WrapInput = {
  source: string;
  origin: string;
  runtimeId: string;
  wrapSeed: string;
  versionId: string;
  obfuscate?: boolean;
};

export type WrappedPayload = {
  lua: string;
  keyChunk: string;
  checksum: number;
  runtimeId: string;
  cipherHex: string;
};

function bxorLua(id: string): string {
  return `local function ${id}(a,b)
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

export function wrapPublishedSource(input: WrapInput): WrappedPayload {
  let source = input.source;
  if (input.obfuscate) {
    source = obfuscateLuau(source);
  }
  const runtimeId = input.runtimeId;
  const key = deriveWrapKey(input.wrapSeed, input.versionId);
  const plain = Buffer.from(source, "utf8");
  const cipher = encryptSource(plain, key);
  const hex = cipher.toString("hex");
  const sum = checksum(plain);
  const origin = input.origin.replace(/\/$/, "");
  const prefix = `${origin}/x/`;

  const ids = {
    pull: ident(runtimeId, "pull"),
    xor: ident(runtimeId, "xor"),
    url: ident(runtimeId, "url"),
    blob: ident(runtimeId, "blob"),
    mat: ident(runtimeId, "mat"),
    bytes: ident(runtimeId, "bytes"),
    out: ident(runtimeId, "out"),
    src: ident(runtimeId, "src"),
    fn: ident(runtimeId, "fn"),
    err: ident(runtimeId, "err"),
    i: ident(runtimeId, "i"),
    k: ident(runtimeId, "k"),
    m: ident(runtimeId, "m"),
    n: ident(runtimeId, "n"),
    ok: ident(runtimeId, "ok"),
    res: ident(runtimeId, "res"),
    try: ident(runtimeId, "try"),
    uid: ident(runtimeId, "uid"),
    sum: ident(runtimeId, "sum"),
    acc: ident(runtimeId, "acc"),
    got: ident(runtimeId, "got"),
    chunk: ident(runtimeId, "chunk"),
    load: ident(runtimeId, "load"),
    post: ident(runtimeId, "post"),
    body: ident(runtimeId, "body"),
    hs: ident(runtimeId, "hs"),
  };

  const lua = `${PAYLOAD_CREDIT}
return(function()
	local ${ids.uid}=${JSON.stringify(runtimeId)}
	local ${ids.url}=${packCharCodes(prefix)}..${ids.uid}
	local ${ids.blob}=${packHexChunks(hex)}
	local ${ids.sum}=${sum}
	local ${ids.load}
	do
		local ${ids.ok},${ids.res}=pcall(function() return loadstring end)
		if ${ids.ok} and type(${ids.res})=="function" then
			${ids.load}=${ids.res}
		else
			${ids.ok},${ids.res}=pcall(function() return load end)
			if ${ids.ok} and type(${ids.res})=="function" then
				${ids.load}=${ids.res}
			end
		end
	end
	if type(${ids.load})~="function" then
		error("init failed")
	end
${bxorLua(ids.xor)}
	local function ${ids.pull}(u)
		local ${ids.try}={
			function() return game:HttpGet(u) end,
			function() return game:HttpGetAsync(u) end,
			function() return game:GetService("HttpService"):GetAsync(u) end,
			function() return syn.request({Url=u,Method="GET"}).Body end,
			function() return request({Url=u,Method="GET"}).Body end,
			function() return http_request({Url=u,Method="GET"}).Body end,
			function() return http.request({Url=u,Method="GET"}).Body end,
		}
		for ${ids.i}=1,#${ids.try} do
			local ${ids.ok},${ids.res}=pcall(${ids.try}[${ids.i}])
			if ${ids.ok} and type(${ids.res})=="string" and #${ids.res}>0 then
				return ${ids.res}
			end
		end
		error("init failed")
	end
	local function ${ids.post}(u,p)
		local ${ids.try}={
			function()
				local ${ids.hs}=game:GetService("HttpService")
				return ${ids.hs}:PostAsync(u,p,Enum.HttpContentType.ApplicationJson)
			end,
			function() return syn.request({Url=u,Method="POST",Body=p,Headers={["content-type"]="application/json"}}).Body end,
			function() return request({Url=u,Method="POST",Body=p,Headers={["content-type"]="application/json"}}).Body end,
			function() return http_request({Url=u,Method="POST",Body=p,Headers={["content-type"]="application/json"}}).Body end,
			function() return http.request({Url=u,Method="POST",Body=p,Headers={["content-type"]="application/json"}}).Body end,
		}
		for ${ids.i}=1,#${ids.try} do
			pcall(${ids.try}[${ids.i}])
		end
	end
	local ${ids.chunk}=assert(${ids.load}(${ids.pull}(${ids.url})))
	local ${ids.mat}=${ids.chunk}()
	if type(${ids.mat})~="table" or #${ids.mat}<16 then
		error("init failed")
	end
	local ${ids.bytes}={}
	for ${ids.i}=1,#${ids.blob},2 do
		${ids.bytes}[#${ids.bytes}+1]=tonumber(${ids.blob}:sub(${ids.i},${ids.i}+1),16)
	end
	local ${ids.n}=#${ids.mat}
	local ${ids.out}={}
	local ${ids.acc}=0
	for ${ids.i}=1,#${ids.bytes} do
		local ${ids.k}=${ids.mat}[((${ids.i}-1)%${ids.n})+1]
		local ${ids.m}=(${ids.i}*131+17)%256
		local ${ids.got}=${ids.xor}(${ids.xor}(${ids.bytes}[${ids.i}],${ids.k}),${ids.m})
		${ids.out}[${ids.i}]=string.char(${ids.got})
		${ids.acc}=(${ids.acc}+${ids.got})%65521
	end
	if ${ids.acc}~=${ids.sum} then
		error("init failed")
	end
	local ${ids.src}=table.concat(${ids.out})
	for ${ids.i}=1,#${ids.out} do ${ids.out}[${ids.i}]=nil end
	${ids.bytes}=nil
	${ids.blob}=nil
	${ids.mat}=nil
	pcall(function()
		${ids.post}(${ids.url},${packCharCodes('{"kind":"boot","message":"published script executed"}')})
	end)
	local ${ids.fn},${ids.err}=${ids.load}(${ids.src})
	${ids.src}=nil
	if not ${ids.fn} then
		error(${ids.err})
	end
	return ${ids.fn}()
end)()
`;

  return {
    lua,
    keyChunk: formatKeyChunk(key),
    checksum: sum,
    runtimeId,
    cipherHex: hex,
  };
}

export function unwrapWithKey(cipherHex: string, keyChunk: string): string {
  const key = parseKeyChunk(keyChunk);
  const cipher = Buffer.from(cipherHex, "hex");
  return decryptSource(cipher, key).toString("utf8");
}

export function grokMentions(lua: string): number {
  return (lua.match(/grok/gi) ?? []).length;
}
