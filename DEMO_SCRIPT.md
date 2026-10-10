# TenderRadar - Demo Video Script (< 3 Minutes)

**Event:** SerpApi India Hackathon 2026  
**Submission Deadline:** October 10, 2026, 23:59 IST  
**Format:** Screen recording with voiceover / human presentation  
**Total Target Duration:** 2 minutes 45 seconds  

---

### Shot List & Timed Script

#### Scene 1: The Indian Procurement Problem (0:00 – 0:30)
- **Visual:** Split screen / montage showing multiple disconnected Indian procurement portals: GeM (`gem.gov.in`), CPPP Central Public Procurement (`eprocure.gov.in`), Indian Railways (`ireps.gov.in`), and State PWD portals (`mahatenders.gov.in`, `kppp.karnataka.gov.in`).
- **Speaker:**  
  > *"Every year, the Government of India and state agencies tender out over ₹50 lakh crore across infrastructure, solar, healthcare, and IT. But for contractors, MSMEs, and bid consultants, discovering these tenders is a nightmare. Procurement is fragmented across dozens of separate, CAPTCHA-heavy portals. High-value bids are frequently missed, and deadlines slip past unnoticed.  
  > Welcome to **TenderRadar** — an automated, intelligent tender discovery agent powered by SerpApi."*

---

#### Scene 2: Deep SerpApi Engine & Credit-Smart Architecture (0:30 – 1:00)
- **Visual:** Switch to Terminal or Code/Architecture diagram showing SerpApi query builder (`app/serpapi_client.py`), SQLite cache table, and URL normalizer.
- **Speaker:**  
  > *"Without SerpApi, building TenderRadar would be impossible — because there is no single Indian government API that unifies GeM, CPPP, and state tenders.  
  > TenderRadar connects deeply with SerpApi's Google Search API using targeted search footprints: querying official domains like `gem.gov.in`, `eprocure.gov.in`, `ireps.gov.in`, and state portals with India-specific geotargeting (`gl=in`, `location=India`).  
  > To strictly conserve SerpApi free-tier credits, our query caching layer caches search responses in SQLite with a configurable TTL, and our deduplication engine canonicalizes URLs to discard tracking tags like `utm_*` and session IDs."*

---

#### Scene 3: Live Dashboard & Bid Advisor Spotlight (1:00 – 1:40)
- **Visual:** Open browser to `http://localhost:8000`. Show the TenderRadar Dashboard. Point out the top metrics cards (Tenders Discovered, Recommended Bids, Closing <7 Days) and quick verdict filter pills (`BID`, `REVIEW`, `NO_BID`).
- **Speaker:**  
  > *"Here is the live TenderRadar dashboard, populated with live discovery across GeM, CPPP, and state portals via SerpApi.  
  > But discoverability is only half the battle. Our category-winning differentiator is the autonomous Bid/No-Bid Advisor.  
  > Based on our bidder profile, TenderRadar scores every tender with an instant match percentage and verdict:  
  > - Recommended Bids (BID) in Emerald  
  > - Manual Review in Amber  
  > - High-risk or out-of-bracket bids filtered out.  
  > For Indian MSMEs, it automatically flags zero-rupee EMD deposit waivers under the Public Procurement Policy, saving lakhs in tied-up liquidity!"*

---

#### Scene 4: Watchlist Search & Instant On-Demand Discovery (1:40 – 2:10)
- **Visual:** Navigate to `/watchlists`. Add or inspect a keyword (e.g., `"Solar Rooftop EPC"`, Category `"Renewable Energy"`). Trigger **Scan Now** or view live search on Dashboard.
- **Speaker:**  
  > *"Users define targeted watchlists with domain keywords, turnover brackets, and preferred states.  
  > On-demand or on a daily APScheduler cron, TenderRadar executes SerpApi searches with India geotargeting (`gl=in`, `location=India`), bypassing portal CAPTCHAs, caching queries to conserve API credits, and deduplicating URLs against our SQLite database."*

---

#### Scene 5: Tender Summary, Private Notes & 1-Click CSV Export (2:10 – 2:40)
- **Visual:** Click into a tender to view the executive brief: scope summary, eligibility criteria, and private strategy notes. Return to Dashboard and click **Export CSV**. Preview the exported CSV with structured columns.
- **Speaker:**  
  > *"Clicking any tender opens a concise executive brief: AI-extracted scope of work, technical eligibility, strategic advice, and private bidding notes.  
  > Finally, one click exports the entire filtered pipeline to a structured CSV — complete with portal sources, deadlines, EMD amounts, and Bid Advisor verdicts ready for weekly estimating meetings."*

---

#### Scene 6: Conclusion & Hackathon Submission (2:40 – 2:45)
- **Visual:** Display GitHub repository, passing test suite (`74 passed in pytest`), and offline mock mode switch.
- **Speaker:**  
  > *"TenderRadar turns fragmented government tender discovery into an automated, actionable advantage. Powered by SerpApi. All 74 tests green. Thank you!"*

---

### Presenter Checklist
- [x] Backend running on `http://localhost:8000`
- [x] Pre-seeded watchlists loaded
- [x] Browser tabs ready: Dashboard, Watchlists, Scan Monitor
- [x] Sample CSV download verified
- [x] Offline mock mode verified (works 100% without external API keys for demonstration)
