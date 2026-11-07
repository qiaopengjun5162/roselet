import { recommend, validate_plant_input } from "../pkg/roselet_recommend.js";

export interface ReflectionInput {
  color: "red" | "white" | "yellow";
  gratitude?: string | null;
  anxiety?: string | null;
  hope?: string | null;
}

export interface CleanedReflectionInput extends ReflectionInput {
  gratitude?: string;
  anxiety?: string;
  hope?: string;
}

interface ValidationResult {
  valid: boolean;
  error?: unknown;
  cleaned?: CleanedReflectionInput;
}

export interface ReflectionResult {
  input: CleanedReflectionInput;
  recommendation: {
    flower_language: { title: string; content: string; keywords: string[] };
    theme: { title: string; content: string; category: string };
    color_suggestion: { color: string; reason: string };
  };
}

export class InvalidReflectionInput extends Error {
  constructor(readonly code: unknown) {
    super(typeof code === "string" ? code : JSON.stringify(code));
  }
}

export function validateReflectionInput(input: unknown): CleanedReflectionInput {
  const inputJson = JSON.stringify(input);
  const validation = validate_plant_input(inputJson) as ValidationResult;
  if (!validation.valid || !validation.cleaned) {
    throw new InvalidReflectionInput(validation.error || "invalid_reflection_input");
  }

  return validation.cleaned;
}

export function generateReflectionFromCleanedInput(
  input: CleanedReflectionInput,
): ReflectionResult {
  return {
    input,
    recommendation: recommend(JSON.stringify([input])) as ReflectionResult["recommendation"],
  };
}

export function generateReflection(input: unknown): ReflectionResult {
  return generateReflectionFromCleanedInput(validateReflectionInput(input));
}
