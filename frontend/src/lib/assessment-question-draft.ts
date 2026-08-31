import type { AssessmentQuestion } from "@/types";

export interface BlankDraft {
  acceptableAnswers: string[];
}

export interface PairDraft {
  left: string;
  right: string;
}

export interface QuestionDraft {
  prompt: string;
  type: "MCQ" | "TRUE_FALSE" | "MULTI_SELECT" | "SHORT_ANSWER" | "FILL_BLANK" | "MATCHING" | "ESSAY";
  options: string[];
  correctOptionIndex: number;
  correctOptionIndices: number[];
  points: number;
  explanation: string;
  blanks: BlankDraft[];
  pairs: PairDraft[];
  minWords: number | null;
  maxWords: number | null;
}

export function emptyQuestion(): QuestionDraft {
  return {
    prompt: "",
    type: "MCQ",
    options: ["", ""],
    correctOptionIndex: 0,
    correctOptionIndices: [],
    points: 1,
    explanation: "",
    blanks: [{ acceptableAnswers: [""] }],
    pairs: [
      { left: "", right: "" },
      { left: "", right: "" },
    ],
    minWords: null,
    maxWords: null,
  };
}

function metadataOf(q: AssessmentQuestion): Record<string, unknown> {
  return q.metadata ?? {};
}

export function apiQuestionsToDraft(questions: AssessmentQuestion[]): QuestionDraft[] {
  if (!questions.length) return [emptyQuestion()];
  return questions.map((q) => {
    const type = q.type ?? "MCQ";
    const meta = metadataOf(q);
    const options =
      type === "TRUE_FALSE"
        ? ["True", "False"]
        : type === "SHORT_ANSWER" || type === "ESSAY" || type === "FILL_BLANK" || type === "MATCHING"
          ? []
          : q.options.map((o) => o.text);
    let correctOptionIndex = 0;
    let correctOptionIndices: number[] = [];
    if (type === "MULTI_SELECT" && q.correctOptionIds?.length) {
      correctOptionIndices = q.options
        .map((o, i) => (q.correctOptionIds!.includes(o.id) ? i : -1))
        .filter((i) => i >= 0);
    } else if (q.correctOptionId) {
      correctOptionIndex = Math.max(
        0,
        q.options.findIndex((o) => o.id === q.correctOptionId),
      );
    }
    const blanks = Array.isArray(meta.blanks)
      ? (meta.blanks as Array<{ acceptableAnswers?: string[] }>).map((b) => ({
          acceptableAnswers: b.acceptableAnswers?.length ? b.acceptableAnswers : [""],
        }))
      : [{ acceptableAnswers: [""] }];
    const pairs = Array.isArray(meta.pairs)
      ? (meta.pairs as Array<{ left?: string; right?: string }>).map((p) => ({
          left: p.left ?? "",
          right: p.right ?? "",
        }))
      : [
          { left: "", right: "" },
          { left: "", right: "" },
        ];
    return {
      prompt: q.prompt,
      type,
      options,
      correctOptionIndex,
      correctOptionIndices,
      points: q.points ?? 1,
      explanation: q.explanation ?? "",
      blanks,
      pairs,
      minWords: typeof meta.minWords === "number" ? meta.minWords : null,
      maxWords: typeof meta.maxWords === "number" ? meta.maxWords : null,
    };
  });
}

export function validQuestionDrafts(questions: QuestionDraft[]): QuestionDraft[] {
  return questions.filter((q) => {
    if (!q.prompt.trim()) return false;
    if (q.type === "SHORT_ANSWER" || q.type === "ESSAY") return true;
    if (q.type === "FILL_BLANK") {
      return q.blanks.some((b) => b.acceptableAnswers.some((a) => a.trim()));
    }
    if (q.type === "MATCHING") {
      return q.pairs.filter((p) => p.left.trim() && p.right.trim()).length >= 2;
    }
    if (q.type === "TRUE_FALSE") return true;
    const opts = q.options.filter((o) => o.trim());
    if (opts.length < 2) return false;
    if (q.type === "MULTI_SELECT") return q.correctOptionIndices.length > 0;
    return true;
  });
}

export function draftsToApiPayload(questions: QuestionDraft[]) {
  return validQuestionDrafts(questions).map((q) => {
    const base = {
      prompt: q.prompt.trim(),
      type: q.type,
      ...(q.points !== 1 ? { points: q.points } : {}),
      ...(q.explanation.trim() ? { explanation: q.explanation.trim() } : {}),
    };
    if (q.type === "SHORT_ANSWER") return base;
    if (q.type === "ESSAY") {
      return {
        ...base,
        ...(q.minWords != null ? { minWords: q.minWords } : {}),
        ...(q.maxWords != null ? { maxWords: q.maxWords } : {}),
      };
    }
    if (q.type === "FILL_BLANK") {
      return {
        ...base,
        blanks: q.blanks
          .map((b) => ({
            acceptableAnswers: b.acceptableAnswers.map((a) => a.trim()).filter(Boolean),
          }))
          .filter((b) => b.acceptableAnswers.length > 0),
      };
    }
    if (q.type === "MATCHING") {
      return {
        ...base,
        pairs: q.pairs
          .map((p) => ({ left: p.left.trim(), right: p.right.trim() }))
          .filter((p) => p.left && p.right),
      };
    }
    if (q.type === "TRUE_FALSE") {
      return {
        ...base,
        options: ["True", "False"],
        correctOptionIndex: q.correctOptionIndex,
      };
    }
    const kept: string[] = [];
    const mappedMulti: number[] = [];
    let mappedIndex = 0;
    q.options.forEach((o, i) => {
      const text = o.trim();
      if (!text) return;
      if (q.correctOptionIndices.includes(i)) mappedMulti.push(kept.length);
      if (i === q.correctOptionIndex) mappedIndex = kept.length;
      kept.push(text);
    });
    if (q.type === "MULTI_SELECT") {
      return {
        ...base,
        options: kept,
        correctOptionIndices: mappedMulti,
      };
    }
    return {
      ...base,
      options: kept,
      correctOptionIndex: mappedIndex,
    };
  });
}
