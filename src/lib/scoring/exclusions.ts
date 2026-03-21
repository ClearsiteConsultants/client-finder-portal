/**
 * Business Exclusion Matcher
 * 
 * Handles checking if a business name matches the user-managed exclude list.
 * Uses normalized name comparison for case-insensitive and whitespace-tolerant matching.
 */

import { prisma } from '../prisma';
import { normalizeBusinessName } from './scorer';

export interface ExclusionCheckResult {
  isExcluded: boolean;
  excludedBusinessId?: string;
  reason?: string;
  exclusionMode?: 'business_name' | 'business_type';
  matchedValue?: string;
}

const BUSINESS_TYPE_PREFIX = 'type:';
const AUTO_REJECTED_REASON = 'Auto-rejected by exclusion list';

function normalizeBusinessType(businessType: string): string {
  return businessType.trim().toLowerCase();
}

function toBusinessTypeToken(businessType: string): string {
  return `${BUSINESS_TYPE_PREFIX}${normalizeBusinessType(businessType)}`;
}

function isBusinessTypeToken(value: string): boolean {
  return value.startsWith(BUSINESS_TYPE_PREFIX);
}

function tokenToBusinessType(value: string): string {
  return value.slice(BUSINESS_TYPE_PREFIX.length);
}

function matchesNameExclusionRule(name: string, normalizedExcludedName: string): boolean {
  const normalizedBusinessName = normalizeBusinessName(name);
  const candidates = buildNormalizationCandidates(normalizedBusinessName);
  return candidates.includes(normalizedExcludedName);
}

function matchesTypeExclusionRule(
  businessTypes: string[],
  normalizedExcludedType: string
): boolean {
  return businessTypes.some(
    (businessType) => normalizeBusinessType(businessType) === normalizedExcludedType
  );
}

async function getRemainingExclusionSets(): Promise<{
  excludedBusinessNames: Set<string>;
  excludedBusinessTypes: Set<string>;
}> {
  const remainingExclusions = await prisma.excludedBusiness.findMany({
    select: {
      businessNameNormalized: true,
    },
  });

  const excludedBusinessNames = new Set<string>();
  const excludedBusinessTypes = new Set<string>();

  for (const exclusion of remainingExclusions) {
    if (isBusinessTypeToken(exclusion.businessNameNormalized)) {
      excludedBusinessTypes.add(tokenToBusinessType(exclusion.businessNameNormalized));
      continue;
    }

    excludedBusinessNames.add(exclusion.businessNameNormalized);
  }

  return {
    excludedBusinessNames,
    excludedBusinessTypes,
  };
}

function isBusinessStillExcluded(
  business: { name: string; businessTypes: string[] },
  excludedBusinessNames: Set<string>,
  excludedBusinessTypes: Set<string>
): boolean {
  const normalizedBusinessName = normalizeBusinessName(business.name);
  const nameCandidates = buildNormalizationCandidates(normalizedBusinessName);

  for (const candidate of nameCandidates) {
    if (excludedBusinessNames.has(candidate)) {
      return true;
    }
  }

  for (const businessType of business.businessTypes) {
    if (excludedBusinessTypes.has(normalizeBusinessType(businessType))) {
      return true;
    }
  }

  return false;
}

async function applyExclusionToMatchingBusinessesByName(
  normalizedExcludedName: string,
  userId: string
): Promise<void> {
  const businesses = await prisma.business.findMany({
    select: {
      id: true,
      name: true,
    },
  });

  const matchingBusinessIds = businesses
    .filter((business) => matchesNameExclusionRule(business.name, normalizedExcludedName))
    .map((business) => business.id);

  if (!matchingBusinessIds.length) {
    return;
  }

  await prisma.business.updateMany({
    where: {
      id: { in: matchingBusinessIds },
      leadStatus: {
        not: 'rejected',
      },
    },
    data: {
      leadStatus: 'rejected',
      rejectedAt: new Date(),
      rejectedByUserId: userId,
      rejectedReason: AUTO_REJECTED_REASON,
    },
  });
}

