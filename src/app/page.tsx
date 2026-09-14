import Image from "next/image";
import Link from "next/link";

import { CursorSpotlight } from "./cursor-spotlight";
import { HomeAnimations } from "./home-animations";
import { StructuredData } from "./structured-data";
import styles from "./page.module.css";

const APP_URL = "https://t.me/doobler_bot";
const SUPPORT_URL = "https://t.me/dooblerhelp_bot";
const INFO_CHANNEL_URL = "https://t.me/dooblerinfo";
const MAX_CHANNEL_URL = "https://max.ru/id163205081110_biz";

const problemItems = [
  "Срочную замену сотрудника ПВЗ ищут в чатах — заявка теряется, кандидаты пишут поздно, смена остаётся непокрытой.",
  "Условия по району, графику, опыту и оплате приходится повторять каждому соискателю вручную.",
  "Нет витрины вакансий для пунктов выдачи Ozon, Wildberries и Яндекс Маркета: владелец не видит свои публикации и активные отклики.",
];

const benefits = [
  {
    title: "Замена сотрудника ПВЗ за час",
    text: "Создаёте срочную смену с адресом, временем и оплатой — кандидаты с подтверждёнными профилями откликаются прямо в Telegram.",
  },
  {
    title: "Подмена и подработка на день",
    text: "Сотрудники ищут разовые смены в пунктах выдачи Ozon, WB и Яндекс Маркета, владельцы выбирают по рейтингу и опыту.",
  },
  {
    title: "Вакансии в ПВЗ без лишних шагов",
    text: "Опубликуйте смену или вакансию один раз — она попадает в ленту целевой аудитории работников ПВЗ в вашем городе и районе.",
  },
  {
    title: "Подтверждённые профили и отзывы",
    text: "Двусторонние отзывы, верификация номера телефона и проверка документов помогают отличить надёжного работника от случайного.",
  },
];

const channelNews = [
  {
    tag: "Обновления",
    title: "Что меняется в Дублере",
    text: "Публикуем короткие заметки о новых функциях, исправлениях и изменениях в приложении.",
  },
  {
    tag: "Инструкции",
    title: "Как быстрее закрывать смены",
    text: "Разбираем сценарии для владельцев, управляющих и сотрудников ПВЗ без лишней воды.",
  },
  {
    tag: "Анонсы",
    title: "Запуски и важные объявления",
    text: "Сообщаем о новых городах, правилах работы сервиса и полезных материалах для канала.",
  },
];

const faqItems = [
  {
    question: "Для кого сделан Дублер?",
    answer:
      "Для владельцев и управляющих пунктами выдачи Ozon, Wildberries и Яндекс Маркета, которым нужна быстрая замена сотрудника или подмена на смену, и для людей, которые ищут работу или подработку в ПВЗ на день.",
  },
  {
    question: "Как срочно найти замену сотруднику ПВЗ?",
    answer:
      "Откройте приложение, опубликуйте смену с адресом ПВЗ, временем и оплатой. Подходящие кандидаты в вашем городе видят объявление в ленте и откликаются за минуты. Дублер показывает рейтинг и опыт каждого претендента.",
  },
  {
    question: "Сколько стоит опубликовать смену или вакансию?",
    answer:
      "Сейчас публикация смен и вакансий в Дублере временно бесплатна. Сервис не удерживает оплату работникам — все расчёты по смене проходят напрямую между владельцем ПВЗ и сотрудником.",
  },
  {
    question: "Какие маркетплейсы и сети ПВЗ поддерживаются?",
    answer:
      "Дублер работает со сменами и вакансиями в пунктах выдачи Ozon, Wildberries (WB), Яндекс Маркета и других маркетплейсов. Сервис не аффилирован ни с одним из маркетплейсов и работает как независимая площадка.",
  },
  {
    question: "Как сотруднику найти подработку или вакансию в ПВЗ?",
    answer:
      "Откройте приложение через Telegram-бот, пройдите короткую регистрацию с подтверждением номера телефона и выберите свой город. В ленте появятся доступные смены и вакансии в ПВЗ рядом — откликайтесь на подходящие.",
  },
  {
    question: "Какие документы нужны для регистрации?",
    answer:
      "Для сотрудника достаточно подтверждённого номера телефона. Владелец или управляющий ПВЗ может загрузить документ о связи с пунктом выдачи, чтобы публиковать смены.",
  },
  {
    question: "Как открыть приложение?",
    answer:
      "Нажмите кнопку «Открыть приложение» в верхней части страницы или перейдите в Telegram-бота @doobler_bot — приложение работает прямо внутри Telegram, без установки.",
  },
  {
    question: "Куда обратиться по техническим вопросам?",
    answer:
      "Техническая поддержка Дублера принимает обращения через @dooblerhelp_bot. Опишите проблему, приложите скриншот при необходимости — оператор ответит в ближайшее рабочее время.",
  },
];

