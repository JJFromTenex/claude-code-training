# /outreach

Draft personalized follow-up emails for stalled deals in the pipeline.

## What to Do

1. Read `data/pipeline.csv` and identify all deals where Days Since Last Touch is 30 or more
2. Read the sample emails in `data/sample-emails/` to understand the sender's writing voice — their tone, sentence structure, how they open and close, level of formality
3. For each stalled deal, draft a follow-up email that:
   - Opens with something specific to that deal (reference the notes, the last conversation, or a recent event)
   - Acknowledges the gap in communication without being passive-aggressive
   - Provides a clear reason to re-engage (new feature, case study, timeline urgency)
   - Ends with a specific next step and proposed time
   - Matches the voice and style of the sample emails
   - Stays under 150 words

## Output

Save each draft as a separate markdown file in `output/`:
- Filename: `outreach-[company-name].md`
- Include: Subject line, email body, and a 1-line "Why this approach" note explaining your personalization strategy

At the end, print a summary: how many drafts generated, which deals were targeted, and the personalization angle for each.
