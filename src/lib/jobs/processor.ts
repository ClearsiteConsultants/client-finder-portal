/**
 * Job Processor - Executes validation and scraping jobs
 */

import { prisma } from '../prisma';
import { ValidationJobType } from '@prisma/client';
import { validateWebsite } from '../validation/website-validator';
import { scrapeEmailsFromWebsite } from '../scraping/email-scraper';
import { scrapeSocialMediaFromWebsite } from '../scraping/social-media-scraper';

export interface ProcessJobResult {
  success: boolean;
  error?: string;
}

export class JobProcessor {
  /**
   * Process a website validation job
   */
  private async processWebsiteValidation(businessId: string): Promise<ProcessJobResult> {
    try {
      const business = await prisma.business.findUnique({
        where: { id: businessId },
      });

      if (!business) {
        return { success: false, error: 'Business not found' };
      }

      if (!business.website) {
        // No website to validate
        await prisma.business.update({
          where: { id: businessId },
          data: { websiteStatus: 'no_website' },
        });
        return { success: true };
      }

      // Validate the website
      const result = await validateWebsite(business.website);

      // Update business with validation results
      await prisma.business.update({
        where: { id: businessId },
        data: {
          websiteStatus: result.status,
        },
      });

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error during validation',
      };
    }
  }

  /**
   * Process an email scraping job
   */
  private async processEmailScraping(businessId: string): Promise<ProcessJobResult> {
    try {
      const business = await prisma.business.findUnique({
        where: { id: businessId },
      });

      if (!business) {
        return { success: false, error: 'Business not found' };
      }

      if (!business.website) {
        // No website to scrape emails from
        return { success: true };
      }

      // Scrape emails from the website
      const result = await scrapeEmailsFromWebsite(business.website);

      // Save discovered emails to ContactInfo
      for (const emailInfo of result.emails) {
        // Check if contact info already exists for this business
        const existing = await prisma.contactInfo.findFirst({
          where: {
            businessId: business.id,
            email: emailInfo.email,
          },
        });

        if (existing) {
          // Update existing record
          await prisma.contactInfo.update({
            where: { id: existing.id },
            data: {
              emailSource: emailInfo.source,
              emailConfidence: emailInfo.confidence,
            },
          });
        } else {
          // Create new record
          await prisma.contactInfo.create({
            data: {
              businessId: business.id,
              email: emailInfo.email,
              emailSource: emailInfo.source,
              emailConfidence: emailInfo.confidence,
            },
          });
        }
      }

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error during email scraping',
      };
    }
  }

  /**
   * Process a social media scraping job
   */
  private async processSocialScraping(businessId: string): Promise<ProcessJobResult> {
    try {
      const business = await prisma.business.findUnique({
        where: { id: businessId },
      });

      if (!business) {
        return { success: false, error: 'Business not found' };
      }

      if (!business.website) {
        // No website to scrape social media from
        return { success: true };
      }

      // Scrape social media links
      const result = await scrapeSocialMediaFromWebsite(business.website);

      // Check if contact info already exists for this business
      const existing = await prisma.contactInfo.findFirst({
        where: {
          businessId: business.id,
        },
      });

      if (existing) {
        // Update existing record with social media links
        await prisma.contactInfo.update({
          where: { id: existing.id },
          data: {
            facebookUrl: result.facebookUrl || existing.facebookUrl,
            instagramUrl: result.instagramUrl || existing.instagramUrl,
            linkedinUrl: result.linkedinUrl || existing.linkedinUrl,
          },
        });
      } else if (result.facebookUrl || result.instagramUrl || result.linkedinUrl) {
        // Create new record only if we found at least one social media link
        await prisma.contactInfo.create({
          data: {
            businessId: business.id,
            facebookUrl: result.facebookUrl,
            instagramUrl: result.instagramUrl,
            linkedinUrl: result.linkedinUrl,
          },
        });
      }

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error during social scraping',
      };
    }
  }

  /**
   * Process a job based on its type
   */
  async processJob(businessId: string, jobType: ValidationJobType): Promise<ProcessJobResult> {
    switch (jobType) {
      case 'website_validation':
        return this.processWebsiteValidation(businessId);
      case 'email_scraping':
        return this.processEmailScraping(businessId);
      case 'social_scraping':
        return this.processSocialScraping(businessId);
      default:
        return {
          success: false,
          error: `Unknown job type: ${jobType}`,
        };
    }
  }
}
