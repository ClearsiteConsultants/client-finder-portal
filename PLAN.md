# Client Finder Portal - Project Plan

## Project Overview

An automated lead discovery and outreach management system to help identify small businesses that need website services. The tool searches for businesses using Google Maps API, validates their web presence, prioritizes businesses without websites or with technical issues, and manages compliant multi-channel outreach campaigns.

## Technology Stack

- **Frontend**: React, Next.js 14+, TypeScript, Tailwind CSS
- **Backend**: Next.js API routes, TypeScript
- **Database**: PostgreSQL with Prisma ORM
- **Authentication**: NextAuth.js (simple shared team access)
- **Deployment**: Vercel
- **External APIs**:
  - Google Maps Places API (business discovery, contact info)
  - SendGrid or AWS SES (email delivery)
  - Twilio (optional, for future SMS capabilities)

## Core Features

### 1. Business Discovery (Google Maps Integration)

**Search Capabilities**:
- Location-based search (city, ZIP code, radius)
- Business type filtering (restaurants, retail, services, professionals)
- Review count filtering (target 10-200 reviews for small businesses)

**Data Collection**:
- Business name
- Phone number (always captured from `formatted_phone_number`)
- Website URL (capture even if null/empty - these are VIP leads)
- Address (full formatted address)
- Business types/categories
- Total review count
- Place ID (unique identifier)

