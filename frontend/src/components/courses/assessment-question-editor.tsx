"use client";

import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { emptyQuestion, type QuestionDraft } from "@/lib/assessment-question-draft";

interface AssessmentQuestionEditorProps {
  questions: QuestionDraft[];
  onChange: (questions: QuestionDraft[]) => void;
}

export function AssessmentQuestionEditor({ questions, onChange }: AssessmentQuestionEditorProps) {
  function updateQuestion(index: number, patch: Partial<QuestionDraft>) {
    onChange(questions.map((q, i) => (i === index ? { ...q, ...patch } : q)));
  }

  function updateOption(qIndex: number, oIndex: number, value: string) {
    onChange(
      questions.map((q, i) =>
        i === qIndex
          ? { ...q, options: q.options.map((o, j) => (j === oIndex ? value : o)) }
          : q,
      ),
    );
  }

  return (
    <div className="space-y-4">
      {questions.map((q, qIdx) => (
        <div key={qIdx} className="space-y-3 rounded-lg border border-border p-4">
          <div className="flex items-center justify-between">
            <Label>Question {qIdx + 1}</Label>
            {questions.length > 1 && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => onChange(questions.filter((_, i) => i !== qIdx))}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
          <Input
            value={q.prompt}
            onChange={(e) => updateQuestion(qIdx, { prompt: e.target.value })}
            placeholder="Question prompt"
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Type</Label>
              <Select
                value={q.type}
                onValueChange={(v) =>
                  updateQuestion(qIdx, {
                    type: v as QuestionDraft["type"],
                    options: v === "TRUE_FALSE" ? ["True", "False"] : q.options.length ? q.options : ["", ""],
                    correctOptionIndex: 0,
                    correctOptionIndices: [],
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="MCQ">Multiple choice</SelectItem>
                  <SelectItem value="TRUE_FALSE">True / False</SelectItem>
                  <SelectItem value="MULTI_SELECT">Multi-select</SelectItem>
                  <SelectItem value="SHORT_ANSWER">Short answer</SelectItem>
                  <SelectItem value="ESSAY">Essay</SelectItem>
                  <SelectItem value="FILL_BLANK">Fill in the blank</SelectItem>
                  <SelectItem value="MATCHING">Matching</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Points</Label>
              <Input
                type="number"
                min={1}
                max={100}
                value={q.points}
                onChange={(e) => updateQuestion(qIdx, { points: Math.max(1, Number(e.target.value) || 1) })}
              />
            </div>
          </div>
          <Input
            value={q.explanation}
            onChange={(e) => updateQuestion(qIdx, { explanation: e.target.value })}
            placeholder="Explanation (optional, shown in review when allowed)"
          />

          {q.type !== "SHORT_ANSWER" &&
            q.type !== "TRUE_FALSE" &&
            q.type !== "ESSAY" &&
            q.type !== "FILL_BLANK" &&
            q.type !== "MATCHING" && (
            <>
              {q.options.map((opt, oIdx) => (
                <Input
                  key={oIdx}
                  value={opt}
                  onChange={(e) => updateOption(qIdx, oIdx, e.target.value)}
                  placeholder={`Option ${oIdx + 1}`}
                />
              ))}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => updateQuestion(qIdx, { options: [...q.options, ""] })}
              >
                Add option
              </Button>
            </>
          )}

          {q.type === "FILL_BLANK" && (
            <div className="space-y-3">
              {q.blanks.map((blank, bIdx) => (
                <div key={bIdx} className="space-y-2 rounded-md border p-3">
                  <Label>Blank {bIdx + 1} acceptable answers</Label>
                  {blank.acceptableAnswers.map((answer, aIdx) => (
                    <Input
                      key={aIdx}
                      value={answer}
                      onChange={(e) => {
                        const blanks = q.blanks.map((b, i) =>
                          i === bIdx
                            ? {
                                acceptableAnswers: b.acceptableAnswers.map((v, j) =>
                                  j === aIdx ? e.target.value : v,
                                ),
                              }
                            : b,
                        );
                        updateQuestion(qIdx, { blanks });
                      }}
                      placeholder="Acceptable answer"
                    />
                  ))}
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      const blanks = q.blanks.map((b, i) =>
                        i === bIdx ? { acceptableAnswers: [...b.acceptableAnswers, ""] } : b,
                      );
                      updateQuestion(qIdx, { blanks });
                    }}
                  >
                    Add acceptable answer
                  </Button>
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  updateQuestion(qIdx, {
                    blanks: [...q.blanks, { acceptableAnswers: [""] }],
                  })
                }
              >
                Add blank
              </Button>
            </div>
          )}

          {q.type === "MATCHING" && (
            <div className="space-y-2">
              {q.pairs.map((pair, pIdx) => (
                <div key={pIdx} className="grid gap-2 sm:grid-cols-2">
                  <Input
                    value={pair.left}
                    onChange={(e) => {
                      const pairs = q.pairs.map((p, i) => (i === pIdx ? { ...p, left: e.target.value } : p));
                      updateQuestion(qIdx, { pairs });
                    }}
                    placeholder="Left item"
                  />
                  <Input
                    value={pair.right}
                    onChange={(e) => {
                      const pairs = q.pairs.map((p, i) => (i === pIdx ? { ...p, right: e.target.value } : p));
                      updateQuestion(qIdx, { pairs });
                    }}
                    placeholder="Right match"
                  />
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => updateQuestion(qIdx, { pairs: [...q.pairs, { left: "", right: "" }] })}
              >
                Add pair
              </Button>
            </div>
          )}

          {q.type === "ESSAY" && (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Min words</Label>
                <Input
                  type="number"
                  min={1}
                  value={q.minWords ?? ""}
                  onChange={(e) =>
                    updateQuestion(qIdx, {
                      minWords: e.target.value ? Number(e.target.value) : null,
                    })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Max words</Label>
                <Input
                  type="number"
                  min={1}
                  value={q.maxWords ?? ""}
                  onChange={(e) =>
                    updateQuestion(qIdx, {
                      maxWords: e.target.value ? Number(e.target.value) : null,
                    })
                  }
                />
              </div>
            </div>
          )}

          {q.type === "TRUE_FALSE" && (
            <div className="space-y-2">
              <Label>Correct answer</Label>
              <Select
                value={String(q.correctOptionIndex)}
                onValueChange={(v) => updateQuestion(qIdx, { correctOptionIndex: Number(v) })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">True</SelectItem>
                  <SelectItem value="1">False</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
          {q.type === "MCQ" && (
            <div className="space-y-2">
              <Label>Correct option</Label>
              <Select
                value={String(q.correctOptionIndex)}
                onValueChange={(v) => updateQuestion(qIdx, { correctOptionIndex: Number(v) })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {q.options.map((opt, oIdx) => (
                    <SelectItem key={oIdx} value={String(oIdx)}>
                      {opt || `Option ${oIdx + 1}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          {q.type === "MULTI_SELECT" && (
            <div className="space-y-2">
              <Label>Correct options (select all that apply)</Label>
              {q.options.map((opt, oIdx) => (
                <label key={oIdx} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={q.correctOptionIndices.includes(oIdx)}
                    onChange={(e) => {
                      const next = e.target.checked
                        ? [...q.correctOptionIndices, oIdx]
                        : q.correctOptionIndices.filter((i) => i !== oIdx);
                      updateQuestion(qIdx, { correctOptionIndices: next.sort() });
                    }}
                  />
                  {opt || `Option ${oIdx + 1}`}
                </label>
              ))}
            </div>
          )}
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => onChange([...questions, emptyQuestion()])}
      >
        Add question
      </Button>
    </div>
  );
}
