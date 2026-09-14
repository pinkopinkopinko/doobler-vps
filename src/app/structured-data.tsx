import type { ReactNode } from "react";

const SITE_URL = "https://doobler.ru";
const SITE_NAME = "Дублер";
const APP_URL = "https://t.me/doobler_bot";
const SUPPORT_URL = "https://t.me/dooblerhelp_bot";
const LOGO_URL = `${SITE_URL}/logo.png`;

type FaqEntry = { question: string; answer: string };

type StructuredDataProps = {
  faqItems: ReadonlyArray<FaqEntry>;
};

/**
 * JSON-LD structured data for the public homepage.
 *
 * Three schemas in one script tag (the recommended pattern):
 * - Organization (entity behind the site, used by Google Knowledge Panel and Yandex card)
 * - WebSite + potentialAction.SearchAction (sitelinks search box hint)
 * - FAQPage (rich snippet with expandable Q&A in SERP)
 *
 * IMPORTANT: the questions/answers passed in MUST match the visible <details>
 * blocks on the page exactly, otherwise Google flags it as deceptive markup.
 */
export function StructuredData({ faqItems }: StructuredDataProps): ReactNode {
  const json = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${SITE_URL}/#organization`,
        name: SITE_NAME,
        alternateName: ["Doobler", "Дублер ПВЗ"],
        url: SITE_URL,
        logo: {
          "@type": "ImageObject",
          url: LOGO_URL,
          width: 512,
          height: 512,
        },
        description:
          "Сервис для владельцев и сотрудников ПВЗ Ozon, Wildberries и Яндекс Маркета: замена сотрудника на смену, подработка в пункте выдачи, публикация вакансий.",
        sameAs: [APP_URL],
        contactPoint: [
          {
            "@type": "ContactPoint",
            contactType: "technical support",
            url: SUPPORT_URL,
            availableLanguage: ["Russian"],
          },
        ],
        areaServed: {
          "@type": "Country",
          name: "Россия",
        },
      },
      {
        "@type": "WebSite",
        "@id": `${SITE_URL}/#website`,
        url: SITE_URL,
        name: SITE_NAME,
        description:
          "Замены, подмены и вакансии в ПВЗ Ozon, Wildberries, Яндекс Маркета — приложение в Telegram.",
        inLanguage: "ru-RU",
        publisher: { "@id": `${SITE_URL}/#organization` },
      },
      {
        "@type": "FAQPage",
        "@id": `${SITE_URL}/#faq`,
        mainEntity: faqItems.map((item) => ({
          "@type": "Question",
          name: item.question,
          acceptedAnswer: {
            "@type": "Answer",
            text: item.answer,
          },
        })),
      },
    ],
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(json) }}
    />
  );
}
