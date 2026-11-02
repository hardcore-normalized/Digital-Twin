import { Card } from "@/components/ui";

export const metadata = { title: "Storage API" };

function Code({ children }: { children: string }) {
  return (
    <pre className="overflow-x-auto rounded-lg border border-border bg-card-muted p-4 font-mono text-[12.5px] leading-relaxed">{children}</pre>
  );
}

const endpoints = [
  { method: "GET", path: "/files?prefix=twins/", desc: "List files under a prefix.", res: `200 { "files": [{ "path": "twins/priya@acme.com/ABOUT.md", "updatedAt": "2026-10-28T10:00:00Z", "size": 812 }] }` },
  { method: "GET", path: "/files/{path}", desc: "Read one file.", res: "200 with the markdown as the body, or 404 if it doesn't exist." },
  { method: "PUT", path: "/files/{path}", desc: "Create or replace a file.", res: "Any 2xx. Request body is the markdown (Content-Type: text/markdown)." },
  { method: "DELETE", path: "/files/{path}", desc: "Delete a file.", res: "Any 2xx, or 404 if it was already gone." },
];

export default function StorageApiDocs() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6 lg:py-24">
      <p className="text-sm text-text-3">Docs</p>
      <h1 className="mt-1 font-serif text-[40px] leading-tight font-medium tracking-[-0.02em]">Bring your own storage API</h1>
      <p className="mt-3 max-w-2xl text-[17px] text-text-2">
        Keep every twin file on your own servers. Implement four HTTPS endpoints, then add the base URL and a token in
        Settings → File storage. Digital Twin tests the connection before switching.
      </p>

      <h2 className="mt-12 text-xl font-semibold">Requests</h2>
      <p className="mt-2 text-[15px] text-text-2">
        Every request carries <code className="font-mono text-sm">Authorization: Bearer &lt;your token&gt;</code>. Paths are URL-encoded
        per segment and look like <code className="font-mono text-sm">twins/&lt;email&gt;/PROGRESS.md</code>. Old versions are written to{" "}
        <code className="font-mono text-sm">twins/&lt;email&gt;/.history/&lt;file&gt;/&lt;timestamp&gt;.md</code>.
      </p>
      <Card className="mt-5 divide-y divide-border">
        {endpoints.map((e) => (
          <div key={e.method + e.path} className="grid gap-2 p-5 md:grid-cols-[220px_1fr]">
            <div className="font-mono text-sm">
              <span className="mr-2 rounded bg-accent-soft px-1.5 py-0.5 text-xs font-semibold text-accent">{e.method}</span>
              {e.path}
            </div>
            <div className="text-sm">
              <div>{e.desc}</div>
              <div className="mt-1 text-text-2">{e.res}</div>
            </div>
          </div>
        ))}
      </Card>

      <h2 className="mt-12 text-xl font-semibold">Requirements</h2>
      <ul className="mt-3 list-disc space-y-1.5 pl-5 text-[15px] text-text-2">
        <li>HTTPS only (plain http is allowed for localhost while testing).</li>
        <li>Respond within 15 seconds.</li>
        <li>Store content byte-for-byte — the connection test writes a file and reads it back.</li>
        <li>Reject requests without the right token with 401.</li>
      </ul>

      <h2 className="mt-12 text-xl font-semibold">Reference server</h2>
      <p className="mt-2 text-[15px] text-text-2">
        The repository includes a dependency-free Node.js server that stores files on disk. Run it to try the feature, or use it as a starting point:
      </p>
      <div className="mt-4">
        <Code>{`STORAGE_TOKEN=change-me PORT=4100 npm run storage-api:example

# In Digital Twin → Settings → File storage → "Your own API":
#   Base URL: http://localhost:4100
#   Token:    change-me`}</Code>
      </div>

      <h2 className="mt-12 text-xl font-semibold">Example</h2>
      <div className="mt-4">
        <Code>{`curl -X PUT https://files.acme.com/digital-twin/files/twins/priya%40acme.com/ABOUT.md \\
  -H "Authorization: Bearer $TOKEN" \\
  -H "Content-Type: text/markdown" \\
  --data-binary @ABOUT.md`}</Code>
      </div>
    </div>
  );
}
