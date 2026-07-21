export type QualityGateResult = {
  subject_present?: unknown;
  subject_type?: unknown;
  image_quality?: unknown;
  subject_size?: unknown;
  visible_features?: {
    head?: unknown;
    body?: unknown;
    fins_or_arms?: unknown;
    tail_or_mantle?: unknown;
  };
  quality_issues?: unknown;
  suggested_groups?: unknown;
  needs_retake?: unknown;
  note?: unknown;
};

export const MIN_IMAGE_QUALITY = 0.62;

const GROUP_NEIGHBORS: Record<string, string[]> = {
  rockfish: ["seabass_croaker", "bream"],
  seabass_croaker: ["rockfish", "bream"],
  bream: ["seabass_croaker", "coastal"],
  pelagic: ["coastal", "seabass_croaker"],
  coastal: ["pelagic", "seabass_croaker"],
  filefish: ["pufferfish", "coastal"],
  pufferfish: ["filefish", "coastal"],
  eel: ["coastal", "rockfish"],
  squid: ["octopus"],
  octopus: ["squid"],
};

export const getAdjacentGroups = (group: string) =>
  GROUP_NEIGHBORS[group] ?? [];

export const normalizeScore = (value: unknown) => {
  const score = typeof value === "number" ? value : Number(value);
  return Number.isFinite(score) ? Math.min(1, Math.max(0, score)) : 0;
};

export const expandSuggestedGroups = (
  suggestedGroups: string[],
  allowedGroups: Set<string>,
  limit = 3,
) => {
  const expanded: string[] = [];
  const append = (group: string) => {
    if (
      expanded.length < limit &&
      allowedGroups.has(group) &&
      !expanded.includes(group)
    ) {
      expanded.push(group);
    }
  };

  suggestedGroups.forEach(append);
  if (suggestedGroups.length === 1 && suggestedGroups[0] !== "flatfish") {
    getAdjacentGroups(suggestedGroups[0]).forEach(append);
  }
  return expanded;
};

export const normalizeQualityGate = (
  result: QualityGateResult,
  allowedGroups: Set<string>,
) => {
  const subjectPresent = result.subject_present === true;
  const subjectType =
    result.subject_type === "finfish" || result.subject_type === "cephalopod"
      ? result.subject_type
      : "other";
  const imageQuality = normalizeScore(result.image_quality);
  const subjectSize =
    result.subject_size === "large" ||
    result.subject_size === "medium" ||
    result.subject_size === "small" ||
    result.subject_size === "tiny"
      ? result.subject_size
      : "tiny";
  const qualityIssues = Array.isArray(result.quality_issues)
    ? result.quality_issues.filter(
        (issue): issue is string => typeof issue === "string",
      )
    : [];
  const visibleFeatures: NonNullable<QualityGateResult["visible_features"]> =
    result.visible_features ?? {};
  const visibleFeatureCount = [
    visibleFeatures.head,
    visibleFeatures.body,
    visibleFeatures.fins_or_arms,
    visibleFeatures.tail_or_mantle,
  ].filter((value) => value === true).length;
  const suggestedGroups = Array.isArray(result.suggested_groups)
    ? result.suggested_groups
        .filter(
          (group): group is string =>
            typeof group === "string" && allowedGroups.has(group),
        )
        .slice(0, 3)
    : [];
  const hardQualityFailure =
    subjectSize === "tiny" ||
    qualityIssues.includes("tiny_subject") ||
    qualityIssues.includes("pixelated");
  const missingRequiredAnatomy =
    subjectType === "finfish"
      ? visibleFeatures.head !== true || visibleFeatures.body !== true
      : subjectType === "cephalopod"
        ? visibleFeatures.body !== true || visibleFeatures.fins_or_arms !== true
        : true;
  const needsRetake =
    !subjectPresent ||
    subjectType === "other" ||
    imageQuality < MIN_IMAGE_QUALITY ||
    visibleFeatureCount < 2 ||
    missingRequiredAnatomy ||
    hardQualityFailure ||
    result.needs_retake === true;

  return {
    subjectPresent,
    subjectType,
    imageQuality,
    subjectSize,
    qualityIssues,
    visibleFeatureCount,
    suggestedGroups,
    needsRetake,
    note:
      typeof result.note === "string" && result.note.trim()
        ? result.note.trim()
        : "물고기의 측면 전체가 선명하게 보이도록 다시 촬영해 주세요.",
  };
};
