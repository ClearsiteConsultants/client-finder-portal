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
