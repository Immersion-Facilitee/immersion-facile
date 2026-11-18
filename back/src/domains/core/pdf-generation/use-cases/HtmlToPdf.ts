import {
  type ConnectedUserDomainJwtPayload,
  type ConventionDomainJwtPayload,
  errors,
  type HtmlToPdfRequest,
  htmlToPdfRequestSchema,
  sanitizeHtmlForPdf,
} from "shared";
import { useCaseBuilder } from "../../useCaseBuilder";
import type { PdfGeneratorGateway } from "../ports/PdfGeneratorGateway";

export type HtmlToPdf = ReturnType<typeof makeHtmlToPdf>;

export const makeHtmlToPdf = useCaseBuilder("HtmlToPdf")
  .notTransactional()
  .withInput<HtmlToPdfRequest>(htmlToPdfRequestSchema)
  .withOutput<string>()
  .withCurrentUser<ConventionDomainJwtPayload | ConnectedUserDomainJwtPayload>()
  .withDeps<{
    pdfGeneratorGateway: PdfGeneratorGateway;
    immersionFacileDomain: string;
  }>()
  .build(async ({ inputParams, deps, currentUser }) => {
    if (!currentUser) throw errors.user.unauthorized();
    const sanitizedHtmlContent = sanitizeHtmlForPdf(
      inputParams.htmlContent,
      deps.immersionFacileDomain,
    );
    return deps.pdfGeneratorGateway.make({
      ...inputParams,
      htmlContent: sanitizedHtmlContent,
    });
  });
