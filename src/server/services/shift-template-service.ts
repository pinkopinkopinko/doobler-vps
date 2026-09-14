import { prisma } from "@/lib/prisma";
import { shiftTemplateSchema } from "@/lib/validations/shift-template";

const shiftTemplateSelect = {
  id: true,
  name: true,
  pickupPointId: true,
  regionId: true,
  cityId: true,
  marketplaceId: true,
  title: true,
  type: true,
  district: true,
  address: true,
  addressSuggestionUri: true,
  landmark: true,
  description: true,
  startTime: true,
  endTime: true,
  paymentAmountRub: true,
  paymentType: true,
  experienceLevelRequired: true,
  isUrgent: true,
  updatedAt: true,
} as const;

async function getAccessiblePickupPoint(pickupPointId: string, userId: string) {
  return prisma.pickupPoint.findFirst({
    where: {
      id: pickupPointId,
      OR: [
        { ownerUserId: userId },
        {
          managerAccesses: {
            some: {
              managerUserId: userId,
            },
          },
        },
      ],
    },
    select: {
      id: true,
      marketplaceId: true,
      regionId: true,
      cityId: true,
      district: true,
      address: true,
      landmark: true,
    },
  });
}

export async function listShiftTemplates(createdByUserId: string) {
  return prisma.shiftTemplate.findMany({
    where: { createdByUserId },
    select: shiftTemplateSelect,
    orderBy: [{ updatedAt: "desc" }, { name: "asc" }],
  });
}

export async function saveShiftTemplate(input: unknown, createdByUserId: string) {
  const data = shiftTemplateSchema.parse(input);
  const selectedPickupPointId = data.pickupPointId?.trim() || null;
  const accessiblePickupPoint = selectedPickupPointId
    ? await getAccessiblePickupPoint(selectedPickupPointId, createdByUserId)
    : null;

  if (selectedPickupPointId && !accessiblePickupPoint) {
    throw new Error("PICKUP_POINT_FORBIDDEN");
  }

  const templateData = accessiblePickupPoint
    ? {
        ...data,
        pickupPointId: accessiblePickupPoint.id,
        marketplaceId: accessiblePickupPoint.marketplaceId,
        cityId: accessiblePickupPoint.cityId,
        regionId: accessiblePickupPoint.regionId,
        district: accessiblePickupPoint.district ?? data.district,
        address: accessiblePickupPoint.address,
        addressSuggestionUri: `pickup-point:${accessiblePickupPoint.id}`,
        landmark: accessiblePickupPoint.landmark ?? data.landmark ?? null,
      }
    : {
        ...data,
        pickupPointId: null,
      };

  return prisma.shiftTemplate.upsert({
    where: {
      createdByUserId_name: {
        createdByUserId,
        name: templateData.name,
      },
    },
    create: {
      createdByUserId,
      name: templateData.name,
      pickupPointId: templateData.pickupPointId,
      regionId: templateData.regionId,
      cityId: templateData.cityId,
      marketplaceId: templateData.marketplaceId,
      title: templateData.title,
      type: templateData.type,
      district: templateData.district,
      address: templateData.address,
      addressSuggestionUri: templateData.addressSuggestionUri ?? null,
      landmark: templateData.landmark ?? null,
      description: templateData.description,
      startTime: templateData.startAt,
      endTime: templateData.endAt,
      paymentAmountRub: templateData.paymentAmountRub,
      paymentType: templateData.paymentType,
      experienceLevelRequired: templateData.experienceLevelRequired,
      isUrgent: templateData.isUrgent,
    },
    update: {
      pickupPointId: templateData.pickupPointId,
      regionId: templateData.regionId,
      cityId: templateData.cityId,
      marketplaceId: templateData.marketplaceId,
      title: templateData.title,
      type: templateData.type,
      district: templateData.district,
      address: templateData.address,
      addressSuggestionUri: templateData.addressSuggestionUri ?? null,
      landmark: templateData.landmark ?? null,
      description: templateData.description,
      startTime: templateData.startAt,
      endTime: templateData.endAt,
      paymentAmountRub: templateData.paymentAmountRub,
      paymentType: templateData.paymentType,
      experienceLevelRequired: templateData.experienceLevelRequired,
      isUrgent: templateData.isUrgent,
    },
    select: shiftTemplateSelect,
  });
}

export async function deleteShiftTemplate(id: string, createdByUserId: string) {
  const deleted = await prisma.shiftTemplate.deleteMany({
    where: { id, createdByUserId },
  });

  if (deleted.count === 0) {
    throw new Error("NOT_FOUND");
  }
}