**API Cost Optimization**:
- Use field masking to request only needed fields
- Cache results for 30 days (within Google's ToS)
- Target staying within $200/month free tier (~10,000 searches)
- Estimated cost: $0.017-0.020 per business lookup

### 2. Small Business Detection & Scoring

**Scoring Algorithm** (0-100 scale):
- Review count 10-200: +30 points
- Not in known chains database: +30 points
- Not in user exclude list: Required (auto-reject if listed)
- Unique domain (not shared corporate site): +20 points
- Target business types: +20 points
- **Threshold**: Score >70 = qualified lead

**Chain/Enterprise Filtering**:
- Maintain static list of major franchises/chains ([data/known-chains.json](data/known-chains.json))
- User-managed exclude list stored in database
- UI to quickly add business names to exclude list during review

**Business Types to Target**:
- Restaurants, cafes, bars
- Retail stores, boutiques
- Salons, spas, gyms
- Professional services (dentists, doctors, lawyers, accountants)
- Local services (plumbers, electricians, contractors)

**Business Types to Avoid**:
- Banks, government offices
- Gas stations, airports
- Large corporate entities

### 3. Website & Online Presence Validation

**Website Status Categories**:
- **no_website**: No website found (TOP PRIORITY - VIP leads)
- **social_only**: No website but has social media profiles
- **broken**: Website exists but returns errors (404, 500, timeout)
- **technical_issues**: Loads but has problems (no SSL, slow >5s, not mobile-responsive)
- **outdated**: Detectable issues (mixed content, broken links)
- **acceptable**: Functioning website with no obvious issues

**Technical Validation Checks**:
- HTTP response code (200 = success)
- SSL certificate present and valid
- Page load time (<5 seconds threshold)
- Mobile-responsive (viewport meta tag check)
- Broken links on homepage
- Mixed content warnings

**Social Media Profile Capture**:
- Detect and store Facebook, Instagram, LinkedIn profile URLs
- Mark businesses with social-only presence as prime targets
- These are businesses ready to graduate to a real website

**Website Scraping for Contact Info**:
- Extract email addresses from business websites
- Respect robots.txt
- Common patterns: mailto: links, contact pages, footer info
- Fallback validation: info@domain, contact@domain, hello@domain
- Store source: "scraped", "pattern_match", "manual"

### 4. Manual Review & Approval Workflow

**Review Queue** ([app/review/page.tsx](app/review/page.tsx)):
- Display pending businesses with scores
- Show website status with visual indicators
- Display available contact info (email, phone, social profiles)
- **Prioritize**: Filter/sort to show "no_website" and "social_only" at top
- Quick actions: Approve, Reject, Add to Exclude List
- Bulk operations for efficiency

**Status States**:
- `pending`: Newly discovered, awaiting review
- `approved`: Ready for outreach
- `rejected`: Not a good fit
- `contacted`: Outreach initiated
- `responded`: Lead engaged
- `inactive`: No response after 2-touch sequence

**Exclude List Management**:
- Add business names directly from review queue
- Dedicated UI to manually add/remove excluded businesses
- Track who added and when
- Prevent future discoveries of excluded businesses

### 5. Contact Information Management

**Contact Data Structure**:
- Email address (scraped or validated pattern)
- Phone number (from Google Maps API)
- Social media profiles (Facebook, Instagram, LinkedIn URLs)
- Website URL (even if status is "no_website" - for later checking)
- Source tracking: "google_maps", "website_scrape", "manual_entry"

**For Businesses Without Websites**:
- Always display phone number prominently
- Show available social media profiles
- Flag as "Hot Lead - No Website"
- Enable manual contact methods (phone, social messaging)

### 6. Multi-Channel Outreach Management

**Email Outreach (Automated)**:

**2-Touch Sequence**:
- **Touch 1**: Initial introduction email
- **Wait**: 7 days
- **Touch 2**: Single follow-up (only if no response to Touch 1)
- **Mark Inactive**: After Touch 2 with no response

**CAN-SPAM Compliance Requirements**:
- Accurate "From" and "Reply-To" email addresses
- Truthful subject lines (no deceptive content)
- Company physical address in footer
- Clear unsubscribe link in every email
- Honor unsubscribe within 10 business days
- Track opt-outs permanently

**Email Templates**:
- Customizable templates for Touch 1 and Touch 2
- Variable substitution: {business_name}, {address}, {website_status}
- Different templates for "no_website" vs "technical_issues" segments

**Tracking & Analytics**:
- Sent timestamp
- Touch number (1 or 2)
- Delivery status (sent/delivered/bounced)
- Opened (tracking pixel)
- Clicked (link tracking)
- Replied (manual marking)
- Unsubscribed (automated webhook)

**Manual Outreach Methods** (Phone, Text, Social):

**Call Tracking**:
- Log call attempts with date/time
- Call outcome: no answer, voicemail, spoke with owner, not interested, call back
- Next follow-up date
- Notes field for conversation details

**Text Message Tracking**:
- Log text attempts (manual for now, no automation due to TCPA)
- Message sent date/time
- Response received (yes/no)
- Notes

**Social Media Outreach Tracking**:
- Platform: Facebook, Instagram, LinkedIn
- Message sent date
- Response received
- Conversation notes

**Unified Contact Log**:
- Single timeline view per business showing all touch points
- All channels: email (automated), phone, text, social media
- Chronological history
- Method, date, outcome, notes

### 7. Lead Management & Notes

**Lead Status Tracking**:
- Discovery date
- Current status (pending/approved/contacted/responded/inactive)
- Last contact date
- Next follow-up date (for manual scheduling)
- Total contact attempts (across all channels)

**Notes Field**:
- Free-form text field per business
- Track conversation outcomes
- Log objections, interests, pricing discussions
- Special requirements or follow-up items
- Visible to all team members

**Lead Prioritization**:
- No website = Highest priority
- Social media only = High priority
- Technical issues = Medium priority
- Sort by score, review count, last contact date

### 8. Team Access & User Management

**Authentication**:
- NextAuth.js integration
- Simple email/password login
- Shared team access (no role differentiation initially)
- All team members have full access

**Future Considerations** (not in v1):
- Role-based access (admin, sales rep, viewer)
- Activity tracking per user
- Lead assignment

### 9. Dashboard & Analytics

**Overview Metrics**:
- Total businesses discovered
- Businesses by status (pending/approved/contacted/responded)
- Businesses by website status (no_website, broken, etc.)
- Total outreach sent (by channel)
- Response rate percentage
- Unsubscribe rate

**Campaign Analytics**:
- Email performance: sent, opened, clicked, replied
- Touch 1 vs Touch 2 performance
- Time-to-response metrics
- Best performing templates
- Channel effectiveness (email vs phone vs social)

**Lead Pipeline View**:
- Funnel visualization: discovered → approved → contacted → responded
- Conversion rate at each stage
- Average time in each stage

## Database Schema

### Tables

**businesses**:
- `id`: UUID primary key
- `place_id`: String (Google Maps unique ID)
- `name`: String
- `address`: String
- `phone`: String (nullable)
- `website`: String (nullable - null means no website)
- `business_types`: String[] (array of types from Google)
- `review_count`: Integer
- `small_business_score`: Integer (0-100)
- `website_status`: Enum (no_website, social_only, broken, technical_issues, outdated, acceptable)
- `approval_status`: Enum (pending, approved, rejected, contacted, responded, inactive)
- `discovered_date`: Timestamp
- `last_contact_date`: Timestamp (nullable)
- `next_followup_date`: Timestamp (nullable)
- `notes`: Text (free-form notes)
- `created_at`: Timestamp
- `updated_at`: Timestamp

**contact_info**:
- `id`: UUID primary key
- `business_id`: UUID (foreign key to businesses)
- `email`: String (nullable)
- `email_source`: Enum (scraped, pattern_match, manual, google_maps)
- `phone`: String (nullable)
- `facebook_url`: String (nullable)
- `instagram_url`: String (nullable)
- `linkedin_url`: String (nullable)
- `created_at`: Timestamp
- `updated_at`: Timestamp

**excluded_businesses**:
- `id`: UUID primary key
- `business_name`: String (case-insensitive matching)
- `reason`: String (optional)
- `added_by_user_id`: UUID (foreign key to users)
- `created_at`: Timestamp

**outreach_tracking**:
- `id`: UUID primary key
- `business_id`: UUID (foreign key to businesses)
- `channel`: Enum (email, phone, text, facebook, instagram, linkedin)
- `touch_number`: Integer (for email: 1 or 2)
- `sent_date`: Timestamp
- `delivery_status`: Enum (sent, delivered, bounced, failed)
- `opened`: Boolean (for email)
- `clicked`: Boolean (for email)
- `replied`: Boolean
- `outcome`: String (for phone: no_answer, voicemail, spoke, not_interested, callback)
- `notes`: Text (conversation details)
- `created_by_user_id`: UUID (foreign key to users)
- `created_at`: Timestamp

**email_campaigns**:
- `id`: UUID primary key
- `name`: String
- `template_touch_1`: Text (HTML template)
- `template_touch_2`: Text (HTML template)
- `subject_touch_1`: String
- `subject_touch_2`: String
- `wait_days_between_touches`: Integer (default 7)
- `created_at`: Timestamp

**opt_outs**:
- `id`: UUID primary key
- `business_id`: UUID (foreign key to businesses)
- `email`: String
- `channel`: Enum (email, text)
- `opt_out_date`: Timestamp
- `ip_address`: String (for compliance tracking)

**users**:
- `id`: UUID primary key
- `email`: String (unique)
- `name`: String
- `password_hash`: String
- `created_at`: Timestamp
- `last_login`: Timestamp

## Implementation Phases

### Phase 1: Foundation (Week 1-2)
1. Initialize Next.js project with TypeScript
2. Set up PostgreSQL database on Vercel
3. Configure Prisma ORM and create schema
4. Implement NextAuth.js for team authentication
5. Create basic UI layout and navigation
6. Set up environment variables and deployment on Vercel

#### Phase 1 Blockers (Must Fix Before Phase 2)

1. **Fix Vercel 500 error (Edge runtime + Node `crypto`)**
    - **Problem**: Current route protection uses Next.js middleware, which runs on the Edge runtime. The Edge runtime does not support Node's `crypto` module, which is required by current auth/session verification.
    - **Goal**: Production deployment must load without runtime 500s.
    - **Acceptance**:
       - Vercel preview + production loads home page without 500 errors.
       - Auth protection still works (unauthenticated users cannot access protected views/routes).
       - No Node-only modules are imported/executed in Edge runtime paths.
    - **Verify**:
       - Deploy to Vercel, load `/` and a protected route.
       - Confirm login flow works end-to-end.

2. **Document user account creation for Vercel + Postgres/Neon**
    - **Goal**: Any team member can create the initial admin user (and additional users) in preview/prod safely and repeatably.
    - **Scope**:
       - Where to find the correct `DATABASE_URL` in Vercel.
       - How to run migrations against preview/prod.
       - How to run the user creation script against preview/prod.
       - Safety guidance: avoid using prod credentials locally unless intended.
    - **Acceptance**:
       - Clear, step-by-step instructions exist in repo docs.
       - Includes example commands for preview and production.
    - **Verify**:
       - Follow the docs to create a user in a fresh environment.
       - Sign in using the created user.

3. **Update landing page to match “Client Finder Portal” intent + add Health view**
    - **Goal**: Replace placeholder/legacy “QuizMaster” branding and make the landing page explain the lead discovery + outreach workflow.
    - **Requirements**:
       - Remove all “QuizMaster” labels.
       - Landing page content aligns with the project overview in this plan.
       - Add a simple “Health” section/view that shows:
          - Database connectivity status
          - Login/session status (signed in user vs not signed in)
    - **Acceptance**:
       - `/` renders unauthenticated (marketing/overview) content without redirect loops.
       - Health check renders accurately in local and Vercel environments.
    - **Verify**:
       - Load `/` logged out and logged in.
       - Confirm DB status indicator changes appropriately if DB env is missing/broken.

### Phase 2: Business Discovery (Week 2-3)
1. Implement Google Maps Places API integration
2. Build search interface with location and type filters
3. Create business scoring algorithm
4. Load known chains database
5. Implement API call optimization (field masking, caching)
6. Store discovered businesses in database

### Phase 3: Website Validation (Week 3-4)
1. Build website validator (HTTP checks, SSL, load time)
2. Implement mobile-responsive detection
3. Create website scraper for email extraction
4. Add social media profile detection (Facebook, Instagram, LinkedIn)
5. Categorize businesses by website status
6. Store all URLs and contact info

### Phase 4: Manual Review Workflow (Week 4-5)
1. Build review queue UI with filtering/sorting
2. Implement approve/reject actions
3. Create exclude list management interface
4. Add bulk operations
5. Prioritize "no_website" and "social_only" businesses
6. Build contact info display with all available methods

### Phase 5: Email Outreach System (Week 5-6)
1. Integrate SendGrid or AWS SES
2. Build 2-touch email sequence engine
3. Implement CAN-SPAM compliance (unsubscribe, footer)
4. Create email template system with variables
5. Add email tracking (opens, clicks)
6. Build unsubscribe webhook and opt-out management

### Phase 6: Multi-Channel Tracking (Week 6-7)
1. Build manual outreach logging (phone, text, social)
2. Create unified contact timeline per business
3. Implement notes field with edit history
4. Add outcome tracking for all channels
5. Build next follow-up date scheduling
6. Create lead status progression workflow

### Phase 7: Dashboard & Analytics (Week 7-8)
1. Build overview metrics dashboard
2. Create campaign performance analytics
3. Implement lead pipeline visualization
4. Add filtering and segmentation
5. Build export functionality (CSV)
6. Create team activity summaries

### Phase 8: Testing & Refinement (Week 8)
1. End-to-end testing of all workflows
2. Performance optimization
3. Security audit
4. Compliance review (CAN-SPAM, TCPA)
5. UI/UX improvements based on team feedback
6. Documentation and training materials

## Key User Workflows

### Workflow 1: Discover New Leads
1. User enters location (city or ZIP) and search radius
2. User selects business types to target
3. System queries Google Maps API
4. System scores each business
5. System validates websites and scrapes contact info
6. Businesses added to review queue with "pending" status

### Workflow 2: Review & Approve Leads
1. User opens review queue
2. User filters to "no_website" (VIP leads)
3. User reviews business details, score, contact info
4. User approves promising leads
5. User rejects poor fits
6. User adds chains/enterprises to exclude list
7. Approved leads move to "approved" status

### Workflow 3: Automated Email Outreach
1. System identifies "approved" businesses not yet contacted
2. System sends Touch 1 email from campaign template
3. System tracks delivery, opens, clicks
4. System waits 7 days
5. If no response, system sends Touch 2 email
6. System tracks engagement
7. Business marked "inactive" after Touch 2 with no response

### Workflow 4: Manual Outreach (Phone/Social)
1. User views business details for "no_website" lead
2. User calls phone number from Google Maps
3. User logs call attempt with outcome
4. User adds notes from conversation
5. If no answer, user schedules next follow-up date
6. Business status updated to "contacted"

### Workflow 5: Track Engagement & Close
1. Business responds to outreach (any channel)
2. User marks as "responded"
3. User logs conversation notes
4. User tracks progression through sales process
5. Notes field captures all follow-up details
6. Business either converts or moves to "inactive"

## Compliance & Legal Considerations

### CAN-SPAM Act (Email)
- ✅ Only email businesses with publicly available contact info
- ✅ Truthful subject lines and from addresses
- ✅ Include physical address in footer
- ✅ Provide one-click unsubscribe
- ✅ Honor opt-outs within 10 business days
- ✅ Keep records of unsubscribe requests

### TCPA (SMS/Phone)
- ⚠️ Do NOT automate text messages without prior express written consent
- ✅ Manual texting allowed if phone found publicly
- ✅ Track all text attempts manually for now
- ✅ Honor opt-out requests immediately
- 📋 Future: Build consent collection mechanism before automating SMS

### Data Privacy
- ✅ Only collect publicly available information
- ✅ Store data securely (PostgreSQL on Vercel)
- ✅ Honor data deletion requests
- ✅ Track data source for all contact info
- ✅ Provide opt-out mechanisms

## Success Metrics

### Discovery Metrics
- Businesses discovered per search
- Percentage qualifying as "small business" (score >70)
- Percentage with no website (target: 20-30%)
- Percentage with social media only (target: 10-15%)
- API cost per business (<$0.02)

### Outreach Metrics
- Email delivery rate (target: >95%)
- Email open rate (target: >25%)
- Email click rate (target: >5%)
- Response rate (target: >2%)
- Touch 1 vs Touch 2 response rates
- Unsubscribe rate (target: <1%)

### Conversion Metrics
- Approved leads per week
- Contacted leads per week
- Response rate by channel (email vs phone vs social)
- Leads converted to clients
- Revenue generated from tool

### Efficiency Metrics
- Time saved vs manual research
- Cost per qualified lead
- Team productivity (leads processed per hour)
- Average time to first contact

## Technical Considerations

### Performance
- Cache Google Maps API results for 30 days
- Implement pagination for large result sets
- Optimize database queries with proper indexing
- Use background jobs for website validation (slow process)

### Security
- Secure API keys in environment variables
- Implement rate limiting on API routes
- Sanitize user inputs (SQL injection prevention)
- Hash passwords with bcrypt
- Use HTTPS only

### Scalability
- Horizontal scaling with Vercel serverless functions
- Database connection pooling
- Async processing for bulk operations
- Consider queue system (Bull/BullMQ) for large email sends

### Error Handling
- Graceful API failure handling
- Retry logic for transient errors
- User-friendly error messages
- Logging and monitoring (consider Sentry)

## Budget Estimate

### Monthly Operating Costs (Estimated)
- **Google Maps API**: $0-50 (within free tier for 10K searches)
- **SendGrid/AWS SES**: $0-20 (free tier covers ~100K emails)
- **Vercel Hosting**: $0-20 (hobby tier or pro $20/month)
- **PostgreSQL Database**: Included with Vercel or $5-15/month
- **Domain**: $10-15/year
- **Total**: ~$25-75/month at small scale

### Development Time
- 8 weeks for MVP (full-time development)
- 4-6 weeks for part-time development
- Ongoing maintenance: 5-10 hours/month

## Future Enhancements (Post-MVP)

### Advanced Features
- AI-powered website quality scoring
- Automated screenshot capture and visual analysis
- Email deliverability testing
- A/B testing for email templates
- SMS automation with consent workflow
- Integration with CRM systems (HubSpot, Salesforce)

### Enhanced Business Intelligence
- Competitor website analysis
- Industry benchmarking
- Seasonal business targeting
- Review sentiment analysis
- Social media engagement metrics

### Team Collaboration
- Lead assignment and routing
- Role-based permissions
- Activity notifications
- Comments and @mentions
- Calendar integration for follow-ups

### Reporting
- Custom report builder
- Scheduled email reports
- Data export to Excel/CSV
- API webhooks for external tools
- Integration with Google Analytics

## Open Questions & Decisions Needed

1. **Email Service Provider**: SendGrid vs AWS SES vs Postmark?
   - SendGrid: Easier setup, better UI, $0-15/month
   - AWS SES: Cheaper at scale, more complex setup, $0.10 per 1K emails
   - **Recommendation**: Start with SendGrid for simplicity

2. **Database Hosting**: Vercel Postgres vs external provider?
   - Vercel Postgres: Integrated, easy setup, higher cost at scale
   - Supabase/Railway: More control, better pricing, separate deploy
   - **Recommendation**: Start with Vercel Postgres for simplicity

3. **Initial Search Scope**: How many businesses to discover in first run?
   - Consider starting small (100-200) to test workflow
   - Gradually scale to 1,000+ as process is refined
   - **Recommendation**: Start with 100-200 in local market

4. **Email Sending Limits**: How many emails per day initially?
   - Start conservative to build sender reputation
   - **Recommendation**: 50 emails/day for first 2 weeks, then scale to 200/day

5. **Manual vs Automated Social Media Outreach**:
   - Manual initially (log attempts in tool)
   - Future: API integrations if available
   - **Recommendation**: Manual logging only in v1

## Project Success Criteria

### MVP Launch Criteria
- ✅ Can search and discover 100+ businesses in target market
- ✅ Small business scoring algorithm working accurately
- ✅ Website validation detecting no_website and technical_issues
- ✅ Manual review queue functioning smoothly
- ✅ 2-touch email sequence working with tracking
- ✅ CAN-SPAM compliant unsubscribe working
- ✅ Multi-channel outreach tracking (email, phone, social)
- ✅ Notes field for tracking conversations
- ✅ Team can login and collaborate
- ✅ Dashboard shows key metrics

### 3-Month Goals
- 500+ businesses discovered
- 100+ approved leads in pipeline
- 50+ businesses contacted
- 10+ positive responses
- 2-3 converted clients
- <$100/month operating costs

### 6-Month Goals
- 2,000+ businesses discovered
- 500+ approved leads
- 200+ businesses contacted across all channels
- 25+ positive responses
- 10+ converted clients
- Refined targeting and scoring based on data
- Documented best practices for outreach
