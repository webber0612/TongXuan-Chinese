# Spaced repetition policy

The scheduler stores review state separately for each learner, skill domain, and item. School Queue membership remains independent. The deterministic intervals are:

| Stage after independent correct response | Next review |
| --- | --- |
| 1 | 10 minutes |
| 2 | 1 day |
| 3 | 3 days |
| 4 | 7 days |
| 5 | 14 days |
| 6 | 30 days |
| 7 | 60 days |
| 8 | 120 days |

Rules:

- An independent correct response advances one stage, up to the 120-day cap.
- An assisted correct response does not advance the stage and stays due in the same session.
- An incorrect response resets that domain/item to stage 0 and stays due immediately for a targeted retry.
- The same character can have separate recognition, writing, pronunciation, or other skill state; a success in one domain never advances another.
- Each review writes a current state and an append-only event with prior/next stage, outcome, assistance flag, and interval. The adaptive planner replays events only through its requested `as_of` time.
- Recognition's next-item selector and the adaptive plan both prefer the new SRS due time when one exists.
- Reading-aloud recording completion is not scored as correct. It cannot advance a speaking/pronunciation SRS stage or create mastery evidence.
- Existing per-domain attempt and mastery tables remain separate; SRS prioritizes review but does not itself assign lesson mastery.

Policy constants and event handling live in `backend/app/curriculum_policy.py`. Regressions cover interval growth, assistance, reset, and domain separation.