async function applyExclusionToMatchingBusinessesByType(
  normalizedExcludedType: string,
  userId: string
): Promise<void> {
  const businesses = await prisma.business.findMany({
    select: {
      id: true,
      businessTypes: true,
    },
  });

  const matchingBusinessIds = businesses
    .filter((business) =>
      matchesTypeExclusionRule(business.businessTypes, normalizedExcludedType)
    )
    .map((business) => business.id);

  if (!matchingBusinessIds.length) {
    return;
  }

  await prisma.business.updateMany({
    where: {
      id: { in: matchingBusinessIds },
      leadStatus: {
        not: 'rejected',
      },
    },
    data: {
      leadStatus: 'rejected',
      rejectedAt: new Date(),
      rejectedByUserId: userId,
      rejectedReason: AUTO_REJECTED_REASON,
    },
  });
}

async function restorePendingForBusinessesNoLongerExcludedByName(
  normalizedRemovedName: string
): Promise<void> {
  const candidateBusinesses = await prisma.business.findMany({
    where: {
      leadStatus: 'rejected',
      rejectedReason: AUTO_REJECTED_REASON,
    },
    select: {
      id: true,
      name: true,
      businessTypes: true,
    },
  });

  const affectedBusinesses = candidateBusinesses.filter((business) =>
    matchesNameExclusionRule(business.name, normalizedRemovedName)
  );

  if (!affectedBusinesses.length) {
    return;
  }

  const { excludedBusinessNames, excludedBusinessTypes } =
    await getRemainingExclusionSets();

  const businessIdsToRestore = affectedBusinesses
    .filter(
      (business) =>
        !isBusinessStillExcluded(business, excludedBusinessNames, excludedBusinessTypes)
    )
    .map((business) => business.id);

  if (!businessIdsToRestore.length) {
    return;
  }

  await prisma.business.updateMany({
    where: {
      id: {
        in: businessIdsToRestore,
      },
    },
    data: {
      leadStatus: 'pending',
      rejectedAt: null,
      rejectedByUserId: null,
      rejectedReason: null,
    },
  });
}

async function restorePendingForBusinessesNoLongerExcludedByType(
  normalizedRemovedType: string
): Promise<void> {
  const candidateBusinesses = await prisma.business.findMany({
    where: {
      leadStatus: 'rejected',
      rejectedReason: AUTO_REJECTED_REASON,
    },
    select: {
      id: true,
      name: true,
      businessTypes: true,
    },
  });

  const affectedBusinesses = candidateBusinesses.filter((business) =>
    matchesTypeExclusionRule(business.businessTypes, normalizedRemovedType)
  );

  if (!affectedBusinesses.length) {
    return;
  }

  const { excludedBusinessNames, excludedBusinessTypes } =
    await getRemainingExclusionSets();

  const businessIdsToRestore = affectedBusinesses
    .filter(
      (business) =>
        !isBusinessStillExcluded(business, excludedBusinessNames, excludedBusinessTypes)
    )
    .map((business) => business.id);

  if (!businessIdsToRestore.length) {
    return;
  }

  await prisma.business.updateMany({
    where: {
      id: {
        in: businessIdsToRestore,
      },
    },
    data: {
      leadStatus: 'pending',
      rejectedAt: null,
      rejectedByUserId: null,
      rejectedReason: null,
    },
  });
}

export async function getExcludedBusinessTypes(): Promise<string[]> {
  const excludedTypes = await prisma.excludedBusiness.findMany({
    where: {
      businessNameNormalized: {
        startsWith: BUSINESS_TYPE_PREFIX,
      },
    },
    select: {
      businessNameNormalized: true,
    },
  });

  return Array.from(
    new Set(excludedTypes.map((row) => tokenToBusinessType(row.businessNameNormalized)))
  );
}