export default function HomePage() {
  return (
    <main className={styles.page} data-home-parallax-root>
      <StructuredData faqItems={faqItems} />
      <HomeAnimations />
      <CursorSpotlight
        selector={[
          `.${styles.problemGrid} > article`,
          `.${styles.benefitGrid} > article`,
          `.${styles.newsGrid} > article`,
          `.${styles.faqList} > details`,
          `.${styles.metrics} > article`,
        ].join(", ")}
      />
      <nav className={styles.siteNav} aria-label="Основная навигация">
        <Link className={styles.brand} href="/" aria-label="Дублер">
          <Image src="/logo.png" width={52} height={52} alt="" priority />
          <span>Дублер</span>
        </Link>

        <div className={styles.navLinks}>
          <a href="#problem">Проблема</a>
          <a href="#benefits">Плюсы</a>
          <a href="#news">Новости</a>
          <a href="#faq">FAQ</a>
          <a href="#contacts">Контакты</a>
        </div>

        <a className={styles.navButton} href={APP_URL} target="_blank" rel="noreferrer">
          Открыть приложение
        </a>
      </nav>

      <section className={styles.hero} aria-labelledby="hero-title">
        <div className={styles.heroCopy}>
          <p className={styles.kicker} data-animate-hero>Приложение для ПВЗ</p>
          <h1 id="hero-title">
            <span data-animate-hero>Закрывайте</span>
            <span data-animate-hero>смены без</span>
            <span data-animate-hero>хаоса в чатах</span>
          </h1>
          <p className={styles.lead} data-animate-hero>
            Дублер — приложение для владельцев и сотрудников пунктов выдачи Ozon, Wildberries
            и Яндекс Маркета. Публикуйте смены и вакансии, ищите замену на сегодня
            или находите подработку в ПВЗ рядом с домом.
          </p>
          <div className={styles.heroActions} data-animate-hero>
            <a className={styles.primaryButton} href={APP_URL} target="_blank" rel="noreferrer">
              Открыть приложение
            </a>
            <a className={styles.secondaryButton} href="#problem">
              Посмотреть сценарий
            </a>
          </div>
          <div className={styles.metrics} aria-label="Ключевые показатели сервиса" data-animate-hero>
            <article>
              <b>3 000 ₽</b>
              <span>пример оплаты смены в объявлении</span>
            </article>
            <article>
              <b>1%</b>
              <span>плановая стоимость публикации</span>
            </article>
          </div>
        </div>

        <div className={styles.previewWrap} data-animate-hero>
          <Image
            className={styles.phonePreviewImage}
            data-home-parallax-phone
            src="/hero_section_phone.webp"
            width={962}
            height={1280}
            alt="Экран приложения Дублер в телефоне"
            priority
            quality={100}
          />
        </div>
      </section>

      <section id="problem" className={styles.section} data-animate-section>
        <div className={styles.sectionIntro}>
          <span>Проблема</span>
          <h2>Почему искать замену сотрудника ПВЗ через чаты больше не работает</h2>
        </div>
        <div className={styles.problemGrid}>
          {problemItems.map((item, index) => (
            <article key={item} data-animate-item>
              <b>{String(index + 1).padStart(2, "0")}</b>
              <p>{item}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="benefits" className={styles.section} data-animate-section>
        <div className={styles.sectionIntro}>
          <span>Возможности Дублера</span>
          <h2>Замены, подмены и вакансии для пунктов выдачи Ozon, WB и Яндекс Маркета</h2>
        </div>
        <div className={styles.benefitGrid}>
          {benefits.map((benefit) => (
            <article key={benefit.title} data-animate-item>
              <h3>{benefit.title}</h3>
              <p>{benefit.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="news" className={styles.newsSection} data-animate-section>
        <div className={styles.newsHero}>
          <div>
            <span>Каналы</span>
            <h2>Новости Дублера в одном месте</h2>
            <p>
              В канале публикуем обновления сервиса, инструкции по работе со сменами и короткие
              анонсы для владельцев, управляющих и сотрудников ПВЗ.
            </p>
          </div>
          <div className={styles.newsActions}>
            <a className={`${styles.newsButton} ${styles.newsButtonTelegram}`} href={INFO_CHANNEL_URL} target="_blank" rel="noreferrer">
              Telegram
            </a>
            <a className={`${styles.newsButton} ${styles.newsButtonMax}`} href={MAX_CHANNEL_URL} target="_blank" rel="noreferrer">
              MAX
            </a>
          </div>
        </div>

        <div className={styles.newsGrid}>
          {channelNews.map((item) => (
            <article key={item.title} data-animate-item>
              <span>{item.tag}</span>
              <h3>{item.title}</h3>
              <p>{item.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className={styles.ctaSection} aria-labelledby="cta-title" data-animate-section>
        <div>
          <span>Готово к запуску</span>
          <h2 id="cta-title">Откройте приложение и создайте первую смену</h2>
          <p>Публичная страница знакомит с сервисом, а рабочий сценарий начинается в Telegram.</p>
        </div>
        <a className={styles.ctaButton} href={APP_URL} target="_blank" rel="noreferrer">
          Открыть приложение
        </a>
      </section>

      <section id="faq" className={styles.section} data-animate-section>
        <div className={styles.sectionIntro}>
          <span>FAQ</span>
          <h2>Частые вопросы о работе и подработке в ПВЗ</h2>
        </div>
        <div className={styles.faqList}>
          {faqItems.map((item) => (
            <details key={item.question} data-animate-item>
              <summary>{item.question}</summary>
              <p>{item.answer}</p>
            </details>
          ))}
        </div>
      </section>

      <footer id="contacts" className={styles.footer}>
        <div>
          <Image src="/logo.png" width={44} height={44} alt="Логотип Дублер" />
          <div>
            <b>Дублер</b>
            <p>Сервис для публикации смен и вакансий в ПВЗ.</p>
          </div>
        </div>
        <nav aria-label="Документы и контакты">
          <Link href="/offer">Оферта</Link>
          <Link href="/privacy">Политика конфиденциальности</Link>
          <a href={SUPPORT_URL} target="_blank" rel="noreferrer">
            Техподдержка @dooblerhelp_bot
          </a>
        </nav>
      </footer>
    </main>
  );
}
