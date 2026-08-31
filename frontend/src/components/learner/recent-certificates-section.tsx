"use client";

import Link from "next/link";
import { Award } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { Certificate } from "@/types";

function formatIssued(value: string) {
  return new Date(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function RecentCertificatesSection({
  items,
  isLoading,
}: {
  items: Certificate[];
  isLoading?: boolean;
}) {
  if (isLoading) {
    return (
      <section className="space-y-4">
        <h2 className="text-base font-semibold">Recent certificates</h2>
        <Skeleton className="h-24 rounded-xl" />
      </section>
    );
  }

  if (!items.length) return null;

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold">Recent certificates</h2>
        <Button variant="ghost" size="sm" asChild>
          <Link href="/certificates">View all</Link>
        </Button>
      </div>
      <div className="space-y-2">
        {items.map((cert) => (
          <Card key={cert.id} className="shadow-luxury">
            <CardContent className="flex items-center gap-3 p-4">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo/10 text-indigo">
                <Award className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">
                  {cert.path?.title ?? cert.course?.title ?? "Certificate"}
                </p>
                <p className="text-muted-foreground text-xs">
                  {cert.kind === "path" ? "Learning path · " : ""}
                  {cert.certificateNumber} · Issued {formatIssued(cert.issuedAt)}
                </p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}
