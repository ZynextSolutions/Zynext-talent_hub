"use client";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 px-6 text-center">
      <h1 className="text-lg font-semibold">Something went wrong</h1>
      <p className="text-muted-foreground max-w-md text-sm">
        {error.message || "An unexpected error occurred. Try again."}
      </p>
      <button
        type="button"
        className="bg-primary text-primary-foreground rounded-md px-4 py-2 text-sm"
        onClick={() => reset()}
      >
        Try again
      </button>
    </div>
  );
}
