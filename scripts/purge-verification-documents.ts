import { purgeVerificationDocuments } from "../src/server/services/employer-verification-service";
import {
  purgeEmployerDocumentsWithoutRecordedConsent,
  purgePhoneNumbersWithoutRecordedConsent,
} from "../src/server/services/legal-consent-service";

const [result, phoneNumbersDeleted, unconsentedEmployerDocumentsDeleted] = await Promise.all([
  purgeVerificationDocuments(),
  purgePhoneNumbersWithoutRecordedConsent(),
  purgeEmployerDocumentsWithoutRecordedConsent(),
]);

console.log(
  `[documents:purge] employer documents deleted: ${result.employerDocumentsDeleted}; ` +
    `disabled identity documents deleted: ${result.identityDocumentsDeleted}; ` +
    `disabled identity records deleted: ${result.identityRecordsDeleted}; ` +
    `phones without recorded consent deleted: ${phoneNumbersDeleted}; ` +
    `employer documents without recorded consent deleted: ${unconsentedEmployerDocumentsDeleted}`,
);
