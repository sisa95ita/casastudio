import { HttpStatus } from "@nestjs/common";
import { ApiErrorCode } from "../../common/problem-details/api-error-code";
import { ApiProblemError } from "../../common/problem-details/problem-details-exception";

export function descendantsConflict() {
  return new ApiProblemError({
    type: "/problems/ai-proposal-has-descendants",
    title: "Proposal has derived revisions",
    status: HttpStatus.CONFLICT,
    code: ApiErrorCode.AiProposalHasDescendants,
    detail:
      "Delete leaf revisions first. A proposal with derived revisions cannot be deleted directly."
  });
}
