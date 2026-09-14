export type DocSection = {
  slug: string;
  title: string;
  summary: string;
  body: { heading?: string; paragraphs: string[]; code?: string }[];
};

export const DOC_SECTIONS: DocSection[] = [
  {
    slug: "getting-started",
    title: "Getting started",
    summary: "What loadstring is, how hosted Luau works, and how to publish your first endpoint.",
    body: [
      {
        heading: "What loadstring is",
        paragraphs: [
          "In Roblox Luau, loadstring compiles a string of source into a function you can run. Combined with game:HttpGet, it lets an experience fetch a hosted script at runtime.",
          "loadstring.lua is a private hosting platform for those scripts. You keep plaintext in the editor. Publishing does not put that plaintext on a public page. Roblox downloads a protected payload from /raw/<slug>.",
        ],
        code: `loadstring(game:HttpGet("https://example.com/raw/my-script"))()`,
      },
      {
        heading: "How a hosted script actually runs",
        paragraphs: [
          "You create a project, write private Luau, and publish a version. That points /raw/<slug> at a wrapped payload — not your editor text.",
          "When a player executes the loadstring, the wrapper contacts /x/<uuid> to unwrap. That contact is a runtime execution. Fetching /raw without running the payload is only a fetch, and it does not increment executions.",
          "The wrapper has no account lock and no UserId whitelist. It runs for whoever executes it — your account, another account, any player.",
        ],
      },
      {
        heading: "Create, publish, obtain the endpoint",
        paragraphs: [
          "Sign in, open Projects, and create a script. The editor is labeled PRIVATE SOURCE — only you can load plaintext through the website.",
          "Save to create a version. Publish to attach that version to /raw/<slug>. Copy the loadstring snippet from the project overview and paste it into a LocalScript, a server script that can HttpGet, or an executor that provides game:HttpGet.",
          "Edit later, save a new version, and publish again. The slug stays stable unless you rename it in settings. Republishing rotates the unwrap key, so old saved copies of /raw stop decoding.",
        ],
      },
    ],
  },
  {
    slug: "luau-scripts",
    title: "Luau scripts",
    summary: "Syntax, Roblox services, modules, and structure for hosted scripts.",
    body: [
      {
        heading: "Structure that survives HttpGet",
        paragraphs: [
          "Write ordinary Luau in the editor. Prefer a single entry that waits for services, guards with pcall where Roblox APIs can fail, and avoids assuming Studio-only objects.",
          "The published file is a protected wrapper. After it unwraps, your source runs with loadstring. If you return a table at the end of the file, callers can treat it as a module. If you run side effects at top level, the script executes immediately.",
        ],
        code: `local Players = game:GetService("Players")
local player = Players.LocalPlayer

local function boot()
	if not player then
		return
	end
	-- your private logic
end

local ok, err = pcall(boot)
if not ok then
	warn("[script] boot failed:", err)
end`,
      },
      {
        heading: "Services, tables, events, functions",
        paragraphs: [
          "Use game:GetService to resolve Roblox services. Keep long-lived connections on RBXScriptSignals so the hosted script can be reasoned about in one place.",
          "Tables are your modules and config. Functions should be small and named. Prefer task.spawn / task.delay over the legacy spawn/wait APIs in new work.",
        ],
        code: `local RunService = game:GetService("RunService")

local config = {
	tag = "hosted",
	pulse = 0.4,
}

local function onHeartbeat(dt)
	-- dt is a number; keep this cheap
end

RunService.Heartbeat:Connect(onHeartbeat)`,
      },
      {
        heading: "Modules and best practices",
        paragraphs: [
          "If the hosted payload is a module, end with `return MyModule` and wrap the loadstring call: `local mod = loadstring(...)()` .",
          "Do not put webhook secrets, datastore keys, or Open Cloud keys in hosted Luau. Anything that unwraps on a client can be recovered from that client. Use the webhook proxy so secrets stay on the server.",
          "Handle errors. A thrown error in your source fails the payload after unwrap. Use pcall around HttpService calls and optional CoreGui APIs.",
        ],
      },
    ],
  },
  {
    slug: "publishing",
    title: "Publishing",
    summary: "Versions, protected endpoints, updates, and rollbacks.",
    body: [
      {
        heading: "Versions",
        paragraphs: [
          "Every save creates a semantic version (patch by default). You can bump minor or major when the script's contract changes.",
          "Version history is private. Only the owner can list, open, compare, or archive versions. Opening a version is audited.",
        ],
      },
      {
        heading: "What /raw returns",
        paragraphs: [
          "The raw URL is /raw/<slug>. It returns text/plain Luau so Roblox can HttpGet it. The first line is the credit header. The rest is a protected loader keyed by a UUID — not your editor source, and not a grok-prefixed id.",
          "The loader asks /x/<uuid> for unwrap material, records a runtime execution, then runs your source. There is no UserId check. Any player who executes the loadstring can run it.",
          "Changing the slug in project settings changes the public URL. Prefer keeping a stable slug once experiences depend on it.",
        ],
        code: `-- same endpoint, newest published payload
loadstring(game:HttpGet("https://host/raw/welcome-hud"))()`,
      },
    ],
  },
  {
    slug: "analytics",
    title: "Analytics",
    summary: "Runtime executions versus endpoint fetches — counted from real events only.",
    body: [
      {
        heading: "What an execution is",
        paragraphs: [
          "An execution is recorded when the injected runtime beacon runs: the wrapper calls /x/<uuid> while the script is launching on a player. That is the number shown as Total executions.",
          "A fetch is a GET of /raw/<slug> (Studio retry, a browser, a crawler, or the loadstring HttpGet itself). Fetches are listed separately. Fetching the endpoint without running the payload does not increment executions.",
          "We do not seed dashboards with sample traffic. Counters start at zero. Charts are built from stored event rows.",
        ],
      },
      {
        heading: "What we store",
        paragraphs: [
          "Each runtime ping stores timestamp, HTTP status, published version id, truncated user-agent, and a coarse region when the edge provides one (for example CF-IPCountry).",
          "We do not store IP addresses in analytics rows. We do not store Roblox user ids. We do not put request bodies or source code into analytics. Charts are per-project and visible only to the owner.",
        ],
      },
      {
        heading: "Reading the dashboard",
        paragraphs: [
          "Today / week / month execution counts come from event rows with event_type = execution. The lifetime total is the running execution counter on the project.",
          "Endpoint fetches and errors are labeled as such. A 404 on a known slug usually means the project is not published. A 429 means the caller hit a rate limit.",
          "Use Send a test runtime ping on the project page to fire the same /x path a player uses. That increments the real counter. It is a test, not simulated traffic.",
        ],
      },
    ],
  },
  {
    slug: "webhooks",
    title: "Webhooks",
    summary: "Server-side deliveries so Luau never holds your signing secret.",
    body: [
      {
        heading: "Why a proxy",
        paragraphs: [
          "If a hosted script posted directly to Discord, Slack, or your game ops URL, the webhook secret would live in Luau and therefore on every client that unwrapped the payload. That is not acceptable.",
          "Instead, configure the webhook in the dashboard. Secrets are encrypted at rest. The platform signs outbound deliveries with HMAC-SHA256.",
        ],
      },
      {
        heading: "Events",
        paragraphs: [
          "published, updated, execution, error, version_published, and client_event. execution fires on a runtime beacon, not on a raw fetch. client_event is the Luau proxy: POST /api/proxy/<slug> with a JSON body. No secret is required from Luau. The backend forwards to your URL with X-Loadstring-Signature.",
        ],
        code: `local HttpService = game:GetService("HttpService")

-- no secret in this script
HttpService:PostAsync(
	"https://host/api/proxy/welcome-hud",
	HttpService:JSONEncode({ kind = "match_end", placeId = game.PlaceId })
)`,
      },
      {
        heading: "Verifying deliveries",
        paragraphs: [
          "Compute HMAC-SHA256 of the raw JSON body using the secret shown once at webhook creation. Compare to the hex digest in X-Loadstring-Signature (prefix sha256=).",
          "Use Test webhook from the dashboard to send a synthetic event without publishing.",
        ],
      },
    ],
  },
  {
    slug: "security",
    title: "Security",
    summary: "Ownership, protected payloads, runtime unwrap, and what this can and cannot claim.",
    body: [
      {
        heading: "Website and API privacy",
        paragraphs: [
          "Private source is stored in script_versions.source_code. Listing projects, public pages, docs, search, and analytics responses never include it.",
          "Every source read, save, publish, compare, and rollback checks: authenticated user owns the project. Failures return 401 or 403 without the payload. Those reads are written to your audit log.",
        ],
      },
      {
        heading: "Published payload protection",
        paragraphs: [
          "The raw endpoint does not serve editor plaintext. It serves a loader: credit header, a UUID (not a grok id), ciphertext, and a runtime beacon. The unwrap key is not in that file. /x/<uuid> returns it when the script actually launches, for any player, with no account check.",
          "That stops casual skids who copy /raw and expect readable Luau. Republishing rotates the key so saved dumps of an old /raw stop decoding.",
          "Crawlers are asked not to index /raw and /x in robots.txt. Rate limits apply.",
        ],
      },
      {
        heading: "What this platform cannot claim",
        paragraphs: [
          "Once a client has unwrapped complete Luau, that text cannot be guaranteed mathematically unrecoverable. Memory dumps, hooked loadstring, and proxy tooling exist. Anyone who promises otherwise is not being honest.",
          "loadstring.lua protects the website, database, owner APIs, webhook secrets, unpublished drafts, and the published file against casual copy. Treat a determined attacker with a running client as able to recover source.",
        ],
      },
    ],
  },
];

export function getDoc(slug: string): DocSection | undefined {
  return DOC_SECTIONS.find((s) => s.slug === slug);
}
