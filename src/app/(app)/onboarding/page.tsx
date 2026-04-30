import { Star, Zap } from "lucide-react";

import { BrandMark } from "@/components/layout/splash-frame";
import { RegistrationForm } from "@/components/profile/registration-form";

const features = [
  { icon: Zap, title: "Срочные смены", caption: "за 1 минуту" },
  { icon: Star, title: "Отзывы и рейтинг", caption: "проверенные люди" },
];

export default function OnboardingPage() {
  return (
    <div className="space-y-5">
      <section className="flex flex-col items-center px-2 pb-2 pt-6 text-center">
        <div
          className="rounded-[26px]"
          style={{ boxShadow: "0 18px 40px rgba(51,135,209,0.32)" }}
        >
          <BrandMark size={96} opacity={1} />
        </div>
        <h1 className="mt-[18px] text-[30px] font-semibold leading-[1.05] tracking-[-0.05em] text-[#101214]">
          Добро пожаловать
          <br />в Дублер
        </h1>
        <p className="mt-2 max-w-[280px] text-[14px] leading-6 text-[#7f8791]">
          Сервис подмен, смен и работы для ПВЗ Ozon, WB и Яндекс Маркета.
        </p>
      </section>

      <div className="grid grid-cols-2 gap-2.5">
        {features.map(({ icon: Icon, title, caption }) => (
          <div
            key={title}
            className="rounded-[18px] bg-white p-3.5 text-center shadow-[0_12px_28px_rgba(20,27,33,0.08)]"
          >
            <Icon className="mx-auto h-6 w-6 text-[#3387d1]" />
            <div className="mt-2 text-[13px] font-semibold text-[#101214]">{title}</div>
            <div className="mt-0.5 text-[11px] text-[#a6abb2]">{caption}</div>
          </div>
        ))}
      </div>

      <RegistrationForm mode="onboarding" />
    </div>
  );
}
