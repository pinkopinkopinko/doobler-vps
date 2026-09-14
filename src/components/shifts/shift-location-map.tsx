import Link from "next/link";
import { MapPin } from "lucide-react";

import { findNearestMetroStation } from "@/lib/geo/metro-stations";
import { formatCompactShiftAddress, formatShiftLocation } from "@/lib/utils";

type ShiftLocationMapProps = {
  cityName: string;
  district: string | null;
  address: string;
  lat?: number | null;
  lng?: number | null;
};

function buildYandexMapsUrl(params: ShiftLocationMapProps) {
  const query = formatShiftLocation(params.cityName, params.district, params.address);
  const url = new URL("https://yandex.ru/maps/");
  url.searchParams.set("text", query);

  if (params.lat && params.lng) {
    url.searchParams.set("ll", `${params.lng},${params.lat}`);
    url.searchParams.set("z", "16");
  }

  return url.toString();
}

function buildStaticMapUrl(params: Required<Pick<ShiftLocationMapProps, "lat" | "lng">>) {
  const url = new URL("https://static-maps.yandex.ru/1.x/");
  url.searchParams.set("ll", `${params.lng},${params.lat}`);
  url.searchParams.set("pt", `${params.lng},${params.lat},pm2rdm`);
  url.searchParams.set("z", "16");
  url.searchParams.set("size", "600,240");
  url.searchParams.set("l", "map");
  url.searchParams.set("lang", "ru_RU");

  return url.toString();
}

export function ShiftLocationMap({
  cityName,
  district,
  address,
  lat = null,
  lng = null,
}: ShiftLocationMapProps) {
  const hasCoords = typeof lat === "number" && typeof lng === "number";
  const nearestMetro = hasCoords
    ? findNearestMetroStation({
        cityName,
        lat,
        lng,
        maxDistanceMeters: 1_500,
      })
    : null;
  const compactAddress = formatCompactShiftAddress(cityName, district, address) || address;
  const locationLabel = [
    cityName,
    nearestMetro ? `м. ${nearestMetro.name}` : null,
    district,
    compactAddress,
  ]
    .filter(Boolean)
    .join(" · ");
  const yandexMapsUrl = buildYandexMapsUrl({ cityName, district, address, lat, lng });
  const staticMapUrl = hasCoords ? buildStaticMapUrl({ lat, lng }) : null;

  return (
    <section className="rounded-[32px] bg-white p-5 shadow-[0_12px_28px_rgba(20,27,33,0.08)]">
      <p className="text-[12px] font-medium uppercase tracking-[0.18em] text-[#a6abb2]">
        Где предстоит работать
      </p>
      <div className="mt-3 flex gap-2 text-[14px] leading-5 text-[#5f6975]">
        <span className="mt-[6px] h-2 w-2 shrink-0 rounded-full bg-[#df3447] shadow-[0_0_0_4px_rgba(223,52,71,0.10)]" />
        <span className="break-words [overflow-wrap:anywhere]">{locationLabel}</span>
      </div>

      <div className="shift-static-map mt-4" aria-label="Превью Яндекс.Карты с адресом ПВЗ">
        {staticMapUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={staticMapUrl} alt={locationLabel} className="h-full w-full object-cover" />
        ) : (
          <>
            <div className="shift-static-map__grid" />
            <div className="shift-static-map__road shift-static-map__road--one" />
            <div className="shift-static-map__road shift-static-map__road--two" />
            <div className="shift-static-map__road shift-static-map__road--three" />
            <div className="shift-static-map__pin" />
            <div className="shift-static-map__logo">Яндекс Карты</div>
          </>
        )}
      </div>

      <Link
        href={yandexMapsUrl}
        target="_blank"
        rel="noreferrer"
        className="mt-4 flex min-h-12 w-full items-center justify-center rounded-[18px] bg-[#3387d1] px-4 text-center text-[14px] font-semibold text-white"
      >
        Показать на большой карте
      </Link>

      {!hasCoords ? (
        <p className="mt-3 flex gap-2 text-[12px] leading-5 text-[#7f8791]">
          <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#3387d1]" />
          Координаты не найдены у этой смены. Пока карта открывается поиском по адресу.
        </p>
      ) : null}
    </section>
  );
}
