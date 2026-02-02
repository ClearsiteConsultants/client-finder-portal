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
}

/**
 * Check if a business name matches any entry in the exclude list
 */
export async function checkBusinessExclusion(
  businessName: string
): Promise<ExclusionCheckResult> {
  const normalized = normalizeBusinessName(businessName);
  
  // Query the database for matching excluded businesses
  const excludedBusiness = await prisma.excludedBusiness.findFirst({
    where: {
      businessNameNormalized: normalized,
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
    };
  }
  
  return {
    isExcluded: false,
  };
}

/**
 * Check multiple businesses at once (batch operation)
 */
export async function checkBusinessExclusionBatch(
  businessNames: string[]
): Promise<Map<string, ExclusionCheckResult>> {
  const normalizedNames = businessNames.map(normalizeBusinessName);
  
  // Fetch all matching excluded businesses in one query
  const excludedBusinesses = await prisma.excludedBusiness.findMany({
    where: {
      businessNameNormalized: {
        in: normalizedNames,
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
    
    results.set(
      originalName,
      excludedMap.get(normalized) || { isExcluded: false }
    );
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
  
  return excludedBusiness.id;
}

/**
 * Remove a business from the exclude list
 */
export async function removeBusinessFromExcludeList(
  excludedBusinessId: string
): Promise<void> {
  await prisma.excludedBusiness.delete({
    where: {
      id: excludedBusinessId,
    },
  });
}

/**
 * Get all excluded businesses
 */
export async function getExcludedBusinesses(): Promise<
  Array<{
    id: string;
    businessName: string;
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
    businessName: item.businessName,
    reason: item.reason,
    addedBy: item.addedByUser.name || item.addedByUser.email,
    createdAt: item.createdAt,
  }));
}
