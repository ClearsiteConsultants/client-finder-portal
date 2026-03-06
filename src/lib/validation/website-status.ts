import { WebsiteStatus } from '@prisma/client';
import { validateWebsite } from './website-validator';

export interface SocialProfiles {
  facebookUrl?: string | null;
  instagramUrl?: string | null;
  linkedinUrl?: string | null;
}

function hasAnySocialProfile(socialProfiles: SocialProfiles): boolean {
  return Boolean(
    socialProfiles.facebookUrl?.trim() ||
      socialProfiles.instagramUrl?.trim() ||
      socialProfiles.linkedinUrl?.trim()
  );
}

export function getNonWebsiteStatus(socialProfiles: SocialProfiles): WebsiteStatus {
  return hasAnySocialProfile(socialProfiles) ? 'social_only' : 'no_website';
}

export function getInitialGoogleMapsStatus(hasWebsite: boolean): WebsiteStatus {
  // Google imports do not include social URLs. Use a deterministic, non-unknown
  // status and let background website validation refine this for website leads.
  return hasWebsite ? 'technical_issues' : 'no_website';
}

export async function deriveWebsiteStatus(params: {
  website?: string | null;
  socialProfiles?: SocialProfiles;
}): Promise<WebsiteStatus> {
  const website = params.website?.trim() || null;
  const socialProfiles = params.socialProfiles ?? {};

  if (!website) {
    return getNonWebsiteStatus(socialProfiles);
  }

  const validation = await validateWebsite(website);
  return validation.status;
}
