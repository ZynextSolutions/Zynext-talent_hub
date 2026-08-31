"use client";

import { useState } from "react";
import { Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useAddBankQuestion,
  useCreateQuestionBank,
  useDeleteBankQuestion,
  useDeleteQuestionBank,
  useQuestionBank,
  useQuestionBanks,
  useUpdateQuestionBank,
} from "@/hooks/useQuestionBanks";

import { useAuth } from "@/hooks/useAuth";

type QuestionType = "MCQ" | "TRUE_FALSE" | "MULTI_SELECT" | "SHORT_ANSWER";

function compactOptions(options: string[], correctIndex: number) {
  const kept: string[] = [];
  let mapped = 0;
  options.forEach((opt, i) => {
    const text = opt.trim();
    if (!text) return;
    if (i === correctIndex) mapped = kept.length;
    kept.push(text);
  });
  return { options: kept, correctOptionIndex: mapped };
}

function compactMultiOptions(options: string[], indices: number[]) {
  const kept: string[] = [];
  const mapped: number[] = [];
  options.forEach((opt, i) => {
    const text = opt.trim();
    if (!text) return;
    if (indices.includes(i)) mapped.push(kept.length);
    kept.push(text);
  });
  return { options: kept, correctOptionIndices: mapped };
}

export default function QuestionBanksPage() {
  const { hasPermission } = useAuth();
  const canWrite = hasPermission("question-bank:write");
  const { data: banks, isLoading } = useQuestionBanks();
  const createBank = useCreateQuestionBank();
  const updateBank = useUpdateQuestionBank();
  const deleteBank = useDeleteQuestionBank();
  const [selectedId, setSelectedId] = useState<string>("");
  const selected = selectedId || banks?.[0]?.id || "";
  const { data: bankDetail, isLoading: detailLoading } = useQuestionBank(selected);
  const addQuestion = useAddBankQuestion(selected);
  const deleteQuestion = useDeleteBankQuestion(selected);

  const [bankOpen, setBankOpen] = useState(false);
  const [editBankOpen, setEditBankOpen] = useState(false);
  const [createBankName, setCreateBankName] = useState("");
  const [bankName, setBankName] = useState("");
  const [bankDescription, setBankDescription] = useState("");
  const [questionText, setQuestionText] = useState("");
  const [qType, setQType] = useState<QuestionType>("MCQ");
  const [options, setOptions] = useState(["", ""]);
  const [correctIndex, setCorrectIndex] = useState("0");
  const [correctIndices, setCorrectIndices] = useState<number[]>([]);

  function resetQuestionForm() {
    setQuestionText("");
    setQType("MCQ");
    setOptions(["", ""]);
    setCorrectIndex("0");
    setCorrectIndices([]);
  }

  return (
    <div className="flex flex-1 flex-col overflow-auto">
      <PageHeader
        title="Question banks"
        description="Reusable question pools for randomized assessments."
        actions={
          canWrite ? (
          <Dialog open={bankOpen} onOpenChange={setBankOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="mr-2 h-4 w-4" />
                New bank
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create question bank</DialogTitle>
              </DialogHeader>
              <div className="space-y-2 py-2">
                <Label>Name</Label>
                <Input value={createBankName} onChange={(e) => setCreateBankName(e.target.value)} />
              </div>
              <DialogFooter>
                <Button
                  onClick={async () => {
                    const bank = await createBank.mutateAsync({ name: createBankName.trim() });
                    setBankOpen(false);
                    setCreateBankName("");
                    setSelectedId(bank.id);
                  }}
                  disabled={!createBankName.trim() || createBank.isPending}
                >
                  Create
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          ) : undefined
        }
      />

      <div className="mx-auto grid w-full max-w-6xl flex-1 gap-6 px-6 py-8 lg:grid-cols-3">
        <Card className="shadow-luxury lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-base">Banks</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {isLoading ? (
              <Skeleton className="h-24 w-full" />
            ) : banks?.length ? (
              banks.map((b) => (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => setSelectedId(b.id)}
                  className={`w-full rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
                    selected === b.id ? "border-indigo bg-indigo/10" : "border-border"
                  }`}
                >
                  <p className="font-medium">{b.name}</p>
                  <p className="text-muted-foreground text-xs">{b.questionCount} questions</p>
                </button>
              ))
            ) : (
              <p className="text-muted-foreground text-sm">No question banks yet.</p>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-luxury lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between gap-4">
            <CardTitle className="text-base">{bankDetail?.name ?? "Questions"}</CardTitle>
            {selected && bankDetail && canWrite && (
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setBankName(bankDetail.name);
                    setBankDescription(bankDetail.description ?? "");
                    setEditBankOpen(true);
                  }}
                >
                  <Pencil className="mr-2 h-4 w-4" />
                  Edit bank
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="text-destructive"
                  onClick={() => {
                    if (confirm("Delete this question bank?")) {
                      deleteBank.mutate(selected, {
                        onSuccess: () => setSelectedId(""),
                      });
                    }
                  }}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </Button>
              </div>
            )}
          </CardHeader>
          <CardContent className="space-y-4">
            {detailLoading ? (
              <Skeleton className="h-32 w-full" />
            ) : (
              <>
                {bankDetail?.questions?.map((q) => (
                  <div key={q.id} className="flex items-start justify-between gap-3 rounded-lg border border-border p-3 text-sm">
                    <div>
                      <p className="font-medium">{q.question}</p>
                      <p className="text-muted-foreground text-xs">{q.type}</p>
                    </div>
                    {canWrite && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive shrink-0"
                      onClick={() => {
                        if (confirm("Remove this question?")) deleteQuestion.mutate(q.id);
                      }}
                    >
                      Remove
                    </Button>
                    )}
                  </div>
                ))}
                {selected && canWrite && (
                  <div className="space-y-3 rounded-lg border border-dashed border-border p-4">
                    <Label>Add question</Label>
                    <Select value={qType} onValueChange={(v) => setQType(v as QuestionType)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="MCQ">Multiple choice</SelectItem>
                        <SelectItem value="TRUE_FALSE">True / False</SelectItem>
                        <SelectItem value="MULTI_SELECT">Multi-select</SelectItem>
                        <SelectItem value="SHORT_ANSWER">Short answer</SelectItem>
                      </SelectContent>
                    </Select>
                    <Input
                      value={questionText}
                      onChange={(e) => setQuestionText(e.target.value)}
                      placeholder="Question text"
                    />
                    {(qType === "MCQ" || qType === "MULTI_SELECT") && (
                      <>
                        {options.map((opt, idx) => (
                          <Input
                            key={idx}
                            value={opt}
                            onChange={(e) =>
                              setOptions((prev) => prev.map((o, i) => (i === idx ? e.target.value : o)))
                            }
                            placeholder={`Option ${idx + 1}`}
                          />
                        ))}
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setOptions((prev) => [...prev, ""])}
                        >
                          Add option
                        </Button>
                      </>
                    )}
                    {qType === "MCQ" && (
                      <Select value={correctIndex} onValueChange={setCorrectIndex}>
                        <SelectTrigger>
                          <SelectValue placeholder="Correct option" />
                        </SelectTrigger>
                        <SelectContent>
                          {options.map((opt, idx) => (
                            <SelectItem key={idx} value={String(idx)}>
                              {opt || `Option ${idx + 1}`}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                    {qType === "TRUE_FALSE" && (
                      <Select value={correctIndex} onValueChange={setCorrectIndex}>
                        <SelectTrigger>
                          <SelectValue placeholder="Correct answer" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="0">True</SelectItem>
                          <SelectItem value="1">False</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                    {qType === "MULTI_SELECT" && (
                      <div className="space-y-2">
                        <Label>Correct options</Label>
                        {options.map((opt, idx) => (
                          <label key={idx} className="flex items-center gap-2 text-sm">
                            <input
                              type="checkbox"
                              checked={correctIndices.includes(idx)}
                              onChange={(e) => {
                                setCorrectIndices((prev) =>
                                  e.target.checked
                                    ? [...prev, idx].sort()
                                    : prev.filter((i) => i !== idx),
                                );
                              }}
                            />
                            {opt || `Option ${idx + 1}`}
                          </label>
                        ))}
                      </div>
                    )}
                    <Button
                      size="sm"
                      disabled={!questionText.trim() || addQuestion.isPending}
                      onClick={async () => {
                        const body: Parameters<typeof addQuestion.mutate>[0] = {
                          question: questionText.trim(),
                          type: qType,
                        };
                        if (qType === "MCQ") {
                          const compacted = compactOptions(options, Number(correctIndex));
                          body.options = compacted.options;
                          body.correctOptionIndex = compacted.correctOptionIndex;
                        } else if (qType === "TRUE_FALSE") {
                          body.correctOptionIndex = Number(correctIndex);
                        } else if (qType === "MULTI_SELECT") {
                          const compacted = compactMultiOptions(options, correctIndices);
                          body.options = compacted.options;
                          body.correctOptionIndices = compacted.correctOptionIndices;
                        }
                        await addQuestion.mutateAsync(body);
                        resetQuestionForm();
                      }}
                    >
                      {addQuestion.isPending ? <Loader2 className="animate-spin" /> : "Add question"}
                    </Button>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={editBankOpen} onOpenChange={setEditBankOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit question bank</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input value={bankName} onChange={(e) => setBankName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Input value={bankDescription} onChange={(e) => setBankDescription(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button
              onClick={async () => {
                await updateBank.mutateAsync({
                  id: selected,
                  name: bankName.trim(),
                  description: bankDescription.trim() || undefined,
                });
                setEditBankOpen(false);
              }}
              disabled={!bankName.trim() || updateBank.isPending}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
