"use client";

import { Heart } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToggleCourseFavorite } from "@/hooks/useCourses";
import { Button } from "@/components/ui/button";

interface CatalogFavoriteButtonProps {
  courseId: string;
  favorited?: boolean;
  className?: string;
}

export function CatalogFavoriteButton({ courseId, favorited, className }: CatalogFavoriteButtonProps) {
  const toggle = useToggleCourseFavorite();

  return (
    <Button
      type="button"
      variant="secondary"
      size="icon"
      className={cn(
        "absolute bottom-3 left-3 h-8 w-8 rounded-full bg-background/80 shadow-sm backdrop-blur-sm hover:bg-background",
        className,
      )}
      aria-label={favorited ? "Remove from favorites" : "Add to favorites"}
      disabled={toggle.isPending}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        toggle.mutate({ courseId, favorited: !!favorited });
      }}
    >
      <Heart
        className={cn("h-4 w-4", favorited ? "fill-rose-500 text-rose-500" : "text-muted-foreground")}
      />
    </Button>
  );
}