function buildNormalizationCandidates(normalizedName: string): string[] {
  const compact = normalizedName.replace(/\s+/g, '');
  const noStandaloneNumbers = normalizedName
    .replace(/\b\d+\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  const compactNoNumbers = noStandaloneNumbers.replace(/\s+/g, '');

  return Array.from(
    new Set(
      [normalizedName, compact, noStandaloneNumbers, compactNoNumbers].filter(Boolean)
    )
  );
}

/**
 * Check if a business name matches any entry in the exclude list
 */
export async function checkBusinessExclusion(
  businessName: string
): Promise<ExclusionCheckResult> {
  const normalized = normalizeBusinessName(businessName);
  const candidates = buildNormalizationCandidates(normalized);
  
  // Query the database for matching excluded businesses
  const excludedBusiness = await prisma.excludedBusiness.findFirst({
    where: {
      businessNameNormalized: {
        in: candidates,
      },
    },
    select: {
      id: true,
      reason: true,
    },
  });
  
  if (excludedBusiness) {
    return {
      isExcluded: true,
      excludedBusinessId: excludedBusiness.id,
      reason: excludedBusiness.reason || undefined,
      exclusionMode: 'business_name',
      matchedValue: businessName,
    };
  }
  
  return {
    isExcluded: false,
  };
}

/**
 * Check if any business types match entries in the exclude list.
 */
export async function checkBusinessTypeExclusion(
  businessTypes: string[]
): Promise<ExclusionCheckResult> {
  if (!businessTypes.length) {
    return { isExcluded: false };
  }

  const tokens = Array.from(
    new Set(
      businessTypes
        .map((type) => type?.trim())
        .filter((type): type is string => !!type)
        .map(toBusinessTypeToken)
    )
  );

  if (!tokens.length) {
    return { isExcluded: false };
  }

  const excludedBusiness = await prisma.excludedBusiness.findFirst({
    where: {
      businessNameNormalized: {
        in: tokens,
      },
    },
    select: {
      id: true,
      reason: true,
      businessNameNormalized: true,
    },
  });

  if (!excludedBusiness) {
    return { isExcluded: false };
  }

  return {
    isExcluded: true,
    excludedBusinessId: excludedBusiness.id,
    reason: excludedBusiness.reason || undefined,
    exclusionMode: 'business_type',
    matchedValue: tokenToBusinessType(excludedBusiness.businessNameNormalized),
  };
}

/**
 * Check multiple businesses at once (batch operation)
 */
export async function checkBusinessExclusionBatch(
  businessNames: string[]
): Promise<Map<string, ExclusionCheckResult>> {
  const normalizedNames = businessNames.map(normalizeBusinessName);
  const candidateMap = new Map<string, string[]>();
  for (const normalized of normalizedNames) {
    candidateMap.set(normalized, buildNormalizationCandidates(normalized));
  }
  const allCandidates = Array.from(new Set(Array.from(candidateMap.values()).flat()));
  
  // Fetch all matching excluded businesses in one query
  const excludedBusinesses = await prisma.excludedBusiness.findMany({
    where: {
      businessNameNormalized: {
        in: allCandidates,
      },
    },
    select: {
      businessNameNormalized: true,
      id: true,
      reason: true,
    },
  });
  
  // Create a map of normalized name to exclusion result
  const excludedMap = new Map<string, ExclusionCheckResult>();
  for (const excluded of excludedBusinesses) {
    excludedMap.set(excluded.businessNameNormalized, {
      isExcluded: true,
      excludedBusinessId: excluded.id,
      reason: excluded.reason || undefined,
    });
  }
  
  // Build result map with original business names
  const results = new Map<string, ExclusionCheckResult>();
  for (let i = 0; i < businessNames.length; i++) {
    const originalName = businessNames[i];
    const normalized = normalizedNames[i];
    const candidates = candidateMap.get(normalized) || [normalized];

    let exclusion = excludedMap.get(normalized);
    if (!exclusion) {
      for (const candidate of candidates) {
        const match = excludedMap.get(candidate);
        if (match) {
          exclusion = match;
          break;
        }
      }
    }
    
    results.set(
      originalName,
      exclusion || { isExcluded: false }
    );
  }
  
  return results;
}

/**
 * Check multiple businesses against both name and type exclusion rules.
 */
export async function checkBusinessExclusionBatchWithTypes(
  businesses: Array<{ name: string; businessTypes: string[] }>
): Promise<Map<string, ExclusionCheckResult>> {
  const nameResults = await checkBusinessExclusionBatch(businesses.map((b) => b.name));

  const typeTokens = Array.from(
    new Set(
      businesses
        .flatMap((business) => business.businessTypes)
        .map((type) => type?.trim())
        .filter((type): type is string => !!type)
        .map(toBusinessTypeToken)
    )
  );

  const excludedTypeRows = typeTokens.length
    ? await prisma.excludedBusiness.findMany({
        where: {
          businessNameNormalized: {
            in: typeTokens,
          },
        },
        select: {
          id: true,
          reason: true,
          businessNameNormalized: true,
        },
      })
    : [];

  const typeMap = new Map(
    excludedTypeRows.map((row) => [
      row.businessNameNormalized,
      {
        isExcluded: true,
        excludedBusinessId: row.id,
        reason: row.reason || undefined,
        exclusionMode: 'business_type' as const,
        matchedValue: tokenToBusinessType(row.businessNameNormalized),
      },
    ])
  );

  const results = new Map<string, ExclusionCheckResult>();
  for (const business of businesses) {
    const nameResult = nameResults.get(business.name);
    if (nameResult?.isExcluded) {
      results.set(business.name, {
        ...nameResult,
        exclusionMode: 'business_name',
        matchedValue: business.name,
      });
      continue;
    }

    let typeResult: ExclusionCheckResult | undefined;
    for (const type of business.businessTypes) {
      const token = toBusinessTypeToken(type);
      const match = typeMap.get(token);
      if (match) {
        typeResult = match;
        break;
      }
    }

    results.set(business.name, typeResult || { isExcluded: false });
  }

  return results;
}

/**
 * Add a business to the exclude list
 */
export async function addBusinessToExcludeList(
  businessName: string,
  userId: string,
  reason?: string
): Promise<string> {
  const normalized = normalizeBusinessName(businessName);
  
  // Check if already excluded
  const existing = await prisma.excludedBusiness.findFirst({
    where: {
      businessNameNormalized: normalized,
    },
  });
  
  if (existing) {
    await applyExclusionToMatchingBusinessesByName(normalized, userId);
    return existing.id;
  }
  
  // Add to exclude list
  const excludedBusiness = await prisma.excludedBusiness.create({
    data: {
      businessName,
      businessNameNormalized: normalized,
      reason,
      addedByUserId: userId,
    },
  });

  await applyExclusionToMatchingBusinessesByName(normalized, userId);
  
  return excludedBusiness.id;
}

/**
 * Add a business type to the exclude list.
 */
export async function addBusinessTypeToExcludeList(
  businessType: string,
  userId: string,
  reason?: string
): Promise<string> {
  const normalizedType = normalizeBusinessType(businessType);
  const token = toBusinessTypeToken(normalizedType);

  const existing = await prisma.excludedBusiness.findFirst({
    where: {
      businessNameNormalized: token,
    },
  });

  if (existing) {
    await applyExclusionToMatchingBusinessesByType(normalizedType, userId);
    return existing.id;
  }

  const excludedBusiness = await prisma.excludedBusiness.create({
    data: {
      businessName: normalizedType,
      businessNameNormalized: token,
      reason,
      addedByUserId: userId,
    },
  });

  await applyExclusionToMatchingBusinessesByType(normalizedType, userId);

  return excludedBusiness.id;
}

/**
 * Remove a business from the exclude list
 */
export async function removeBusinessFromExcludeList(
  excludedBusinessId: string
): Promise<void> {
  const deletedExclusion = await prisma.excludedBusiness.delete({
    where: {
      id: excludedBusinessId,
    },
  });

  if (isBusinessTypeToken(deletedExclusion.businessNameNormalized)) {
    await restorePendingForBusinessesNoLongerExcludedByType(
      tokenToBusinessType(deletedExclusion.businessNameNormalized)
    );
    return;
  }

  await restorePendingForBusinessesNoLongerExcludedByName(
    deletedExclusion.businessNameNormalized
  );
}

/**
 * Get all excluded businesses
 */
export async function getExcludedBusinesses(): Promise<
  Array<{
    id: string;
    businessName: string;
    exclusionMode: 'business_name' | 'business_type';
    businessType: string | null;
    reason: string | null;
    addedBy: string;
    createdAt: Date;
  }>
> {
  const excluded = await prisma.excludedBusiness.findMany({
    include: {
      addedByUser: {
        select: {
          name: true,
          email: true,
        },
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
  });
  
  return excluded.map(item => ({
    id: item.id,
    businessName: isBusinessTypeToken(item.businessNameNormalized)
      ? tokenToBusinessType(item.businessNameNormalized)
      : item.businessName,
    exclusionMode: isBusinessTypeToken(item.businessNameNormalized)
      ? 'business_type'
      : 'business_name',
    businessType: isBusinessTypeToken(item.businessNameNormalized)
      ? tokenToBusinessType(item.businessNameNormalized)
      : null,
    reason: item.reason,
    addedBy: item.addedByUser.name || item.addedByUser.email,
    createdAt: item.createdAt,
  }));
}
