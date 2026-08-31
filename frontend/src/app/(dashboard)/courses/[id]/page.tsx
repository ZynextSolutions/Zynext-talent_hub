"use client";

import { use } from "react";
import { CourseStudio } from "@/components/courses/course-studio";

export default function CourseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <CourseStudio courseId={id} />;
}
