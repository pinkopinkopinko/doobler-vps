export type MetroStation = {
  citySlug: string;
  cityName: string;
  name: string;
  lat: number;
  lng: number;
  osmType: "node" | "way" | "relation";
  osmId: number;
};

export type NearbyMetroStation = MetroStation & {
  distanceMeters: number;
};

// Source: OpenStreetMap contributors via Overpass API (https://www.openstreetmap.org/copyright).
// Keep this as a local snapshot so the app can resolve nearest metro stations
// without hitting a third-party API during every shift/profile render.
export const METRO_STATIONS: MetroStation[] = [
  {
    "citySlug": "ekaterinburg",
    "cityName": "Екатеринбург",
    "name": "Ботаническая",
    "lat": 56.797441,
    "lng": 60.631543,
    "osmType": "node",
    "osmId": 10601241572
  },
  {
    "citySlug": "ekaterinburg",
    "cityName": "Екатеринбург",
    "name": "Геологическая",
    "lat": 56.827831,
    "lng": 60.602239,
    "osmType": "node",
    "osmId": 10601241537
  },
  {
    "citySlug": "ekaterinburg",
    "cityName": "Екатеринбург",
    "name": "Динамо",
    "lat": 56.847612,
    "lng": 60.59931,
    "osmType": "node",
    "osmId": 10601241519
  },
  {
    "citySlug": "ekaterinburg",
    "cityName": "Екатеринбург",
    "name": "Машиностроителей",
    "lat": 56.877011,
    "lng": 60.61166,
    "osmType": "node",
    "osmId": 10601237298
  },
  {
    "citySlug": "ekaterinburg",
    "cityName": "Екатеринбург",
    "name": "Площадь 1905 года",
    "lat": 56.836868,
    "lng": 60.599164,
    "osmType": "node",
    "osmId": 10606433480
  },
  {
    "citySlug": "ekaterinburg",
    "cityName": "Екатеринбург",
    "name": "Проспект Космонавтов",
    "lat": 56.901392,
    "lng": 60.613998,
    "osmType": "node",
    "osmId": 297004188
  },
  {
    "citySlug": "ekaterinburg",
    "cityName": "Екатеринбург",
    "name": "Уралмаш",
    "lat": 56.888256,
    "lng": 60.613498,
    "osmType": "node",
    "osmId": 10601237275
  },
  {
    "citySlug": "ekaterinburg",
    "cityName": "Екатеринбург",
    "name": "Уральская",
    "lat": 56.857471,
    "lng": 60.600381,
    "osmType": "node",
    "osmId": 10601241511
  },
  {
    "citySlug": "ekaterinburg",
    "cityName": "Екатеринбург",
    "name": "Чкаловская",
    "lat": 56.807699,
    "lng": 60.610299,
    "osmType": "node",
    "osmId": 10601241558
  },
  {
    "citySlug": "kazan",
    "cityName": "Казань",
    "name": "Авиастроительная",
    "lat": 55.855629,
    "lng": 49.084604,
    "osmType": "node",
    "osmId": 9022339000
  },
  {
    "citySlug": "kazan",
    "cityName": "Казань",
    "name": "Аметьево",
    "lat": 55.765121,
    "lng": 49.166528,
    "osmType": "node",
    "osmId": 9022338987
  },
  {
    "citySlug": "kazan",
    "cityName": "Казань",
    "name": "Горки",
    "lat": 55.760181,
    "lng": 49.190965,
    "osmType": "node",
    "osmId": 9017835958
  },
  {
    "citySlug": "kazan",
    "cityName": "Казань",
    "name": "Дубравная",
    "lat": 55.743742,
    "lng": 49.219001,
    "osmType": "node",
    "osmId": 5868304044
  },
  {
    "citySlug": "kazan",
    "cityName": "Казань",
    "name": "Козья слобода",
    "lat": 55.816553,
    "lng": 49.098417,
    "osmType": "node",
    "osmId": 9022339007
  },
  {
    "citySlug": "kazan",
    "cityName": "Казань",
    "name": "Кремлёвская",
    "lat": 55.795177,
    "lng": 49.107009,
    "osmType": "node",
    "osmId": 9022338990
  },
  {
    "citySlug": "kazan",
    "cityName": "Казань",
    "name": "Площадь Габдуллы Тукая",
    "lat": 55.785591,
    "lng": 49.12496,
    "osmType": "node",
    "osmId": 9022338989
  },
  {
    "citySlug": "kazan",
    "cityName": "Казань",
    "name": "Проспект Победы",
    "lat": 55.749958,
    "lng": 49.208593,
    "osmType": "node",
    "osmId": 9022338986
  },
  {
    "citySlug": "kazan",
    "cityName": "Казань",
    "name": "Северный вокзал",
    "lat": 55.841988,
    "lng": 49.082224,
    "osmType": "node",
    "osmId": 9022338995
  },
  {
    "citySlug": "kazan",
    "cityName": "Казань",
    "name": "Суконная слобода",
    "lat": 55.776977,
    "lng": 49.142576,
    "osmType": "node",
    "osmId": 9022338988
  },
  {
    "citySlug": "kazan",
    "cityName": "Казань",
    "name": "Яшьлек",
    "lat": 55.828142,
    "lng": 49.082598,
    "osmType": "node",
    "osmId": 9017835957
  },
  {
    "citySlug": "moskva",
    "cityName": "Москва",
    "name": "Авиамоторная",
    "lat": 55.753927,
    "lng": 37.718992,
    "osmType": "node",
    "osmId": 7340764980
  },
  {
    "citySlug": "moskva",
    "cityName": "Москва",
    "name": "Автозаводская",
    "lat": 55.707345,
    "lng": 37.657768,
    "osmType": "node",
    "osmId": 292146578
  },
  {
    "citySlug": "moskva",
    "cityName": "Москва",
    "name": "Академическая",
    "lat": 55.686945,
    "lng": 37.575983,
    "osmType": "node",
    "osmId": 13141822043
  },
  {
    "citySlug": "moskva",
    "cityName": "Москва",
    "name": "Александровский сад",
    "lat": 55.752403,
    "lng": 37.608683,
    "osmType": "node",
    "osmId": 253228506
  },
  {
    "citySlug": "moskva",
    "cityName": "Москва",
    "name": "Алексеевская",
    "lat": 55.809089,
    "lng": 37.639006,
    "osmType": "node",
    "osmId": 5202107562
  },
  {
    "citySlug": "moskva",
    "cityName": "Москва",
    "name": "Алма-Атинская",
    "lat": 55.632799,
    "lng": 37.765935,
    "osmType": "node",
    "osmId": 2080924763
  },
  {
    "citySlug": "moskva",
    "cityName": "Москва",
    "name": "Алтуфьево",
    "lat": 55.897922,
    "lng": 37.587358,
    "osmType": "node",
    "osmId": 296957238
  },
  {
    "citySlug": "moskva",
    "cityName": "Москва",
    "name": "Аминьевская",
    "lat": 55.697175,
    "lng": 37.46497,
    "osmType": "node",
    "osmId": 9315693031
  },
  {
    "citySlug": "moskva",
    "cityName": "Москва",
    "name": "Аннино",
    "lat": 55.582532,
    "lng": 37.596531,
    "osmType": "node",
    "osmId": 296953140
  },
  {
    "citySlug": "moskva",
    "cityName": "Москва",
    "name": "Арбатская",
    "lat": 55.751852,
    "lng": 37.600657,
    "osmType": "node",
    "osmId": 253043175
  },
  {
    "citySlug": "moskva",
    "cityName": "Москва",
    "name": "Аэропорт",
    "lat": 55.800397,
    "lng": 37.53315,
    "osmType": "node",
    "osmId": 266835847
  },
  {
    "citySlug": "moskva",
    "cityName": "Москва",
    "name": "Бабушкинская",
    "lat": 55.869634,
    "lng": 37.66411,
    "osmType": "node",
    "osmId": 60660469
  },
  {
    "citySlug": "moskva",
    "cityName": "Москва",
    "name": "Багратионовская",
    "lat": 55.743732,
    "lng": 37.497737,
    "osmType": "node",
    "osmId": 241158281
  },
  {
    "citySlug": "moskva",
    "cityName": "Москва",
    "name": "Баррикадная",
    "lat": 55.761131,
    "lng": 37.579309,
    "osmType": "node",
    "osmId": 296959510
  },
  {
    "citySlug": "moskva",
    "cityName": "Москва",
    "name": "Бауманская",
    "lat": 55.773039,
    "lng": 37.680549,
    "osmType": "node",
    "osmId": 242546356
  },
  {
    "citySlug": "moskva",
    "cityName": "Москва",
    "name": "Беговая",
    "lat": 55.773716,
    "lng": 37.546656,
    "osmType": "node",
    "osmId": 296959508
  },
  {
    "citySlug": "moskva",
    "cityName": "Москва",
    "name": "Беломорская",
    "lat": 55.864964,
    "lng": 37.474877,
    "osmType": "node",
    "osmId": 6147634222
  },
  {
    "citySlug": "moskva",
    "cityName": "Москва",
    "name": "Белорусская",
    "lat": 55.776138,
    "lng": 37.584068,
    "osmType": "node",
    "osmId": 1158396469
  },
  {
    "citySlug": "moskva",
    "cityName": "Москва",
    "name": "Беляево",
    "lat": 55.642777,
    "lng": 37.52568,
    "osmType": "node",
    "osmId": 282416839
  },
  {
    "citySlug": "moskva",
    "cityName": "Москва",
    "name": "Бибирево",
    "lat": 55.883871,
    "lng": 37.603554,
    "osmType": "node",
    "osmId": 296957239
  },
  {
    "citySlug": "moskva",
    "cityName": "Москва",
    "name": "Библиотека имени Ленина",
    "lat": 55.751232,
    "lng": 37.610171,
    "osmType": "node",
    "osmId": 278692958
  },
  {
    "citySlug": "moskva",
    "cityName": "Москва",
    "name": "Битцевский парк",
    "lat": 55.600239,
    "lng": 37.556379,
    "osmType": "node",
    "osmId": 2591402980
  },
  {
    "citySlug": "moskva",
    "cityName": "Москва",
    "name": "Борисово",
    "lat": 55.633304,
    "lng": 37.743752,
    "osmType": "node",
    "osmId": 1527999919
  },
  {
    "citySlug": "moskva",
    "cityName": "Москва",
    "name": "Боровицкая",
    "lat": 55.750972,
    "lng": 37.607057,
    "osmType": "node",
    "osmId": 296953128
  },
  {
    "citySlug": "moskva",
    "cityName": "Москва",
    "name": "Боровское шоссе",
    "lat": 55.647751,
    "lng": 37.370423,
    "osmType": "node",
    "osmId": 5868122988
  },
  {
    "citySlug": "moskva",
    "cityName": "Москва",
    "name": "Ботанический сад",
    "lat": 55.844845,
    "lng": 37.638246,
    "osmType": "node",
    "osmId": 268521591
  },
  {
    "citySlug": "moskva",
    "cityName": "Москва",
    "name": "Братиславская",
    "lat": 55.659739,
    "lng": 37.750669,
    "osmType": "node",
    "osmId": 333159878
  },
  {
    "citySlug": "moskva",
    "cityName": "Москва",
    "name": "Бульвар Адмирала Ушакова",
    "lat": 55.545434,
    "lng": 37.543211,
    "osmType": "node",
    "osmId": 296932668
  },
  {
    "citySlug": "moskva",
    "cityName": "Москва",
    "name": "Бульвар Дмитрия Донского",
    "lat": 55.569245,
    "lng": 37.576869,
    "osmType": "node",
    "osmId": 309741697
  },
  {
    "citySlug": "moskva",
    "cityName": "Москва",
    "name": "Бульвар Рокоссовского",
    "lat": 55.814682,
    "lng": 37.73434,
    "osmType": "node",
    "osmId": 265949954
  },
  {
    "citySlug": "moskva",
    "cityName": "Москва",
    "name": "Бунинская аллея",
    "lat": 55.538147,
    "lng": 37.516547,
    "osmType": "node",
    "osmId": 296932673
  },
  {
    "citySlug": "moskva",
    "cityName": "Москва",
    "name": "Бутырская",
    "lat": 55.813373,
    "lng": 37.602528,
    "osmType": "node",
    "osmId": 4847996860
  },
  {
    "citySlug": "moskva",
    "cityName": "Москва",
    "name": "Вавиловская",
    "lat": 55.684891,
    "lng": 37.540894,
    "osmType": "node",
    "osmId": 13143504742
  },
  {
    "citySlug": "moskva",
    "cityName": "Москва",
    "name": "Варшавская",
    "lat": 55.653334,
    "lng": 37.619502,
    "osmType": "node",
    "osmId": 10702113003
  },
  {
    "citySlug": "moskva",
    "cityName": "Москва",
    "name": "ВДНХ",
    "lat": 55.820955,
    "lng": 37.641201,
    "osmType": "node",
    "osmId": 5202107574
  },
  {
    "citySlug": "moskva",
    "cityName": "Москва",
    "name": "Верхние Лихоборы",
    "lat": 55.856113,
    "lng": 37.561344,
    "osmType": "node",
    "osmId": 5482407019
  },
  {
    "citySlug": "moskva",
    "cityName": "Москва",
    "name": "Владыкино",
    "lat": 55.847181,
    "lng": 37.589912,
    "osmType": "node",
    "osmId": 297291268
  },
  {
    "citySlug": "moskva",
    "cityName": "Москва",
    "name": "Водный стадион",
    "lat": 55.840059,
    "lng": 37.486711,
    "osmType": "node",
    "osmId": 266835844
  },
  {
    "citySlug": "moskva",
    "cityName": "Москва",
    "name": "Войковская",
    "lat": 55.819052,
    "lng": 37.498018,
    "osmType": "node",
    "osmId": 266835845
  },
  {
    "citySlug": "moskva",
    "cityName": "Москва",
    "name": "Волгоградский проспект",
    "lat": 55.725239,
    "lng": 37.686891,
    "osmType": "node",
    "osmId": 253016892
  },
  {
    "citySlug": "moskva",
    "cityName": "Москва",
    "name": "Волжская",
    "lat": 55.690826,
    "lng": 37.753101,
    "osmType": "node",
    "osmId": 296949283
  },
  {
    "citySlug": "moskva",
    "cityName": "Москва",
    "name": "Волоколамская",
    "lat": 55.835513,
    "lng": 37.382242,
    "osmType": "node",
    "osmId": 5202107568
  },
  {
    "citySlug": "moskva",
    "cityName": "Москва",
    "name": "Воробьёвы горы",
    "lat": 55.710332,
    "lng": 37.559289,
    "osmType": "node",
    "osmId": 297335182
  },
  {
    "citySlug": "moskva",
    "cityName": "Москва",
    "name": "Воронцовская",
    "lat": 55.658835,
    "lng": 37.539479,
    "osmType": "node",
    "osmId": 9315693019
  },
  {
    "citySlug": "moskva",
    "cityName": "Москва",
    "name": "Выхино",
    "lat": 55.715644,
    "lng": 37.817923,
    "osmType": "node",
    "osmId": 253016895
  },
  {
    "citySlug": "moskva",
    "cityName": "Москва",
    "name": "Генерала Тюленева",
    "lat": 55.626205,
    "lng": 37.485771,
    "osmType": "node",
    "osmId": 12163102808
  },
  {
    "citySlug": "moskva",
    "cityName": "Москва",
    "name": "Говорово",
    "lat": 55.659552,
    "lng": 37.417239,
    "osmType": "node",
    "osmId": 5868122990
  },
  {
    "citySlug": "moskva",
    "cityName": "Москва",
    "name": "Давыдково",
    "lat": 55.715144,
    "lng": 37.451743,
    "osmType": "node",
    "osmId": 9315693034
  },
  {
    "citySlug": "moskva",
    "cityName": "Москва",
    "name": "Деловой центр",
    "lat": 55.749114,
    "lng": 37.539179,
    "osmType": "node",
    "osmId": 3226428878
  },
  {
    "citySlug": "moskva",
    "cityName": "Москва",
    "name": "Динамо",
    "lat": 55.78974,
    "lng": 37.558208,
    "osmType": "node",
    "osmId": 266835848
  },
  {
    "citySlug": "moskva",
    "cityName": "Москва",
    "name": "Дмитровская",
    "lat": 55.806561,
    "lng": 37.581907,
    "osmType": "node",
    "osmId": 296956168
  },
  {
    "citySlug": "moskva",
    "cityName": "Москва",
    "name": "Добрынинская",
    "lat": 55.729107,
    "lng": 37.62442,
    "osmType": "node",
    "osmId": 294024698
  },
  {
    "citySlug": "moskva",
    "cityName": "Москва",
    "name": "Домодедовская",
    "lat": 55.610855,
    "lng": 37.718741,
    "osmType": "node",
    "osmId": 305486163
  },
  {
    "citySlug": "moskva",
    "cityName": "Москва",
    "name": "Достоевская",
    "lat": 55.781461,
    "lng": 37.615074,
    "osmType": "node",
    "osmId": 773136972
  },
  {
    "citySlug": "moskva",
    "cityName": "Москва",
    "name": "Дубровка",
    "lat": 55.719209,
    "lng": 37.675541,
    "osmType": "node",
    "osmId": 296947185
  },
  {
    "citySlug": "moskva",
    "cityName": "Москва",
    "name": "Жулебино",
    "lat": 55.685438,
    "lng": 37.856294,
    "osmType": "node",
    "osmId": 2525101862
  },
  {
    "citySlug": "moskva",
    "cityName": "Москва",
    "name": "ЗИЛ",
    "lat": 55.696934,
    "lng": 37.645235,
    "osmType": "node",
    "osmId": 13141233387
  },
  {
    "citySlug": "moskva",
    "cityName": "Москва",
    "name": "Зюзино",
    "lat": 55.655778,
    "lng": 37.573552,
    "osmType": "node",
    "osmId": 9315693017
  },
  {
    "citySlug": "moskva",
    "cityName": "Москва",
    "name": "Зябликово",
    "lat": 55.612235,
    "lng": 37.745179,
    "osmType": "node",
    "osmId": 1527999927
  },
  {
    "citySlug": "moskva",
    "cityName": "Москва",
    "name": "Измайловская",
    "lat": 55.787733,
    "lng": 37.781602,
    "osmType": "node",
    "osmId": 2692857848
  },
  {
    "citySlug": "moskva",
    "cityName": "Москва",
    "name": "Калужская",
    "lat": 55.657091,
    "lng": 37.540526,
    "osmType": "node",
    "osmId": 259786804
  },
  {
    "citySlug": "moskva",
    "cityName": "Москва",
    "name": "Кантемировская",
    "lat": 55.635735,
    "lng": 37.656541,
    "osmType": "node",
    "osmId": 308993566
  },
  {
    "citySlug": "moskva",
    "cityName": "Москва",
    "name": "Каховская",
    "lat": 55.652903,
    "lng": 37.598429,
    "osmType": "node",
    "osmId": 314679443
  },
  {
    "citySlug": "moskva",
    "cityName": "Москва",
    "name": "Каширская",
    "lat": 55.655086,
    "lng": 37.648583,
    "osmType": "node",
    "osmId": 10852613373
  },
  {
    "citySlug": "moskva",
    "cityName": "Москва",
    "name": "Киевская",
    "lat": 55.744301,
    "lng": 37.565375,
    "osmType": "node",
    "osmId": 4927798806
  },
  {
    "citySlug": "moskva",
    "cityName": "Москва",
    "name": "Китай-город",
    "lat": 55.755586,
    "lng": 37.633059,
    "osmType": "node",
    "osmId": 5176322726
  },
  {
    "citySlug": "moskva",
    "cityName": "Москва",
    "name": "Кленовый бульвар",
    "lat": 55.674487,
    "lng": 37.680734,
    "osmType": "node",
    "osmId": 10702213023
  },
  {
    "citySlug": "moskva",
    "cityName": "Москва",
    "name": "Кожуховская",
    "lat": 55.707586,
    "lng": 37.684618,
    "osmType": "node",
    "osmId": 296949274
  },
  {
    "citySlug": "moskva",
    "cityName": "Москва",
    "name": "Коломенская",
    "lat": 55.678481,
    "lng": 37.663925,
    "osmType": "node",
    "osmId": 292147581
  },
  {
    "citySlug": "moskva",
    "cityName": "Москва",
    "name": "Коммунарка",
    "lat": 55.574632,
    "lng": 37.467991,
    "osmType": "node",
    "osmId": 12460750156
  },
  {
    "citySlug": "moskva",
    "cityName": "Москва",
    "name": "Комсомольская",
    "lat": 55.774581,
    "lng": 37.654491,
    "osmType": "node",
    "osmId": 297148038
  },
  {
    "citySlug": "moskva",
    "cityName": "Москва",
    "name": "Коньково",
    "lat": 55.633147,
    "lng": 37.518977,
    "osmType": "node",
    "osmId": 1221839292
  },
  {
    "citySlug": "moskva",
    "cityName": "Москва",
    "name": "Корниловская",
    "lat": 55.598396,
    "lng": 37.478989,
    "osmType": "node",
    "osmId": 12460750155
  },
  {
    "citySlug": "moskva",
    "cityName": "Москва",
    "name": "Косино",
    "lat": 55.703417,
    "lng": 37.851032,
    "osmType": "node",
    "osmId": 6518539849
  },
  {
    "citySlug": "moskva",
    "cityName": "Москва",
    "name": "Котельники",
    "lat": 55.674218,
    "lng": 37.858513,
    "osmType": "node",
    "osmId": 3706464707
  },
  {
    "citySlug": "moskva",
    "cityName": "Москва",
    "name": "Красногвардейская",
    "lat": 55.613694,
    "lng": 37.744435,
    "osmType": "node",
    "osmId": 300120212
  },
  {
    "citySlug": "moskva",
    "cityName": "Москва",
    "name": "Краснопресненская",
    "lat": 55.761185,
    "lng": 37.577329,
    "osmType": "node",
    "osmId": 309744779
  },
  {
    "citySlug": "moskva",
    "cityName": "Москва",
    "name": "Красносельская",
    "lat": 55.780356,
    "lng": 37.667656,
    "osmType": "node",
    "osmId": 267335089
  },
  {
    "citySlug": "moskva",
    "cityName": "Москва",
    "name": "Красные Ворота",
    "lat": 55.769024,
    "lng": 37.648987,
    "osmType": "node",
    "osmId": 6938823554
  },
  {
    "citySlug": "moskva",
    "cityName": "Москва",
    "name": "Крестьянская Застава",
    "lat": 55.73317,
    "lng": 37.667478,
    "osmType": "node",
    "osmId": 297773322
  },
  {
    "citySlug": "moskva",
    "cityName": "Москва",
    "name": "Кропоткинская",
    "lat": 55.74543,
    "lng": 37.603807,
    "osmType": "node",
    "osmId": 278692957
  },
  {
    "citySlug": "moskva",
    "cityName": "Москва",
    "name": "Крылатское",
    "lat": 55.756595,
    "lng": 37.408139,
    "osmType": "node",
    "osmId": 6939665011
  },
  {
    "citySlug": "moskva",
    "cityName": "Москва",
    "name": "Крымская",
    "lat": 55.689732,
    "lng": 37.609394,
    "osmType": "node",
    "osmId": 13141822040
  },
  {
    "citySlug": "moskva",
    "cityName": "Москва",
    "name": "Кузнецкий Мост",
    "lat": 55.760751,
    "lng": 37.626143,
    "osmType": "node",
    "osmId": 252934400
  },
  {
    "citySlug": "moskva",
    "cityName": "Москва",
    "name": "Кузьминки",
    "lat": 55.705602,
    "lng": 37.765784,
    "osmType": "node",
    "osmId": 253016894
  },
  {
    "citySlug": "moskva",
    "cityName": "Москва",
    "name": "Кунцевская",
    "lat": 55.730763,
    "lng": 37.445982,
    "osmType": "node",
    "osmId": 10852613371
  },
  {
    "citySlug": "moskva",
    "cityName": "Москва",
    "name": "Курская",
    "lat": 55.758019,
    "lng": 37.658419,
    "osmType": "node",
    "osmId": 5202107570
  },
  {
    "citySlug": "moskva",
    "cityName": "Москва",
    "name": "Кутузовская",
    "lat": 55.739991,
    "lng": 37.534386,
    "osmType": "node",
    "osmId": 241158369
  },
  {
    "citySlug": "moskva",
    "cityName": "Москва",
    "name": "Ленинский проспект",
    "lat": 55.707617,
    "lng": 37.586212,
    "osmType": "node",
    "osmId": 282411334
  },
  {
    "citySlug": "moskva",
    "cityName": "Москва",
    "name": "Лермонтовский проспект",
    "lat": 55.701625,
    "lng": 37.851973,
    "osmType": "node",
    "osmId": 2525101863
  },
  {
    "citySlug": "moskva",
    "cityName": "Москва",
    "name": "Лесопарковая",
    "lat": 55.582098,
    "lng": 37.576892,
    "osmType": "node",
    "osmId": 2591395115
  },
  {
    "citySlug": "moskva",
    "cityName": "Москва",
    "name": "Лефортово",
    "lat": 55.764734,
    "lng": 37.706738,
    "osmType": "node",
    "osmId": 7340764979
  },
  {
    "citySlug": "moskva",
    "cityName": "Москва",
    "name": "Лианозово",
    "lat": 55.898115,
    "lng": 37.544663,
    "osmType": "node",
    "osmId": 11174673551
  },
  {
    "citySlug": "moskva",
    "cityName": "Москва",
    "name": "Ломоносовский проспект",
    "lat": 55.707142,
    "lng": 37.516236,
    "osmType": "node",
    "osmId": 4737155709
  },
  {
    "citySlug": "moskva",
    "cityName": "Москва",
    "name": "Лубянка",
    "lat": 55.759873,
    "lng": 37.627855,
    "osmType": "node",
    "osmId": 267335316
  },
  {
    "citySlug": "moskva",
    "cityName": "Москва",
    "name": "Лухмановская",
    "lat": 55.70851,
    "lng": 37.901016,
    "osmType": "node",
    "osmId": 6518539851
  },
  {
    "citySlug": "moskva",
    "cityName": "Москва",
    "name": "Люблино",
    "lat": 55.675721,
    "lng": 37.761958,
    "osmType": "node",
    "osmId": 296949285
  },
  {
    "citySlug": "moskva",
    "cityName": "Москва",
    "name": "Марксистская",
    "lat": 55.741316,
    "lng": 37.653534,
    "osmType": "node",
    "osmId": 276191577
  },
  {
    "citySlug": "moskva",
    "cityName": "Москва",
    "name": "Марьина Роща",
    "lat": 55.796533,
    "lng": 37.616417,
    "osmType": "node",
    "osmId": 10702624107
  },
  {
    "citySlug": "moskva",
    "cityName": "Москва",
    "name": "Марьино",
    "lat": 55.650016,
    "lng": 37.743147,
    "osmType": "node",
    "osmId": 296949290
  },
  {
    "citySlug": "moskva",
    "cityName": "Москва",
    "name": "Маяковская",
    "lat": 55.770171,
    "lng": 37.595087,
    "osmType": "node",
    "osmId": 291687455
  },
  {
    "citySlug": "moskva",
    "cityName": "Москва",
    "name": "Медведково",
    "lat": 55.887177,
    "lng": 37.66155,
    "osmType": "node",
    "osmId": 60660466
  },
  {
    "citySlug": "moskva",
    "cityName": "Москва",
    "name": "Менделеевская",
    "lat": 55.780961,
    "lng": 37.601981,
    "osmType": "node",
    "osmId": 296956170
  },
  {
    "citySlug": "moskva",
    "cityName": "Москва",
    "name": "Минская",
    "lat": 55.724788,
    "lng": 37.496844,
    "osmType": "node",
    "osmId": 4737155708
  },
  {
    "citySlug": "moskva",
    "cityName": "Москва",
    "name": "Митино",
    "lat": 55.845754,
    "lng": 37.362226,
    "osmType": "node",
    "osmId": 596129560
  },
  {
    "citySlug": "moskva",
    "cityName": "Москва",
    "name": "Мичуринский проспект",
    "lat": 55.688297,
    "lng": 37.485191,
    "osmType": "node",
    "osmId": 9315693028
  },
  {
    "citySlug": "moskva",
    "cityName": "Москва",
    "name": "Мнёвники",
    "lat": 55.761184,
    "lng": 37.471405,
    "osmType": "node",
    "osmId": 8581944519
  },
  {
    "citySlug": "moskva",
    "cityName": "Москва",
    "name": "Молодёжная",
    "lat": 55.740757,
    "lng": 37.416939,
    "osmType": "node",
    "osmId": 244036228
  },
  {
    "citySlug": "moskva",
    "cityName": "Москва",
    "name": "Москва-Сити",
    "lat": 55.748305,
    "lng": 37.534231,
    "osmType": "node",
    "osmId": 255856078
  },
  {
    "citySlug": "moskva",
    "cityName": "Москва",
    "name": "Мякинино",
    "lat": 55.825203,
    "lng": 37.385295,
    "osmType": "node",
    "osmId": 5202107566
  },
  {
    "citySlug": "moskva",
    "cityName": "Москва",
    "name": "Нагатинская",
    "lat": 55.682973,
    "lng": 37.622414,
    "osmType": "node",
    "osmId": 296953132
  },
  {
    "citySlug": "moskva",
    "cityName": "Москва",
    "name": "Нагатинский Затон",
    "lat": 55.684331,
    "lng": 37.704303,
    "osmType": "node",
    "osmId": 10702213026
  },
  {
    "citySlug": "moskva",
    "cityName": "Москва",
    "name": "Нагорная",
    "lat": 55.671943,
    "lng": 37.610274,
    "osmType": "node",
    "osmId": 296953133
  },
  {
    "citySlug": "moskva",
    "cityName": "Москва",
    "name": "Народное Ополчение",
    "lat": 55.775735,
    "lng": 37.485731,
    "osmType": "node",
    "osmId": 8581944518
  },
  {
    "citySlug": "moskva",
    "cityName": "Москва",
    "name": "Нахимовский проспект",
    "lat": 55.662651,
    "lng": 37.605622,
    "osmType": "node",
    "osmId": 296953134
  },
  {
    "citySlug": "moskva",
    "cityName": "Москва",
    "name": "Некрасовка",
    "lat": 55.702891,
    "lng": 37.928178,
    "osmType": "node",
    "osmId": 6518539852
  },
  {
    "citySlug": "moskva",
    "cityName": "Москва",
    "name": "Нижегородская",
    "lat": 55.731717,
    "lng": 37.729796,
    "osmType": "node",
    "osmId": 10852613372
  },
  {
    "citySlug": "moskva",
    "cityName": "Москва",
    "name": "Новаторская",
    "lat": 55.671585,
    "lng": 37.521386,
    "osmType": "node",
    "osmId": 12163102815
  },
  {
    "citySlug": "moskva",
    "cityName": "Москва",
    "name": "Новогиреево",
    "lat": 55.751769,
    "lng": 37.816745,
    "osmType": "node",
    "osmId": 255744331
  },
  {
    "citySlug": "moskva",
    "cityName": "Москва",
    "name": "Новокосино",
    "lat": 55.745087,
    "lng": 37.863773,
    "osmType": "node",
    "osmId": 1890426555
  },
  {
    "citySlug": "moskva",
    "cityName": "Москва",
    "name": "Новокузнецкая",
    "lat": 55.741434,
    "lng": 37.629202,
    "osmType": "node",
    "osmId": 292143796
  },
  {
    "citySlug": "moskva",
    "cityName": "Москва",
    "name": "Новомосковская",
    "lat": 55.560601,
    "lng": 37.465278,
    "osmType": "node",
    "osmId": 12460750157
  },
  {
    "citySlug": "moskva",
    "cityName": "Москва",
    "name": "Новопеределкино",
    "lat": 55.639625,
    "lng": 37.355104,
    "osmType": "node",
    "osmId": 5868122986
  },
  {
    "citySlug": "moskva",
    "cityName": "Москва",
    "name": "Новослободская",
    "lat": 55.779852,
    "lng": 37.603475,
    "osmType": "node",
    "osmId": 297366493
  },
  {
    "citySlug": "moskva",
    "cityName": "Москва",
    "name": "Новоясеневская",
    "lat": 55.600994,
    "lng": 37.554139,
    "osmType": "node",
    "osmId": 291712231
  },
  {
    "citySlug": "moskva",
    "cityName": "Москва",
    "name": "Новые Черёмушки",
    "lat": 55.670279,
    "lng": 37.554698,
    "osmType": "node",
    "osmId": 259786806
  },
  {
    "citySlug": "moskva",
    "cityName": "Москва",
    "name": "Озёрная",
    "lat": 55.670505,
    "lng": 37.44873,
    "osmType": "node",
    "osmId": 5868122985
  },
  {
    "citySlug": "moskva",
    "cityName": "Москва",
    "name": "Окружная",
    "lat": 55.846026,
    "lng": 37.573829,
    "osmType": "node",
    "osmId": 5482410676
  },
  {
    "citySlug": "moskva",
    "cityName": "Москва",
    "name": "Окская",
    "lat": 55.718342,
    "lng": 37.781763,
    "osmType": "node",
    "osmId": 7335380503
  },
  {
    "citySlug": "moskva",
    "cityName": "Москва",
    "name": "Октябрьская",
    "lat": 55.729779,
    "lng": 37.609399,
    "osmType": "node",
    "osmId": 291686160
  },
  {
    "citySlug": "moskva",
    "cityName": "Москва",
    "name": "Октябрьское Поле",
    "lat": 55.793366,
    "lng": 37.493812,
    "osmType": "node",
    "osmId": 309748905
  },
  {
    "citySlug": "moskva",
    "cityName": "Москва",
    "name": "Ольховая",
    "lat": 55.568621,
    "lng": 37.459359,
    "osmType": "node",
    "osmId": 6560279949
  },
  {
    "citySlug": "moskva",
    "cityName": "Москва",
    "name": "Орехово",
    "lat": 55.613143,
    "lng": 37.694972,
    "osmType": "node",
    "osmId": 308993125
  },
  {
    "citySlug": "moskva",
    "cityName": "Москва",
    "name": "Отрадное",
    "lat": 55.863177,
    "lng": 37.604651,
    "osmType": "node",
    "osmId": 296957241
  },
  {
    "citySlug": "moskva",
    "cityName": "Москва",
    "name": "Охотный Ряд",
    "lat": 55.757772,
    "lng": 37.61651,
    "osmType": "node",
    "osmId": 267335315
  },
  {
    "citySlug": "moskva",
    "cityName": "Москва",
    "name": "Павелецкая",
    "lat": 55.732317,
    "lng": 37.638148,
    "osmType": "node",
    "osmId": 292019996
  },
  {
    "citySlug": "moskva",
    "cityName": "Москва",
    "name": "Парк Культуры",
    "lat": 55.735492,
    "lng": 37.594273,
    "osmType": "node",
    "osmId": 5176445915
  },
  {
    "citySlug": "moskva",
    "cityName": "Москва",
    "name": "Парк Победы",
    "lat": 55.736169,
    "lng": 37.517967,
    "osmType": "node",
    "osmId": 10852613370
  },
  {
    "citySlug": "moskva",
    "cityName": "Москва",
    "name": "Партизанская",
    "lat": 55.788503,
    "lng": 37.750993,
    "osmType": "node",
    "osmId": 68916801
  },
  {
    "citySlug": "moskva",
    "cityName": "Москва",
    "name": "Первомайская",
    "lat": 55.794727,
    "lng": 37.799396,
    "osmType": "node",
    "osmId": 2692882978
  },
  {
    "citySlug": "moskva",
    "cityName": "Москва",
    "name": "Перово",
    "lat": 55.751197,
    "lng": 37.786482,
    "osmType": "node",
    "osmId": 255744332
  },
  {
    "citySlug": "moskva",
    "cityName": "Москва",
    "name": "Петровский парк",
    "lat": 55.791922,
    "lng": 37.557093,
    "osmType": "node",
    "osmId": 5436412993
  },
  {
    "citySlug": "moskva",
    "cityName": "Москва",
    "name": "Петровско-Разумовская",
    "lat": 55.83499,
    "lng": 37.574421,
    "osmType": "node",
    "osmId": 5202080142
  },
  {
    "citySlug": "moskva",
    "cityName": "Москва",
    "name": "Печатники",
    "lat": 55.694606,
    "lng": 37.727363,
    "osmType": "node",
    "osmId": 10702442752
  },
  {
    "citySlug": "moskva",
    "cityName": "Москва",
    "name": "Пионерская",
    "lat": 55.735988,
    "lng": 37.467136,
    "osmType": "node",
    "osmId": 244036856
  },
  {
    "citySlug": "moskva",
    "cityName": "Москва",
    "name": "Планерная",
    "lat": 55.860654,
    "lng": 37.436526,
    "osmType": "node",
    "osmId": 296959502
  },
  {
    "citySlug": "moskva",
    "cityName": "Москва",
    "name": "Площадь Ильича",
    "lat": 55.747196,
    "lng": 37.683197,
    "osmType": "node",
    "osmId": 276191299
  },
  {
    "citySlug": "moskva",
    "cityName": "Москва",
    "name": "Площадь Революции",
    "lat": 55.756651,
    "lng": 37.621784,
    "osmType": "node",
    "osmId": 242546475
  },
  {
    "citySlug": "moskva",
    "cityName": "Москва",
    "name": "Полежаевская",
    "lat": 55.777509,
    "lng": 37.51929,
    "osmType": "node",
    "osmId": 296959507
  },
  {
    "citySlug": "moskva",
    "cityName": "Москва",
    "name": "Полянка",
    "lat": 55.738168,
    "lng": 37.6172,
    "osmType": "node",
    "osmId": 312816773
  },
  {
    "citySlug": "moskva",
    "cityName": "Москва",
    "name": "Потапово",
    "lat": 55.55264,
    "lng": 37.492621,
    "osmType": "node",
    "osmId": 12157560726
  },
  {
    "citySlug": "moskva",
    "cityName": "Москва",
    "name": "Пражская",
    "lat": 55.612374,
    "lng": 37.604524,
    "osmType": "node",
    "osmId": 296953138
  },
  {
    "citySlug": "moskva",
    "cityName": "Москва",
    "name": "Преображенская площадь",
    "lat": 55.79637,
    "lng": 37.715347,
    "osmType": "node",
    "osmId": 265949958
  },
  {
    "citySlug": "moskva",
    "cityName": "Москва",
    "name": "Прокшино",
    "lat": 55.586218,
    "lng": 37.433859,
    "osmType": "node",
    "osmId": 6560279950
  },
  {
    "citySlug": "moskva",
    "cityName": "Москва",
    "name": "Пролетарская",
    "lat": 55.731857,
    "lng": 37.665879,
    "osmType": "node",
    "osmId": 253016891
  },
  {
    "citySlug": "moskva",
    "cityName": "Москва",
    "name": "Проспект Вернадского",
    "lat": 55.678431,
    "lng": 37.503929,
    "osmType": "node",
    "osmId": 9315693025
  },
  {
    "citySlug": "moskva",
    "cityName": "Москва",
    "name": "Проспект Мира",
    "lat": 55.779633,
    "lng": 37.631753,
    "osmType": "node",
    "osmId": 293799708
  },
  {
    "citySlug": "moskva",
    "cityName": "Москва",
    "name": "Профсоюзная",
    "lat": 55.67793,
    "lng": 37.562904,
    "osmType": "node",
    "osmId": 282414382
  },
  {
    "citySlug": "moskva",
    "cityName": "Москва",
    "name": "Пушкинская",
    "lat": 55.765428,
    "lng": 37.607416,
    "osmType": "node",
    "osmId": 362156015
  },
  {
    "citySlug": "moskva",
    "cityName": "Москва",
    "name": "Пыхтино",
    "lat": 55.624503,
    "lng": 37.295668,
    "osmType": "node",
    "osmId": 11171697213
  },
  {
    "citySlug": "moskva",
    "cityName": "Москва",
    "name": "Пятницкое шоссе",
    "lat": 55.856143,
    "lng": 37.354202,
    "osmType": "node",
    "osmId": 2101832212
  },
  {
    "citySlug": "moskva",
    "cityName": "Москва",
    "name": "Раменки",
    "lat": 55.697561,
    "lng": 37.498542,
    "osmType": "node",
    "osmId": 4737155710
  },
  {
    "citySlug": "moskva",
    "cityName": "Москва",
    "name": "Рассказовка",
    "lat": 55.634029,
    "lng": 37.335086,
    "osmType": "node",
    "osmId": 5868122987
  },
  {
    "citySlug": "moskva",
    "cityName": "Москва",
    "name": "Речной вокзал",
    "lat": 55.855013,
    "lng": 37.476213,
    "osmType": "node",
    "osmId": 266835841
  },
  {
    "citySlug": "moskva",
    "cityName": "Москва",
    "name": "Рижская",
    "lat": 55.793884,
    "lng": 37.634328,
    "osmType": "node",
    "osmId": 10702624108
  },
  {
    "citySlug": "moskva",
    "cityName": "Москва",
    "name": "Римская",
    "lat": 55.746342,
    "lng": 37.683251,
    "osmType": "node",
    "osmId": 296947177
  },
  {
    "citySlug": "moskva",
    "cityName": "Москва",
    "name": "Румянцево",
    "lat": 55.632954,
    "lng": 37.441585,
    "osmType": "node",
    "osmId": 3943961770
  },
  {
    "citySlug": "moskva",
    "cityName": "Москва",
    "name": "Рязанский проспект",
    "lat": 55.716947,
    "lng": 37.793315,
    "osmType": "node",
    "osmId": 253017004
  },
  {
    "citySlug": "moskva",
    "cityName": "Москва",
    "name": "Савёловская",
    "lat": 55.792329,
    "lng": 37.58612,
    "osmType": "node",
    "osmId": 6172651201
  },
  {
    "citySlug": "moskva",
    "cityName": "Москва",
    "name": "Саларьево",
    "lat": 55.621922,
    "lng": 37.424187,
    "osmType": "node",
    "osmId": 4006225428
  },
  {
    "citySlug": "moskva",
    "cityName": "Москва",
    "name": "Свиблово",
    "lat": 55.855213,
    "lng": 37.652706,
    "osmType": "node",
    "osmId": 268521588
  },
  {
    "citySlug": "moskva",
    "cityName": "Москва",
    "name": "Севастопольская",
    "lat": 55.652674,
    "lng": 37.598434,
    "osmType": "node",
    "osmId": 296953135
  },
  {
    "citySlug": "moskva",
    "cityName": "Москва",
    "name": "Селигерская",
    "lat": 55.866612,
    "lng": 37.54718,
    "osmType": "node",
    "osmId": 5482245444
  },
  {
    "citySlug": "moskva",
    "cityName": "Москва",
    "name": "Семёновская",
    "lat": 55.783307,
    "lng": 37.721282,
    "osmType": "node",
    "osmId": 68937012
  },
  {
    "citySlug": "moskva",
    "cityName": "Москва",
    "name": "Серпуховская",
    "lat": 55.727953,
    "lng": 37.624829,
    "osmType": "node",
    "osmId": 296953130
  },
  {
    "citySlug": "moskva",
    "cityName": "Москва",
    "name": "Славянский бульвар",
    "lat": 55.729596,
    "lng": 37.470788,
    "osmType": "node",
    "osmId": 253780238
  },
  {
    "citySlug": "moskva",
    "cityName": "Москва",
    "name": "Смоленская",
    "lat": 55.748808,
    "lng": 37.582721,
    "osmType": "node",
    "osmId": 291687197
  },
  {
    "citySlug": "moskva",
    "cityName": "Москва",
    "name": "Сокол",
    "lat": 55.805267,
    "lng": 37.515053,
    "osmType": "node",
    "osmId": 5202107576
  },
  {
    "citySlug": "moskva",
    "cityName": "Москва",
    "name": "Сокольники",
    "lat": 55.790178,
    "lng": 37.679257,
    "osmType": "node",
    "osmId": 10703951288
  },
  {
    "citySlug": "moskva",
    "cityName": "Москва",
    "name": "Солнцево",
    "lat": 55.649569,
    "lng": 37.3911,
    "osmType": "node",
    "osmId": 5868122989
  },
  {
    "citySlug": "moskva",
    "cityName": "Москва",
    "name": "Спартак",
    "lat": 55.818304,
    "lng": 37.435752,
    "osmType": "node",
    "osmId": 5202107560
  },
  {
    "citySlug": "moskva",
    "cityName": "Москва",
    "name": "Спортивная",
    "lat": 55.723383,
    "lng": 37.564213,
    "osmType": "node",
    "osmId": 278693055
  },
  {
    "citySlug": "moskva",
    "cityName": "Москва",
    "name": "Сретенский бульвар",
    "lat": 55.766988,
    "lng": 37.640087,
    "osmType": "node",
    "osmId": 666528523
  },
  {
    "citySlug": "moskva",
    "cityName": "Москва",
    "name": "Стахановская",
    "lat": 55.727018,
    "lng": 37.753248,
    "osmType": "node",
    "osmId": 7335523472
  },
  {
    "citySlug": "moskva",
    "cityName": "Москва",
    "name": "Строгино",
    "lat": 55.803702,
    "lng": 37.403083,
    "osmType": "node",
    "osmId": 5202107564
  },
  {
    "citySlug": "moskva",
    "cityName": "Москва",
    "name": "Студенческая",
    "lat": 55.73883,
    "lng": 37.54841,
    "osmType": "node",
    "osmId": 241158415
  },
  {
    "citySlug": "moskva",
    "cityName": "Москва",
    "name": "Сухаревская",
    "lat": 55.772955,
    "lng": 37.631204,
    "osmType": "node",
    "osmId": 277499849
  },
  {
    "citySlug": "moskva",
    "cityName": "Москва",
    "name": "Сходненская",
    "lat": 55.850481,
    "lng": 37.439774,
    "osmType": "node",
    "osmId": 309750154
  },
  {
    "citySlug": "moskva",
    "cityName": "Москва",
    "name": "Таганская",
    "lat": 55.741665,
    "lng": 37.651323,
    "osmType": "node",
    "osmId": 296045315
  },
  {
    "citySlug": "moskva",
    "cityName": "Москва",
    "name": "Тверская",
    "lat": 55.764895,
    "lng": 37.606313,
    "osmType": "node",
    "osmId": 292144111
  },
  {
    "citySlug": "moskva",
    "cityName": "Москва",
    "name": "Театральная",
    "lat": 55.757507,
    "lng": 37.619191,
    "osmType": "node",
    "osmId": 292143794
  },
  {
    "citySlug": "moskva",
    "cityName": "Москва",
    "name": "Текстильщики",
    "lat": 55.707053,
    "lng": 37.728473,
    "osmType": "node",
    "osmId": 10702471714
  },
  {
    "citySlug": "moskva",
    "cityName": "Москва",
    "name": "Тёплый Стан",
    "lat": 55.618862,
    "lng": 37.508218,
    "osmType": "node",
    "osmId": 259785706
  },
  {
    "citySlug": "moskva",
    "cityName": "Москва",
    "name": "Терехово",
    "lat": 55.748029,
    "lng": 37.459643,
    "osmType": "node",
    "osmId": 9315693039
  },
  {
    "citySlug": "moskva",
    "cityName": "Москва",
    "name": "Технопарк",
    "lat": 55.693623,
    "lng": 37.664435,
    "osmType": "node",
    "osmId": 292148161
  },
  {
    "citySlug": "moskva",
    "cityName": "Москва",
    "name": "Тимирязевская",
    "lat": 55.817126,
    "lng": 37.576389,
    "osmType": "node",
    "osmId": 296956167
  },
  {
    "citySlug": "moskva",
    "cityName": "Москва",
    "name": "Третьяковская",
    "lat": 55.741284,
    "lng": 37.627308,
    "osmType": "node",
    "osmId": 493292529
  },
  {
    "citySlug": "moskva",
    "cityName": "Москва",
    "name": "Тропарёво",
    "lat": 55.645857,
    "lng": 37.472526,
    "osmType": "node",
    "osmId": 3224593379
  },
  {
    "citySlug": "moskva",
    "cityName": "Москва",
    "name": "Трубная",
    "lat": 55.769114,
    "lng": 37.619551,
    "osmType": "node",
    "osmId": 296944258
  },
  {
    "citySlug": "moskva",
    "cityName": "Москва",
    "name": "Тульская",
    "lat": 55.708665,
    "lng": 37.622817,
    "osmType": "node",
    "osmId": 296953131
  },
  {
    "citySlug": "moskva",
    "cityName": "Москва",
    "name": "Тургеневская",
    "lat": 55.766492,
    "lng": 37.637467,
    "osmType": "node",
    "osmId": 277499850
  },
  {
    "citySlug": "moskva",
    "cityName": "Москва",
    "name": "Тушинская",
    "lat": 55.826529,
    "lng": 37.436976,
    "osmType": "node",
    "osmId": 296959504
  },
  {
    "citySlug": "moskva",
    "cityName": "Москва",
    "name": "Тютчевская",
    "lat": 55.61905,
    "lng": 37.481085,
    "osmType": "node",
    "osmId": 12163102805
  },
  {
    "citySlug": "moskva",
    "cityName": "Москва",
    "name": "Улица 1905 года",
    "lat": 55.764861,
    "lng": 37.561341,
    "osmType": "node",
    "osmId": 296959509
  },
  {
    "citySlug": "moskva",
    "cityName": "Москва",
    "name": "Улица Академика Янгеля",
    "lat": 55.594986,
    "lng": 37.600436,
    "osmType": "node",
    "osmId": 296953139
  },
  {
    "citySlug": "moskva",
    "cityName": "Москва",
    "name": "Улица Горчакова",
    "lat": 55.541695,
    "lng": 37.530718,
    "osmType": "node",
    "osmId": 296932670
  },
  {
    "citySlug": "moskva",
    "cityName": "Москва",
    "name": "Улица Дмитриевского",
    "lat": 55.710103,
    "lng": 37.880201,
    "osmType": "node",
    "osmId": 6518539850
  },
  {
    "citySlug": "moskva",
    "cityName": "Москва",
    "name": "Улица Скобелевская",
    "lat": 55.548108,
    "lng": 37.554625,
    "osmType": "node",
    "osmId": 296932663
  },
  {
    "citySlug": "moskva",
    "cityName": "Москва",
    "name": "Улица Старокачаловская",
    "lat": 55.568955,
    "lng": 37.576652,
    "osmType": "node",
    "osmId": 309741829
  },
  {
    "citySlug": "moskva",
    "cityName": "Москва",
    "name": "Университет",
    "lat": 55.692663,
    "lng": 37.533285,
    "osmType": "node",
    "osmId": 309752494
  },
  {
    "citySlug": "moskva",
    "cityName": "Москва",
    "name": "Университет дружбы народов",
    "lat": 55.647937,
    "lng": 37.507143,
    "osmType": "node",
    "osmId": 12163102812
  },
  {
    "citySlug": "moskva",
    "cityName": "Москва",
    "name": "Физтех",
    "lat": 55.921662,
    "lng": 37.546576,
    "osmType": "node",
    "osmId": 11174639393
  },
  {
    "citySlug": "moskva",
    "cityName": "Москва",
    "name": "Филатов Луг",
    "lat": 55.601528,
    "lng": 37.407426,
    "osmType": "node",
    "osmId": 6560279951
  },
  {
    "citySlug": "moskva",
    "cityName": "Москва",
    "name": "Филёвский парк",
    "lat": 55.739508,
    "lng": 37.483372,
    "osmType": "node",
    "osmId": 241158259
  },
  {
    "citySlug": "moskva",
    "cityName": "Москва",
    "name": "Фили",
    "lat": 55.746127,
    "lng": 37.514827,
    "osmType": "node",
    "osmId": 241158327
  },
  {
    "citySlug": "moskva",
    "cityName": "Москва",
    "name": "Фонвизинская",
    "lat": 55.822916,
    "lng": 37.587637,
    "osmType": "node",
    "osmId": 4404057364
  },
  {
    "citySlug": "moskva",
    "cityName": "Москва",
    "name": "Фрунзенская",
    "lat": 55.726879,
    "lng": 37.57833,
    "osmType": "node",
    "osmId": 278693056
  },
  {
    "citySlug": "moskva",
    "cityName": "Москва",
    "name": "Ховрино",
    "lat": 55.878152,
    "lng": 37.480854,
    "osmType": "node",
    "osmId": 5308689093
  },
  {
    "citySlug": "moskva",
    "cityName": "Москва",
    "name": "Хорошёвская",
    "lat": 55.776695,
    "lng": 37.519137,
    "osmType": "node",
    "osmId": 5436404611
  },
  {
    "citySlug": "moskva",
    "cityName": "Москва",
    "name": "Царицыно",
    "lat": 55.621481,
    "lng": 37.669238,
    "osmType": "node",
    "osmId": 308993196
  },
  {
    "citySlug": "moskva",
    "cityName": "Москва",
    "name": "Цветной бульвар",
    "lat": 55.770872,
    "lng": 37.61791,
    "osmType": "node",
    "osmId": 291689166
  },
  {
    "citySlug": "moskva",
    "cityName": "Москва",
    "name": "ЦСКА",
    "lat": 55.786561,
    "lng": 37.533201,
    "osmType": "node",
    "osmId": 5436420781
  },
  {
    "citySlug": "moskva",
    "cityName": "Москва",
    "name": "Черкизовская",
    "lat": 55.803881,
    "lng": 37.745032,
    "osmType": "node",
    "osmId": 265949956
  },
  {
    "citySlug": "moskva",
    "cityName": "Москва",
    "name": "Чертановская",
    "lat": 55.640455,
    "lng": 37.60669,
    "osmType": "node",
    "osmId": 296953136
  },
  {
    "citySlug": "moskva",
    "cityName": "Москва",
    "name": "Чеховская",
    "lat": 55.764833,
    "lng": 37.609087,
    "osmType": "node",
    "osmId": 296953126
  },
  {
    "citySlug": "moskva",
    "cityName": "Москва",
    "name": "Чистые пруды",
    "lat": 55.765871,
    "lng": 37.639028,
    "osmType": "node",
    "osmId": 267335317
  },
  {
    "citySlug": "moskva",
    "cityName": "Москва",
    "name": "Чкаловская",
    "lat": 55.756702,
    "lng": 37.656998,
    "osmType": "node",
    "osmId": 5202107572
  },
  {
    "citySlug": "moskva",
    "cityName": "Москва",
    "name": "Шаболовская",
    "lat": 55.719987,
    "lng": 37.607696,
    "osmType": "node",
    "osmId": 277499854
  },
  {
    "citySlug": "moskva",
    "cityName": "Москва",
    "name": "Шипиловская",
    "lat": 55.621027,
    "lng": 37.743639,
    "osmType": "node",
    "osmId": 1527999934
  },
  {
    "citySlug": "moskva",
    "cityName": "Москва",
    "name": "Шоссе Энтузиастов",
    "lat": 55.757569,
    "lng": 37.749487,
    "osmType": "node",
    "osmId": 255744578
  },
  {
    "citySlug": "moskva",
    "cityName": "Москва",
    "name": "Щёлковская",
    "lat": 55.809337,
    "lng": 37.798572,
    "osmType": "node",
    "osmId": 2692905506
  },
  {
    "citySlug": "moskva",
    "cityName": "Москва",
    "name": "Щукинская",
    "lat": 55.808461,
    "lng": 37.464701,
    "osmType": "node",
    "osmId": 296959505
  },
  {
    "citySlug": "moskva",
    "cityName": "Москва",
    "name": "Электрозаводская",
    "lat": 55.780285,
    "lng": 37.702993,
    "osmType": "node",
    "osmId": 8268702705
  },
  {
    "citySlug": "moskva",
    "cityName": "Москва",
    "name": "Юго-Восточная",
    "lat": 55.705036,
    "lng": 37.818976,
    "osmType": "node",
    "osmId": 7339988431
  },
  {
    "citySlug": "moskva",
    "cityName": "Москва",
    "name": "Юго-Западная",
    "lat": 55.663647,
    "lng": 37.483219,
    "osmType": "node",
    "osmId": 309752486
  },
  {
    "citySlug": "moskva",
    "cityName": "Москва",
    "name": "Южная",
    "lat": 55.622256,
    "lng": 37.609219,
    "osmType": "node",
    "osmId": 296953137
  },
  {
    "citySlug": "moskva",
    "cityName": "Москва",
    "name": "Ясенево",
    "lat": 55.606306,
    "lng": 37.533407,
    "osmType": "node",
    "osmId": 264162888
  },
  {
    "citySlug": "moskva",
    "cityName": "Москва",
    "name": "Яхромская",
    "lat": 55.879882,
    "lng": 37.545442,
    "osmType": "node",
    "osmId": 11174673548
  },
  {
    "citySlug": "nizhniy-novgorod",
    "cityName": "Нижний Новгород",
    "name": "Автозаводская",
    "lat": 56.257243,
    "lng": 43.901371,
    "osmType": "node",
    "osmId": 442018470
  },
  {
    "citySlug": "nizhniy-novgorod",
    "cityName": "Нижний Новгород",
    "name": "Буревестник",
    "lat": 56.333259,
    "lng": 43.894839,
    "osmType": "node",
    "osmId": 442018444
  },
  {
    "citySlug": "nizhniy-novgorod",
    "cityName": "Нижний Новгород",
    "name": "Бурнаковская",
    "lat": 56.325773,
    "lng": 43.912096,
    "osmType": "node",
    "osmId": 442018445
  },
  {
    "citySlug": "nizhniy-novgorod",
    "cityName": "Нижний Новгород",
    "name": "Горьковская",
    "lat": 56.313795,
    "lng": 43.993924,
    "osmType": "node",
    "osmId": 3086398955
  },
  {
    "citySlug": "nizhniy-novgorod",
    "cityName": "Нижний Новгород",
    "name": "Двигатель Революции",
    "lat": 56.276446,
    "lng": 43.921392,
    "osmType": "node",
    "osmId": 442018466
  },
  {
    "citySlug": "nizhniy-novgorod",
    "cityName": "Нижний Новгород",
    "name": "Заречная",
    "lat": 56.285128,
    "lng": 43.927859,
    "osmType": "node",
    "osmId": 442018465
  },
  {
    "citySlug": "nizhniy-novgorod",
    "cityName": "Нижний Новгород",
    "name": "Канавинская",
    "lat": 56.320593,
    "lng": 43.926558,
    "osmType": "node",
    "osmId": 442018446
  },
  {
    "citySlug": "nizhniy-novgorod",
    "cityName": "Нижний Новгород",
    "name": "Кировская",
    "lat": 56.247706,
    "lng": 43.876964,
    "osmType": "node",
    "osmId": 442018472
  },
  {
    "citySlug": "nizhniy-novgorod",
    "cityName": "Нижний Новгород",
    "name": "Комсомольская",
    "lat": 56.252854,
    "lng": 43.890096,
    "osmType": "node",
    "osmId": 442018471
  },
  {
    "citySlug": "nizhniy-novgorod",
    "cityName": "Нижний Новгород",
    "name": "Ленинская",
    "lat": 56.299045,
    "lng": 43.938208,
    "osmType": "node",
    "osmId": 442018464
  },
  {
    "citySlug": "nizhniy-novgorod",
    "cityName": "Нижний Новгород",
    "name": "Московская",
    "lat": 56.320976,
    "lng": 43.947106,
    "osmType": "node",
    "osmId": 5137578904
  },
  {
    "citySlug": "nizhniy-novgorod",
    "cityName": "Нижний Новгород",
    "name": "Парк культуры",
    "lat": 56.242062,
    "lng": 43.858015,
    "osmType": "node",
    "osmId": 442018474
  },
  {
    "citySlug": "nizhniy-novgorod",
    "cityName": "Нижний Новгород",
    "name": "Пролетарская",
    "lat": 56.266433,
    "lng": 43.913377,
    "osmType": "node",
    "osmId": 442018468
  },
  {
    "citySlug": "nizhniy-novgorod",
    "cityName": "Нижний Новгород",
    "name": "Стрелка",
    "lat": 56.335258,
    "lng": 43.949591,
    "osmType": "node",
    "osmId": 5584606667
  },
  {
    "citySlug": "nizhniy-novgorod",
    "cityName": "Нижний Новгород",
    "name": "Чкаловская",
    "lat": 56.310589,
    "lng": 43.937234,
    "osmType": "node",
    "osmId": 442018457
  },
  {
    "citySlug": "novosibirsk",
    "cityName": "Новосибирск",
    "name": "Берёзовая роща",
    "lat": 55.043332,
    "lng": 82.953116,
    "osmType": "node",
    "osmId": 4343794962
  },
  {
    "citySlug": "novosibirsk",
    "cityName": "Новосибирск",
    "name": "Гагаринская",
    "lat": 55.051148,
    "lng": 82.914751,
    "osmType": "node",
    "osmId": 416063358
  },
  {
    "citySlug": "novosibirsk",
    "cityName": "Новосибирск",
    "name": "Заельцовская",
    "lat": 55.059447,
    "lng": 82.912512,
    "osmType": "node",
    "osmId": 335999524
  },
  {
    "citySlug": "novosibirsk",
    "cityName": "Новосибирск",
    "name": "Золотая нива",
    "lat": 55.037685,
    "lng": 82.97672,
    "osmType": "node",
    "osmId": 9948921261
  },
  {
    "citySlug": "novosibirsk",
    "cityName": "Новосибирск",
    "name": "Красный проспект",
    "lat": 55.041388,
    "lng": 82.917391,
    "osmType": "node",
    "osmId": 296995573
  },
  {
    "citySlug": "novosibirsk",
    "cityName": "Новосибирск",
    "name": "Маршала Покрышкина",
    "lat": 55.043702,
    "lng": 82.935,
    "osmType": "node",
    "osmId": 416063360
  },
  {
    "citySlug": "novosibirsk",
    "cityName": "Новосибирск",
    "name": "Октябрьская",
    "lat": 55.018957,
    "lng": 82.939144,
    "osmType": "node",
    "osmId": 296998283
  },
  {
    "citySlug": "novosibirsk",
    "cityName": "Новосибирск",
    "name": "Площадь Гарина-Михайловского",
    "lat": 55.035398,
    "lng": 82.898827,
    "osmType": "node",
    "osmId": 296993659
  },
  {
    "citySlug": "novosibirsk",
    "cityName": "Новосибирск",
    "name": "Площадь Ленина",
    "lat": 55.030107,
    "lng": 82.920499,
    "osmType": "node",
    "osmId": 296998275
  },
  {
    "citySlug": "novosibirsk",
    "cityName": "Новосибирск",
    "name": "Площадь Маркса",
    "lat": 54.983047,
    "lng": 82.893032,
    "osmType": "node",
    "osmId": 335996181
  },
  {
    "citySlug": "novosibirsk",
    "cityName": "Новосибирск",
    "name": "Речной вокзал",
    "lat": 55.008947,
    "lng": 82.93838,
    "osmType": "node",
    "osmId": 296998287
  },
  {
    "citySlug": "novosibirsk",
    "cityName": "Новосибирск",
    "name": "Сибирская",
    "lat": 55.042318,
    "lng": 82.918705,
    "osmType": "node",
    "osmId": 416063356
  },
  {
    "citySlug": "novosibirsk",
    "cityName": "Новосибирск",
    "name": "Спортивная",
    "lat": 54.996934,
    "lng": 82.920438,
    "osmType": "node",
    "osmId": 8551123999
  },
  {
    "citySlug": "novosibirsk",
    "cityName": "Новосибирск",
    "name": "Студенческая",
    "lat": 54.989308,
    "lng": 82.906637,
    "osmType": "node",
    "osmId": 416056907
  },
  {
    "citySlug": "samara",
    "cityName": "Самара",
    "name": "Алабинская",
    "lat": 53.209582,
    "lng": 50.134186,
    "osmType": "node",
    "osmId": 3779454539
  },
  {
    "citySlug": "samara",
    "cityName": "Самара",
    "name": "Безымянка",
    "lat": 53.212837,
    "lng": 50.248438,
    "osmType": "node",
    "osmId": 351119750
  },
  {
    "citySlug": "samara",
    "cityName": "Самара",
    "name": "Гагаринская",
    "lat": 53.200274,
    "lng": 50.176512,
    "osmType": "node",
    "osmId": 442008174
  },
  {
    "citySlug": "samara",
    "cityName": "Самара",
    "name": "Кировская",
    "lat": 53.211291,
    "lng": 50.269532,
    "osmType": "node",
    "osmId": 6986625318
  },
  {
    "citySlug": "samara",
    "cityName": "Самара",
    "name": "Московская",
    "lat": 53.202809,
    "lng": 50.160496,
    "osmType": "node",
    "osmId": 442008175
  },
  {
    "citySlug": "samara",
    "cityName": "Самара",
    "name": "Победа",
    "lat": 53.206983,
    "lng": 50.23577,
    "osmType": "node",
    "osmId": 442008171
  },
  {
    "citySlug": "samara",
    "cityName": "Самара",
    "name": "Российская",
    "lat": 53.211918,
    "lng": 50.148986,
    "osmType": "node",
    "osmId": 442008176
  },
  {
    "citySlug": "samara",
    "cityName": "Самара",
    "name": "Советская",
    "lat": 53.201554,
    "lng": 50.220441,
    "osmType": "node",
    "osmId": 442008172
  },
  {
    "citySlug": "samara",
    "cityName": "Самара",
    "name": "Спортивная",
    "lat": 53.200956,
    "lng": 50.199578,
    "osmType": "node",
    "osmId": 442008173
  },
  {
    "citySlug": "samara",
    "cityName": "Самара",
    "name": "Юнгородок",
    "lat": 53.212474,
    "lng": 50.282584,
    "osmType": "node",
    "osmId": 351119704
  },
  {
    "citySlug": "sankt-peterburg",
    "cityName": "Санкт-Петербург",
    "name": "Автово",
    "lat": 59.866479,
    "lng": 30.261004,
    "osmType": "node",
    "osmId": 258760945
  },
  {
    "citySlug": "sankt-peterburg",
    "cityName": "Санкт-Петербург",
    "name": "Адмиралтейская",
    "lat": 59.936134,
    "lng": 30.313898,
    "osmType": "node",
    "osmId": 1440436739
  },
  {
    "citySlug": "sankt-peterburg",
    "cityName": "Санкт-Петербург",
    "name": "Академическая",
    "lat": 60.012116,
    "lng": 30.392738,
    "osmType": "node",
    "osmId": 2036865229
  },
  {
    "citySlug": "sankt-peterburg",
    "cityName": "Санкт-Петербург",
    "name": "Балтийская",
    "lat": 59.907681,
    "lng": 30.302677,
    "osmType": "node",
    "osmId": 312393508
  },
  {
    "citySlug": "sankt-peterburg",
    "cityName": "Санкт-Петербург",
    "name": "Беговая",
    "lat": 59.987266,
    "lng": 30.202194,
    "osmType": "node",
    "osmId": 5644650789
  },
  {
    "citySlug": "sankt-peterburg",
    "cityName": "Санкт-Петербург",
    "name": "Бухарестская",
    "lat": 59.882328,
    "lng": 30.370319,
    "osmType": "node",
    "osmId": 695134921
  },
  {
    "citySlug": "sankt-peterburg",
    "cityName": "Санкт-Петербург",
    "name": "Василеостровская",
    "lat": 59.943176,
    "lng": 30.275359,
    "osmType": "node",
    "osmId": 2468455392
  },
  {
    "citySlug": "sankt-peterburg",
    "cityName": "Санкт-Петербург",
    "name": "Владимирская",
    "lat": 59.925985,
    "lng": 30.347344,
    "osmType": "node",
    "osmId": 5369186787
  },
  {
    "citySlug": "sankt-peterburg",
    "cityName": "Санкт-Петербург",
    "name": "Волковская",
    "lat": 59.896578,
    "lng": 30.360401,
    "osmType": "node",
    "osmId": 359711515
  },
  {
    "citySlug": "sankt-peterburg",
    "cityName": "Санкт-Петербург",
    "name": "Выборгская",
    "lat": 59.969371,
    "lng": 30.34951,
    "osmType": "node",
    "osmId": 2036840002
  },
  {
    "citySlug": "sankt-peterburg",
    "cityName": "Санкт-Петербург",
    "name": "Горный институт",
    "lat": 59.931152,
    "lng": 30.263811,
    "osmType": "node",
    "osmId": 12452281516
  },
  {
    "citySlug": "sankt-peterburg",
    "cityName": "Санкт-Петербург",
    "name": "Горьковская",
    "lat": 59.955156,
    "lng": 30.319457,
    "osmType": "node",
    "osmId": 88803981
  },
  {
    "citySlug": "sankt-peterburg",
    "cityName": "Санкт-Петербург",
    "name": "Гостиный двор",
    "lat": 59.934244,
    "lng": 30.330203,
    "osmType": "node",
    "osmId": 249307183
  },
  {
    "citySlug": "sankt-peterburg",
    "cityName": "Санкт-Петербург",
    "name": "Гражданский проспект",
    "lat": 60.033241,
    "lng": 30.416814,
    "osmType": "node",
    "osmId": 2036899257
  },
  {
    "citySlug": "sankt-peterburg",
    "cityName": "Санкт-Петербург",
    "name": "Девяткино",
    "lat": 60.050266,
    "lng": 30.442639,
    "osmType": "node",
    "osmId": 158694484
  },
  {
    "citySlug": "sankt-peterburg",
    "cityName": "Санкт-Петербург",
    "name": "Достоевская",
    "lat": 59.926826,
    "lng": 30.345848,
    "osmType": "node",
    "osmId": 94858991
  },
  {
    "citySlug": "sankt-peterburg",
    "cityName": "Санкт-Петербург",
    "name": "Дунайская",
    "lat": 59.839993,
    "lng": 30.410896,
    "osmType": "node",
    "osmId": 4709806343
  },
  {
    "citySlug": "sankt-peterburg",
    "cityName": "Санкт-Петербург",
    "name": "Елизаровская",
    "lat": 59.898062,
    "lng": 30.421701,
    "osmType": "node",
    "osmId": 5628614983
  },
  {
    "citySlug": "sankt-peterburg",
    "cityName": "Санкт-Петербург",
    "name": "Звёздная",
    "lat": 59.832875,
    "lng": 30.351465,
    "osmType": "node",
    "osmId": 315051539
  },
  {
    "citySlug": "sankt-peterburg",
    "cityName": "Санкт-Петербург",
    "name": "Звенигородская",
    "lat": 59.921906,
    "lng": 30.332765,
    "osmType": "node",
    "osmId": 2080777576
  },
  {
    "citySlug": "sankt-peterburg",
    "cityName": "Санкт-Петербург",
    "name": "Зенит",
    "lat": 59.971956,
    "lng": 30.211915,
    "osmType": "node",
    "osmId": 5614907439
  },
  {
    "citySlug": "sankt-peterburg",
    "cityName": "Санкт-Петербург",
    "name": "Кировский завод",
    "lat": 59.878232,
    "lng": 30.260573,
    "osmType": "node",
    "osmId": 313476034
  },
  {
    "citySlug": "sankt-peterburg",
    "cityName": "Санкт-Петербург",
    "name": "Комендантский проспект",
    "lat": 60.01032,
    "lng": 30.256485,
    "osmType": "node",
    "osmId": 6242445475
  },
  {
    "citySlug": "sankt-peterburg",
    "cityName": "Санкт-Петербург",
    "name": "Крестовский остров",
    "lat": 59.970596,
    "lng": 30.262192,
    "osmType": "node",
    "osmId": 91264383
  },
  {
    "citySlug": "sankt-peterburg",
    "cityName": "Санкт-Петербург",
    "name": "Купчино",
    "lat": 59.829681,
    "lng": 30.375491,
    "osmType": "node",
    "osmId": 298969888
  },
  {
    "citySlug": "sankt-peterburg",
    "cityName": "Санкт-Петербург",
    "name": "Ладожская",
    "lat": 59.931526,
    "lng": 30.442437,
    "osmType": "node",
    "osmId": 94896142
  },
  {
    "citySlug": "sankt-peterburg",
    "cityName": "Санкт-Петербург",
    "name": "Ленинский проспект",
    "lat": 59.850646,
    "lng": 30.268388,
    "osmType": "node",
    "osmId": 344890527
  },
  {
    "citySlug": "sankt-peterburg",
    "cityName": "Санкт-Петербург",
    "name": "Лесная",
    "lat": 59.986547,
    "lng": 30.34566,
    "osmType": "node",
    "osmId": 5385958164
  },
  {
    "citySlug": "sankt-peterburg",
    "cityName": "Санкт-Петербург",
    "name": "Лиговский проспект",
    "lat": 59.921588,
    "lng": 30.359266,
    "osmType": "node",
    "osmId": 94877075
  },
  {
    "citySlug": "sankt-peterburg",
    "cityName": "Санкт-Петербург",
    "name": "Ломоносовская",
    "lat": 59.878826,
    "lng": 30.440148,
    "osmType": "node",
    "osmId": 249302441
  },
  {
    "citySlug": "sankt-peterburg",
    "cityName": "Санкт-Петербург",
    "name": "Маяковская",
    "lat": 59.930542,
    "lng": 30.35762,
    "osmType": "node",
    "osmId": 5369186762
  },
  {
    "citySlug": "sankt-peterburg",
    "cityName": "Санкт-Петербург",
    "name": "Международная",
    "lat": 59.868623,
    "lng": 30.381878,
    "osmType": "node",
    "osmId": 695134915
  },
  {
    "citySlug": "sankt-peterburg",
    "cityName": "Санкт-Петербург",
    "name": "Московская",
    "lat": 59.851403,
    "lng": 30.322382,
    "osmType": "node",
    "osmId": 648222978
  },
  {
    "citySlug": "sankt-peterburg",
    "cityName": "Санкт-Петербург",
    "name": "Московские ворота",
    "lat": 59.892649,
    "lng": 30.318071,
    "osmType": "node",
    "osmId": 249898478
  },
  {
    "citySlug": "sankt-peterburg",
    "cityName": "Санкт-Петербург",
    "name": "Нарвская",
    "lat": 59.899708,
    "lng": 30.274058,
    "osmType": "node",
    "osmId": 313475956
  },
  {
    "citySlug": "sankt-peterburg",
    "cityName": "Санкт-Петербург",
    "name": "Невский проспект",
    "lat": 59.933976,
    "lng": 30.328402,
    "osmType": "node",
    "osmId": 291557399
  },
  {
    "citySlug": "sankt-peterburg",
    "cityName": "Санкт-Петербург",
    "name": "Новочеркасская",
    "lat": 59.929595,
    "lng": 30.415209,
    "osmType": "node",
    "osmId": 94891390
  },
  {
    "citySlug": "sankt-peterburg",
    "cityName": "Санкт-Петербург",
    "name": "Обводный канал",
    "lat": 59.913169,
    "lng": 30.350888,
    "osmType": "node",
    "osmId": 359711518
  },
  {
    "citySlug": "sankt-peterburg",
    "cityName": "Санкт-Петербург",
    "name": "Обухово",
    "lat": 59.849783,
    "lng": 30.459925,
    "osmType": "node",
    "osmId": 248088210
  },
  {
    "citySlug": "sankt-peterburg",
    "cityName": "Санкт-Петербург",
    "name": "Озерки",
    "lat": 60.035319,
    "lng": 30.32103,
    "osmType": "node",
    "osmId": 96459081
  },
  {
    "citySlug": "sankt-peterburg",
    "cityName": "Санкт-Петербург",
    "name": "Парнас",
    "lat": 60.066904,
    "lng": 30.334045,
    "osmType": "node",
    "osmId": 2238315693
  },
  {
    "citySlug": "sankt-peterburg",
    "cityName": "Санкт-Петербург",
    "name": "Петроградская",
    "lat": 59.964913,
    "lng": 30.31284,
    "osmType": "node",
    "osmId": 88802787
  },
  {
    "citySlug": "sankt-peterburg",
    "cityName": "Санкт-Петербург",
    "name": "Пионерская",
    "lat": 60.004309,
    "lng": 30.296348,
    "osmType": "node",
    "osmId": 96453108
  },
  {
    "citySlug": "sankt-peterburg",
    "cityName": "Санкт-Петербург",
    "name": "Площадь Александра Невского 1",
    "lat": 59.923347,
    "lng": 30.386834,
    "osmType": "node",
    "osmId": 94890886
  },
  {
    "citySlug": "sankt-peterburg",
    "cityName": "Санкт-Петербург",
    "name": "Площадь Александра Невского 2",
    "lat": 59.922222,
    "lng": 30.38486,
    "osmType": "node",
    "osmId": 4946155636
  },
  {
    "citySlug": "sankt-peterburg",
    "cityName": "Санкт-Петербург",
    "name": "Площадь Восстания",
    "lat": 59.929993,
    "lng": 30.359024,
    "osmType": "node",
    "osmId": 97036546
  },
  {
    "citySlug": "sankt-peterburg",
    "cityName": "Санкт-Петербург",
    "name": "Площадь Ленина",
    "lat": 59.957216,
    "lng": 30.355349,
    "osmType": "node",
    "osmId": 2036827694
  },
  {
    "citySlug": "sankt-peterburg",
    "cityName": "Санкт-Петербург",
    "name": "Площадь Мужества",
    "lat": 60.001492,
    "lng": 30.367352,
    "osmType": "node",
    "osmId": 2036851507
  },
  {
    "citySlug": "sankt-peterburg",
    "cityName": "Санкт-Петербург",
    "name": "Политехническая",
    "lat": 60.008959,
    "lng": 30.370763,
    "osmType": "node",
    "osmId": 2036864189
  },
  {
    "citySlug": "sankt-peterburg",
    "cityName": "Санкт-Петербург",
    "name": "Приморская",
    "lat": 59.948736,
    "lng": 30.23794,
    "osmType": "node",
    "osmId": 249307184
  },
  {
    "citySlug": "sankt-peterburg",
    "cityName": "Санкт-Петербург",
    "name": "Пролетарская",
    "lat": 59.866264,
    "lng": 30.467311,
    "osmType": "node",
    "osmId": 249304980
  },
  {
    "citySlug": "sankt-peterburg",
    "cityName": "Санкт-Петербург",
    "name": "Проспект Большевиков",
    "lat": 59.921034,
    "lng": 30.464006,
    "osmType": "node",
    "osmId": 211439603
  },
  {
    "citySlug": "sankt-peterburg",
    "cityName": "Санкт-Петербург",
    "name": "Проспект Ветеранов",
    "lat": 59.84195,
    "lng": 30.252018,
    "osmType": "node",
    "osmId": 344890631
  },
  {
    "citySlug": "sankt-peterburg",
    "cityName": "Санкт-Петербург",
    "name": "Проспект Просвещения",
    "lat": 60.049423,
    "lng": 30.332904,
    "osmType": "node",
    "osmId": 5898596228
  },
  {
    "citySlug": "sankt-peterburg",
    "cityName": "Санкт-Петербург",
    "name": "Проспект Славы",
    "lat": 59.856713,
    "lng": 30.395301,
    "osmType": "node",
    "osmId": 4709806342
  },
  {
    "citySlug": "sankt-peterburg",
    "cityName": "Санкт-Петербург",
    "name": "Путиловская",
    "lat": 59.877739,
    "lng": 30.262416,
    "osmType": "node",
    "osmId": 13408956405
  },
  {
    "citySlug": "sankt-peterburg",
    "cityName": "Санкт-Петербург",
    "name": "Пушкинская",
    "lat": 59.921298,
    "lng": 30.332857,
    "osmType": "node",
    "osmId": 2194446558
  },
  {
    "citySlug": "sankt-peterburg",
    "cityName": "Санкт-Петербург",
    "name": "Рыбацкое",
    "lat": 59.83084,
    "lng": 30.500291,
    "osmType": "node",
    "osmId": 248088101
  },
  {
    "citySlug": "sankt-peterburg",
    "cityName": "Санкт-Петербург",
    "name": "Садовая",
    "lat": 59.927603,
    "lng": 30.319382,
    "osmType": "node",
    "osmId": 92580819
  },
  {
    "citySlug": "sankt-peterburg",
    "cityName": "Санкт-Петербург",
    "name": "Сенная площадь",
    "lat": 59.925977,
    "lng": 30.320052,
    "osmType": "node",
    "osmId": 94857612
  },
  {
    "citySlug": "sankt-peterburg",
    "cityName": "Санкт-Петербург",
    "name": "Спасская",
    "lat": 59.926262,
    "lng": 30.317694,
    "osmType": "node",
    "osmId": 1109163153
  },
  {
    "citySlug": "sankt-peterburg",
    "cityName": "Санкт-Петербург",
    "name": "Спортивная",
    "lat": 59.950128,
    "lng": 30.289065,
    "osmType": "node",
    "osmId": 88833360
  },
  {
    "citySlug": "sankt-peterburg",
    "cityName": "Санкт-Петербург",
    "name": "Старая Деревня",
    "lat": 59.987678,
    "lng": 30.255635,
    "osmType": "node",
    "osmId": 91264384
  },
  {
    "citySlug": "sankt-peterburg",
    "cityName": "Санкт-Петербург",
    "name": "Технологический институт 1",
    "lat": 59.915188,
    "lng": 30.317338,
    "osmType": "node",
    "osmId": 1669571976
  },
  {
    "citySlug": "sankt-peterburg",
    "cityName": "Санкт-Петербург",
    "name": "Технологический институт 2",
    "lat": 59.915335,
    "lng": 30.318387,
    "osmType": "node",
    "osmId": 1669571977
  },
  {
    "citySlug": "sankt-peterburg",
    "cityName": "Санкт-Петербург",
    "name": "Удельная",
    "lat": 60.017931,
    "lng": 30.318159,
    "osmType": "node",
    "osmId": 90551453
  },
  {
    "citySlug": "sankt-peterburg",
    "cityName": "Санкт-Петербург",
    "name": "Улица Дыбенко",
    "lat": 59.909009,
    "lng": 30.481764,
    "osmType": "node",
    "osmId": 211439601
  },
  {
    "citySlug": "sankt-peterburg",
    "cityName": "Санкт-Петербург",
    "name": "Чёрная речка",
    "lat": 59.987227,
    "lng": 30.300904,
    "osmType": "node",
    "osmId": 96449579
  },
  {
    "citySlug": "sankt-peterburg",
    "cityName": "Санкт-Петербург",
    "name": "Чернышевская",
    "lat": 59.94311,
    "lng": 30.360777,
    "osmType": "node",
    "osmId": 4179047476
  },
  {
    "citySlug": "sankt-peterburg",
    "cityName": "Санкт-Петербург",
    "name": "Чкаловская",
    "lat": 59.959334,
    "lng": 30.29242,
    "osmType": "node",
    "osmId": 88833366
  },
  {
    "citySlug": "sankt-peterburg",
    "cityName": "Санкт-Петербург",
    "name": "Шушары",
    "lat": 59.82007,
    "lng": 30.432824,
    "osmType": "node",
    "osmId": 4709806344
  },
  {
    "citySlug": "sankt-peterburg",
    "cityName": "Санкт-Петербург",
    "name": "Электросила",
    "lat": 59.88026,
    "lng": 30.319072,
    "osmType": "node",
    "osmId": 249904416
  },
  {
    "citySlug": "sankt-peterburg",
    "cityName": "Санкт-Петербург",
    "name": "Юго-Западная",
    "lat": 59.86003,
    "lng": 30.231328,
    "osmType": "node",
    "osmId": 3361808916
  }
];

