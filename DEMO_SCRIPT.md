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

#### Scene 3: Live Dashboard & Urgency-Ranked Feed (1:00 – 1:45)
- **Visual:** Open browser to `http://localhost:8000`. Show the TenderRadar Dashboard. Point out the top metrics cards (Tenders Discovered, Closing Within 7 Days, Active Watchlists).
- **Speaker:**  
  > *"Here is the live TenderRadar dashboard. Tenders are automatically organized into clean bid cards, strictly sorted by submission deadline.  
  > Look at our urgency badges:  
  > - Red for bids closing within 3 days — urgent action required.  
  > - Yellow for bids closing within 7 days.  
  > - Green for active tenders with more than a week.  
  > Notice what our LLM pipeline extracts for each bid: the exact EMD deposit, tender document fees, structured eligibility qualifications, a concise scope of work, and an actionable bidder tip — plus a direct link back to the official government RFP document."*

---

#### Scene 4: Watchlist Management & Instant On-Demand Scan (1:45 – 2:20)
- **Visual:** Navigate to the `/watchlists` tab. Demonstrate adding a new keyword (e.g., `"Electric Vehicle EV Charging Stations"`, Category `"Clean Tech"`, Min Value `"₹1 Crore+"`, State `"Delhi NCR"`). Click **Save Watchlist**.
- **Speaker:**  
  > *"Users can define customized watchlists for their specific industry domain, minimum contract thresholds, and state filters.  
  > When I click 'Save Watchlist', TenderRadar validates the input server-side, immediately schedules daily background monitoring using APScheduler, and triggers an on-demand SerpApi scan.  
  > In seconds, the new bids are fetched, normalized, deduplicated against existing database entries, summarized by our AI pipeline, and populated directly on the dashboard."*

---

#### Scene 5: CSV Export & Contractor Workflow (2:20 – 2:40)
- **Visual:** Click **Export View to CSV** button on the dashboard. Open the downloaded CSV in Excel or preview it in terminal. Show structured columns: Title, Portal, Deadline, EMD, Scope, Eligibility, Strategic Advice, and Direct Portal Link.
- **Speaker:**  
  > *"For bid consultants and estimating teams who run weekly pipeline meetings, one click exports the entire filtered view into a structured CSV with all AI-extracted financial and eligibility data. Bidders can immediately import this into their CRM or project tracker."*

---

#### Scene 6: Conclusion & Hackathon Submission (2:40 – 2:45)
- **Visual:** Display GitHub repository, passing test suite (`37 passed in pytest`), and offline mock mode switch.
- **Speaker:**  
  > *"TenderRadar turns fragmented government tender discovery into an automated, actionable advantage. Powered by SerpApi. Thank you!"*

---

### Presenter Checklist
- [x] Backend running on `http://localhost:8000`
- [x] Pre-seeded watchlists loaded
- [x] Browser tabs ready: Dashboard, Watchlists, Scan Monitor
- [x] Sample CSV download verified
- [x] Offline mock mode verified (works 100% without external API keys for demonstration)
