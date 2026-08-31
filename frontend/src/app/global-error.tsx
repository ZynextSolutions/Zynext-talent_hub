"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body>
        <div style={{ padding: 48, fontFamily: "system-ui, sans-serif", textAlign: "center" }}>
          <h1>Application error</h1>
          <p>{error.message || "Please reload the page."}</p>
          <button type="button" onClick={() => reset()}>
            Reload
          </button>
        </div>
      </body>
    </html>
  );
}
