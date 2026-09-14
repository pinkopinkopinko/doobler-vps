export const LEGAL_DOCUMENT_VERSIONS = {
  privacy: "privacy-2026-05-27-v2",
  offer: "offer-2026-06-01",
} as const;

export const CONSENT_PURPOSES = [
  "PERSONAL_DATA_PROCESSING",
  "PHONE_PROCESSING",
  "EMPLOYER_DOCUMENT_PROCESSING",
  "PUBLIC_PROFILE_DISTRIBUTION",
] as const;

export type ConsentPurpose = (typeof CONSENT_PURPOSES)[number];
export type LegalPurpose = ConsentPurpose | "OFFER_ACCEPTANCE";
export type LegalAction = "GRANTED" | "WITHDRAWN" | "ACCEPTED";

export const CONSENT_TEXT: Record<ConsentPurpose, string> = {
  PERSONAL_DATA_PROCESSING:
    "Я даю отдельное согласие на обработку данных моего профиля (имя, фамилия, возраст, фото, город, роль, опыт и выбранные маркетплейсы) для регистрации, ведения профиля и использования сервиса «Дублер». Сроки хранения и порядок отзыва указаны в Политике обработки персональных данных.",
  PHONE_PROCESSING:
    "Я даю согласие на обработку номера телефона, переданного через Telegram, для подтверждения профиля и связи в сервисе.",
  EMPLOYER_DOCUMENT_PROCESSING:
    "Я даю согласие на обработку загруженного документа ПВЗ для проверки права создавать смены. Документ удаляется не позднее чем через 30 дней после загрузки.",
  PUBLIC_PROFILE_DISTRIBUTION:
    "Я отдельно разрешаю показывать другим авторизованным пользователям сервиса «Дублер» данные моего рабочего профиля: имя, фото, город, роль, опыт, рейтинг, отзывы и показатель выхода на смены, только для поиска смен и сотрудников. Я понимаю, что без этого согласия создание профиля и регистрация в сервисе недоступны. Согласие можно отозвать; после отзыва публичный просмотр профиля закрывается.",
};

export const OFFER_ACCEPTANCE_TEXT =
  "Я принимаю условия публичной оферты сервиса Дублер.";