const EARTH_RADIUS_METERS = 6_371_000;

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}

export function getDistanceMeters(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number },
) {
  const dLat = toRadians(to.lat - from.lat);
  const dLng = toRadians(to.lng - from.lng);
  const fromLat = toRadians(from.lat);
  const toLat = toRadians(to.lat);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(fromLat) * Math.cos(toLat) * Math.sin(dLng / 2) ** 2;

  return 2 * EARTH_RADIUS_METERS * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function findNearestMetroStation(params: {
  cityName?: string | null;
  citySlug?: string | null;
  lat: number;
  lng: number;
  maxDistanceMeters?: number;
}): NearbyMetroStation | null {
  const maxDistanceMeters = params.maxDistanceMeters ?? 1_500;
  const stations = METRO_STATIONS.filter((station) => {
    if (params.citySlug) {
      return station.citySlug === params.citySlug;
    }

    if (params.cityName) {
      return station.cityName.toLowerCase() === params.cityName.toLowerCase();
    }

    return true;
  });

  let nearest: NearbyMetroStation | null = null;

  for (const station of stations) {
    const distanceMeters = Math.round(
      getDistanceMeters({ lat: params.lat, lng: params.lng }, station),
    );

    if (distanceMeters > maxDistanceMeters) {
      continue;
    }

    if (!nearest || distanceMeters < nearest.distanceMeters) {
      nearest = { ...station, distanceMeters };
    }
  }

  return nearest;
}
