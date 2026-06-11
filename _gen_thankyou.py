"""Generate one branded thank-you page per freebie: delivers the doc (auto-download + button) AND shows the $79 offer.
One template, data-driven. Cloudflare Pages serves <name>.html at the clean URL /<name>."""
import pathlib
HERE = pathlib.Path(__file__).parent
TEAL = "#1B6B5F"

# slug(thanks file) -> (doc title, hosted free PDF, short "what you got" line)
FREEBIES = {
 "unclaimed-thanks": ("50-State Unclaimed Money Checklist", "/downloads/50-State-Unclaimed-Money-Checklist.pdf",
   "Every official state + federal database where unclaimed money hides, in one place."),
 "airline-thanks": ("Airline Refund Cheat-Sheet", "/downloads/Airline-Refund-Cheat-Sheet.pdf",
   "The 2026 DOT refund rules — exactly what airlines owe you and how to claim it."),
 "11ways-thanks": ("11-Way Money Checklist", "/downloads/11-Way-Money-Checklist.pdf",
   "11 times a company legally owes you money — with the claim step for each."),
 "eitc-thanks": ("EITC Eligibility Checklist", "/downloads/EITC-Eligibility-Checklist.pdf",
   "Check if you qualify for the $1,500+ tax credit — and claim up to 3 years back."),
}

TPL = """<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="robots" content="noindex">
<title>Your {title} — Money You're Owed</title>
<style>
*{{margin:0;padding:0;box-sizing:border-box}}
body{{font-family:-apple-system,'Segoe UI',Roboto,sans-serif;line-height:1.6;color:#1a3a3a;background:#f8f9fa}}
.wrap{{max-width:640px;margin:0 auto;padding:3rem 1.5rem}}
.logo{{width:54px;height:54px;border-radius:50%;background:{teal};color:#fff;font-size:26px;font-weight:bold;display:flex;align-items:center;justify-content:center;margin:0 auto 1.5rem}}
.card{{background:#fff;border-radius:14px;box-shadow:0 4px 18px rgba(0,0,0,.08);padding:2.5rem 2rem;text-align:center}}
h1{{color:{teal};font-size:1.6rem;margin-bottom:.6rem}}
.sub{{color:#566;margin-bottom:1.5rem}}
.dl{{display:inline-block;background:{teal};color:#fff;padding:15px 32px;border-radius:8px;text-decoration:none;font-weight:700;font-size:1.1rem}}
.note{{color:#889;font-size:.85rem;margin-top:1rem}}
.offer{{background:#fff;border-radius:14px;box-shadow:0 4px 18px rgba(0,0,0,.08);padding:2rem;margin-top:2rem;text-align:center;border-top:4px solid {teal}}}
.offer h2{{color:{teal};font-size:1.3rem;margin-bottom:.5rem}}
.price{{margin:1rem 0}}
.price .o{{text-decoration:line-through;color:#aaa;font-size:1.1rem;margin-right:.5rem}}
.price .b{{color:{teal};font-size:2rem;font-weight:800}}
.badge{{display:inline-block;background:{teal};color:#fff;padding:.25rem .8rem;border-radius:20px;font-size:.78rem;font-weight:700;margin-bottom:.5rem}}
.cta{{display:inline-block;background:{teal};color:#fff;padding:13px 28px;border-radius:8px;text-decoration:none;font-weight:700;margin-top:.5rem}}
.back{{display:block;margin-top:1.5rem;color:{teal};text-decoration:none;font-weight:600;font-size:.9rem}}
</style></head>
<body>
<div class="wrap">
  <div class="logo">$</div>
  <div class="card">
    <h1>✅ Here's your {title}</h1>
    <p class="sub">{whatline}</p>
    <a class="dl" id="dl" href="{pdf}" download>⬇ Download the PDF</a>
    <p class="note">Your download should start automatically. If not, tap the button above. Save it somewhere safe.</p>
  </div>

  <div class="offer">
    <span class="badge">Save 40% as the Complete Kit</span>
    <h2>While you're here: the Complete Recovery Kit</h2>
    <p>The free checklist shows you <strong>what</strong> you're owed. The Kit is the done-for-you machine that <strong>claims it</strong> — fill-in letters, word-for-word scripts, and a tracker, across every category.</p>
    <div class="price"><span class="o">$131</span><span class="b">$79</span></div>
    <a class="cta" href="/#offer">See the Complete Kit →</a>
  </div>
  <a class="back" href="/">← Back to Money You're Owed</a>
</div>
<script>
  // auto-start the free download (no email required — honors the ungated promise for V1/V2)
  window.addEventListener('load', function(){{
    var a=document.getElementById('dl');
    setTimeout(function(){{ var t=document.createElement('a'); t.href=a.href; t.download=''; document.body.appendChild(t); t.click(); t.remove(); }}, 600);
  }});
</script>
</body></html>"""

for name,(title,pdf,whatline) in FREEBIES.items():
    (HERE/(name+".html")).write_text(TPL.format(title=title,pdf=pdf,whatline=whatline,teal=TEAL))
    print("wrote", name+".html")
